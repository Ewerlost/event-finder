# Event Finder API

Python-бэкенд Event Finder. Контракт совпадает с фронтом: `http://localhost:8080/api/v1.0/...`.

Старый ASP.NET-проект оставлен в `backend/EventFinder` и этим сервером не используется. Схема базы новая: аккаунты, профили, мероприятия, записи и отзывы. Пароли из .NET Identity сюда не переносятся.

## Локально

```powershell
cd backend\python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
docker compose up -d postgres
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Фронт уже ходит на `http://localhost:8080`.

Если `MAILERSEND_API_TOKEN` пустой, письма не отправляются. Ссылка подтверждения и сброса пароля пишется в лог сервера. Для HashRouter `FRONTEND_URL` должен заканчиваться на `/#`, например `http://localhost:5173/#` или `https://alexthunder2005.github.io/event-finder/#`.

## Docker

```powershell
cd backend\python
docker compose up --build
```

API: `http://localhost:8080`. Проверка: `http://localhost:8080/health`.

Секреты почты и JWT задаются переменными окружения, не файлом настроек. Не копируйте пароли из `appsettings.json` старого бэкенда: этот файл уже содержит рабочие ключи, их стоит отозвать и выпустить заново.
