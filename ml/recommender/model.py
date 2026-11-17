import torch
from torch import nn


class Ranker(nn.Module):
    """Небольшой ранжировщик по признакам карточки.

    Отдельные эмбеддинги людей не используются: новый аккаунт и новая встреча
    ещё не имеют истории, а каталог локальных событий маленький и считается целиком.
    """

    def __init__(self, in_dim: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        return self.net(features).squeeze(-1)
