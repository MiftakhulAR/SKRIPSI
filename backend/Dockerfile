# Hugging Face Spaces (Docker) — listens on 7860
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
COPY artifacts artifacts
RUN mkdir -p uploads
ENV FRONTEND_ORIGINS=http://localhost:3000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
