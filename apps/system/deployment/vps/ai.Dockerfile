FROM python:3.12-slim
RUN pip install --no-cache-dir uvicorn==0.54.0 && useradd --uid 10001 --create-home fama
WORKDIR /app
COPY ai/service.py ai/asgi_vps.py ./
USER fama
EXPOSE 8000
CMD ["uvicorn", "asgi_vps:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
