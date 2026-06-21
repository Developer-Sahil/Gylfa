FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (runtime only — dev tools excluded)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
# Note: .dockerignore excludes .env, firebase-service-account.json, __pycache__, tests/
COPY . .

EXPOSE 8000

# Use 2 workers for production throughput; adjust via WEB_CONCURRENCY env var if needed.
# The service account key is mounted at runtime via docker-compose / Render secret volume.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "info"]
