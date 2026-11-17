# Ранжировщик «Для вас»

Небольшой сервис на PyTorch. API уже умеет спросить его и, если ответа нет, посчитать порядок правилами.

Отдельные эмбеддинги пользователей не используются. У нового человека и новой встречи нет истории взаимодействий, а предстоящих локальных событий мало: их можно оценить все сразу. Сеть смотрит на признаки пары «человек — мероприятие»: анкета, категории прошлых записей, близость, дата и число записей.

Отдельных тегов у мероприятия нет, поэтому похожесть считается по категории. Это тот же словарь, что в анкете и в карточке события.

## Обучение

Нужен Python 3.12 или 3.13. На 3.15 колёс PyTorch пока нет.

```powershell
cd ml\recommender
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python train.py
```

`train.py` строит синтетическую выборку вокруг Минска, учит сеть и пишет `artifacts/ranker.pt` и `artifacts/metrics.json`. На отложенных пользователях печатаются Precision@6, Recall@6 и NDCG@6 для модели и для правил из API.

## Запуск

```powershell
cd ml\recommender
.\.venv\Scripts\python.exe -m uvicorn serve:app --host 127.0.0.1 --port 8090
```

Проверка: `http://127.0.0.1:8090/health`.

В `backend/python/.env`:

```
RECOMMENDATION_MODEL_URL=http://127.0.0.1:8090/rank
```

`start.ps1` поднимает этот процесс сам, если рядом уже есть `.venv` и файл весов.

Запрос, который шлёт API:

```json
{
  "userId": "...",
  "interests": ["Музыка"],
  "historyCategories": ["Спорт"],
  "origin": [53.9, 27.56],
  "candidates": [
    {
      "id": "...",
      "category": "Музыка",
      "date": "2026-12-01",
      "coordinates": [53.91, 27.55],
      "registrationCount": 4
    }
  ]
}
```

Ответ: `{"eventIds": ["..."]}`.

В Docker сервис выключен по умолчанию, чтобы обычный запуск не тянул PyTorch:

```powershell
cd backend\python
docker compose --profile ml up --build recommender
```

и `RECOMMENDATION_MODEL_URL=http://recommender:8090/rank` у API.
