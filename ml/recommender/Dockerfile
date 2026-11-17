FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY features.py model.py serve.py ./
COPY artifacts ./artifacts

EXPOSE 8090

CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8090"]
