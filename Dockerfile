FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY server_py/ ./server_py/
COPY pandas_ta_bak/pandas_ta-0.3.14b.tar.gz /tmp/pandas_ta-0.3.14b.tar.gz

RUN python -m pip install --upgrade pip && \
    pip install fastapi "uvicorn[standard]" python-dotenv supabase "google-genai" "yfinance[full]" pandas==2.2.1 numpy==1.26.4 requests && \
    pip install /tmp/pandas_ta-0.3.14b.tar.gz && \
    rm /tmp/pandas_ta-0.3.14b.tar.gz \
    python -V && \
    pip freeze

EXPOSE 3001

CMD ["uvicorn", "server_py.app:app", "--host", "0.0.0.0", "--port", "3001"]
