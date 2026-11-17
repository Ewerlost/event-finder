"""Обучает ранжировщик на синтетической выборке и сохраняет веса.

Сравнение идёт с теми же правилами, что в API: интерес, история, дата,
радиус 15 км и небольшой вес популярности. Метрика — Precision@6, Recall@6, NDCG@6.
"""

from datetime import date, timedelta
import json
from math import log1p
from pathlib import Path

import torch
from torch import nn

from features import IN_DIM, feature_vector, haversine_km
from metrics import average, ndcg_at_k, precision_at_k, recall_at_k
from model import Ranker
from synthetic import SyntheticEvent, SyntheticUser, generate_users

TODAY = date(2026, 11, 17)
ARTIFACT = Path(__file__).with_name("artifacts") / "ranker.pt"
METRICS = Path(__file__).with_name("artifacts") / "metrics.json"
K = 6


def _candidate(event: SyntheticEvent) -> dict:
    return {
        "category": event.category,
        "date": (TODAY + timedelta(days=event.day_offset)).isoformat(),
        "coordinates": list(event.coordinates),
        "registrationCount": event.registration_count,
    }


def _rows(user: SyntheticUser) -> tuple[list[list[float]], list[int]]:
    vectors = [
        feature_vector(user.interests, user.history, user.origin, _candidate(event), TODAY)
        for event in user.events
    ]
    labels = [event.label for event in user.events]
    return vectors, labels


def rule_score(user: SyntheticUser, event: SyntheticEvent) -> float:
    score = 0.0
    if event.category in user.interests:
        score += 5
    if event.category in user.history:
        score += 3
    score += max(0, 30 - event.day_offset) / 10
    if haversine_km(user.origin, event.coordinates) <= 15:
        score += 2
    if event.registration_count > 0:
        score += min(1.5, log1p(event.registration_count) / log1p(30) * 1.5)
    return score


def pairwise_loss(logits: torch.Tensor, labels: torch.Tensor, groups: list[tuple[int, int]]) -> torch.Tensor:
    pieces: list[torch.Tensor] = []
    for start, end in groups:
        group_logits = logits[start:end]
        group_labels = labels[start:end]
        positive = group_logits[group_labels > 0.5]
        negative = group_logits[group_labels < 0.5]
        if positive.numel() == 0 or negative.numel() == 0:
            continue
        positive = positive[:8]
        negative = negative[:8]
        diff = positive.unsqueeze(1) - negative.unsqueeze(0)
        pieces.append(torch.nn.functional.softplus(-diff).mean())
    if not pieces:
        return logits.sum() * 0
    return torch.stack(pieces).mean()


def _metric_bundle(users: list[SyntheticUser], order_fn) -> dict[str, float]:
    precision: list[float] = []
    recall: list[float] = []
    ndcg: list[float] = []
    for user in users:
        labels = order_fn(user)
        precision.append(precision_at_k(labels, K))
        recall_value = recall_at_k(labels, K)
        ndcg_value = ndcg_at_k(labels, K)
        if recall_value is not None:
            recall.append(recall_value)
        if ndcg_value is not None:
            ndcg.append(ndcg_value)
    return {
        "precisionAt6": round(average(precision), 4),
        "recallAt6": round(average(recall), 4),
        "ndcgAt6": round(average(ndcg), 4),
    }


def evaluate(model: Ranker, users: list[SyntheticUser]) -> dict[str, dict[str, float]]:
    model.eval()

    def model_order(user: SyntheticUser) -> list[int]:
        vectors, labels = _rows(user)
        with torch.no_grad():
            scores = model(torch.tensor(vectors, dtype=torch.float32)).tolist()
        order = sorted(range(len(scores)), key=lambda index: scores[index], reverse=True)
        return [labels[index] for index in order]

    def rule_order(user: SyntheticUser) -> list[int]:
        order = sorted(
            range(len(user.events)),
            key=lambda index: rule_score(user, user.events[index]),
            reverse=True,
        )
        return [user.events[index].label for index in order]

    return {"model": _metric_bundle(users, model_order), "rules": _metric_bundle(users, rule_order)}


def train() -> dict:
    torch.manual_seed(7)
    train_users = generate_users(2000, 40, seed=7)
    eval_users = generate_users(400, 40, seed=99)
    positives = sum(event.label for user in train_users for event in user.events)
    total = sum(len(user.events) for user in train_users)
    pos_weight = torch.tensor([(total - positives) / max(positives, 1)], dtype=torch.float32)

    model = Ranker(IN_DIM)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    for epoch in range(12):
        model.train()
        order = torch.randperm(len(train_users)).tolist()
        loss_sum = 0.0
        batches = 0
        for start in range(0, len(order), 64):
            batch = [train_users[index] for index in order[start:start + 64]]
            vectors: list[list[float]] = []
            labels: list[float] = []
            groups: list[tuple[int, int]] = []
            for user in batch:
                group_start = len(vectors)
                user_vectors, user_labels = _rows(user)
                vectors.extend(user_vectors)
                labels.extend(float(label) for label in user_labels)
                groups.append((group_start, len(vectors)))
            features = torch.tensor(vectors, dtype=torch.float32)
            target = torch.tensor(labels, dtype=torch.float32)
            logits = model(features)
            loss = criterion(logits, target) + pairwise_loss(logits, target, groups)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            loss_sum += float(loss.detach())
            batches += 1
        metrics = evaluate(model, eval_users)
        print(
            f"epoch {epoch + 1:02d}  loss {loss_sum / batches:.4f}  "
            f"model P@6 {metrics['model']['precisionAt6']:.3f}  "
            f"rules P@6 {metrics['rules']['precisionAt6']:.3f}"
        )

    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), ARTIFACT)
    report = {
        "positiveRate": round(positives / total, 4),
        "evalUsers": len(eval_users),
        "model": metrics["model"],
        "rules": metrics["rules"],
    }
    METRICS.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == "__main__":
    train()
