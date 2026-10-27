# CareerAI backend - Hugging Face Space (Docker). Built by tools/make_deploy.py (patch 14).
FROM python:3.11-slim
RUN useradd -m -u 1000 user
WORKDIR /app
RUN mkdir -p /app/uploads && chown -R user:user /app
COPY requirements.txt .
# CPU-only torch (much smaller than the default CUDA build), then the rest
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt
USER user
ENV HOME=/home/user HF_HOME=/home/user/.cache PYTHONUNBUFFERED=1 \
    KB_LAYER=public RAG_COMPARE=0 LLM_PROVIDER=groq
# bake the e5 embedding model into the image so the first request does not wait for a 1 GB download
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')"
COPY --chown=user app app
COPY --chown=user artifacts artifacts
RUN mkdir -p uploads
EXPOSE 7860
# Railway/Render give the port in $PORT; Hugging Face uses 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
