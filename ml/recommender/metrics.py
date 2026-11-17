import math


def precision_at_k(ranked_labels: list[int], k: int) -> float:
    if k <= 0:
        return 0.0
    return sum(ranked_labels[:k]) / k


def recall_at_k(ranked_labels: list[int], k: int) -> float | None:
    relevant = sum(ranked_labels)
    if relevant == 0:
        return None
    return sum(ranked_labels[:k]) / relevant


def ndcg_at_k(ranked_labels: list[int], k: int) -> float | None:
    def dcg(labels: list[int]) -> float:
        return sum(label / math.log2(index + 2) for index, label in enumerate(labels[:k]))

    ideal = dcg(sorted(ranked_labels, reverse=True))
    if ideal == 0:
        return None
    return dcg(ranked_labels) / ideal


def average(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)
