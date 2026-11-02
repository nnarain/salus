FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

RUN useradd --system --no-create-home mcp
USER mcp

EXPOSE 8000
CMD ["python", "server.py"]
