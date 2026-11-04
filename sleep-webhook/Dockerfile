FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY server.py .

RUN useradd --system --no-create-home webhook \
    && mkdir /data && chown webhook /data
USER webhook
VOLUME /data

EXPOSE 8000
CMD ["python", "server.py"]
