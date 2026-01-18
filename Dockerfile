FROM continuumio/miniconda3

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN conda update -n base -c defaults conda && \
    conda install -y python=3.11 && \
    pip install --no-cache-dir fastapi "uvicorn[standard]" python-dotenv supabase "google-genai" "yfinance[full]" pandas numpy "pandas_ta==0.3.14b" requests && \
    conda clean -afy

COPY server_py/ ./server_py/

EXPOSE 3001

CMD ["uvicorn", "server_py.app:app", "--host", "0.0.0.0", "--port", "3001"]
