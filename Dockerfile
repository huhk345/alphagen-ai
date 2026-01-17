FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY server_py/ ./server_py/

RUN python -m pip install --upgrade pip && \
    pip install fastapi "uvicorn[standard]" python-dotenv supabase "google-genai" "yfinance[full]" pandas numpy pandas_ta requests

EXPOSE 3001

CMD ["uvicorn", "server_py.app:app", "--host", "0.0.0.0", "--port", "3001"]

