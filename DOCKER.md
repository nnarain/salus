# Docker Deployment Guide

This guide explains how to deploy the Health Tracker application using Docker Compose with a self-hosted Supabase instance.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- At least 4GB of RAM available for Docker

## Quick Start

1. **Copy the environment file:**
   ```bash
   cp .env.docker.example .env
   ```

2. **Update environment variables** (optional but recommended for production):
   
   Edit `.env` and update the following critical values:
   - `POSTGRES_PASSWORD`: Set a strong database password
   - `JWT_SECRET`: Generate a secure JWT secret (minimum 32 characters)
   
   You can generate a secure JWT secret with:
   ```bash
   openssl rand -base64 32
   ```

3. **Start the services:**
   ```bash
   docker compose up -d
   ```

4. **Access the application:**
   - Health Tracker App: http://localhost:3000
   - Supabase API (Kong Gateway): http://localhost:8000
   - PostgreSQL Database: localhost:5432

## Services

The Docker Compose setup includes the following services:

### Core Services

- **app**: Health Tracker Next.js application (port 3000)
- **db**: PostgreSQL database with Supabase extensions (port 5432)
- **kong**: API Gateway for routing requests (port 8000)

### Supabase Services

- **auth**: Authentication service (GoTrue)
- **rest**: REST API for database access (PostgREST)
- **realtime**: WebSocket server for real-time subscriptions
- **storage**: File storage service
- **meta**: Database management and introspection
- **imgproxy**: Image transformation service

## Database Migrations

The database migrations are automatically applied when the database container starts for the first time. The migration files are located in `./supabase/migrations/` and are mounted as initialization scripts.

If you need to run additional migrations:

1. Add your SQL file to `./supabase/migrations/`
2. Restart the database container:
   ```bash
   docker compose restart db
   ```

Or connect to the database directly:
```bash
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/your-migration.sql
```

## Managing the Services

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f db
```

### Stop services
```bash
docker compose down
```

### Stop and remove all data
```bash
docker compose down -v
```

### Rebuild after code changes
```bash
docker compose up -d --build app
```

## Data Persistence

Data is persisted using Docker volumes:

- `db-data`: PostgreSQL database data
- `storage-data`: Uploaded files and images

These volumes persist even when containers are stopped or removed. To completely remove all data, use:
```bash
docker compose down -v
```

## Security Considerations

### For Production Deployment

1. **Change default credentials:**
   - Update `POSTGRES_PASSWORD` in `.env`
   - Generate a new `JWT_SECRET` (minimum 32 characters)
   - Consider generating new API keys (ANON_KEY and SERVICE_ROLE_KEY)

2. **Use HTTPS:**
   - Set up a reverse proxy (nginx, Traefik, Caddy) with SSL certificates
   - Update `API_EXTERNAL_URL` and `NEXT_PUBLIC_SUPABASE_URL` to use HTTPS

3. **Configure CORS:**
   - Update Kong configuration in `docker/kong.yml` to restrict allowed origins
   - Change `origins: ["*"]` to your specific domain

4. **Enable authentication:**
   - Configure SMTP settings for email-based authentication
   - Set up OAuth providers if needed

5. **Network security:**
   - Don't expose database port (5432) to the public
   - Consider using Docker networks to isolate services

## Troubleshooting

### Database connection issues

Check if the database is healthy:
```bash
docker compose ps
docker compose logs db
```

### Application can't connect to Supabase

Verify the environment variables:
```bash
docker compose exec app env | grep SUPABASE
```

Ensure Kong is running:
```bash
docker compose logs kong
curl http://localhost:8000
```

### Rebuilding from scratch

If you encounter persistent issues:
```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## Development

For development with hot-reload:

1. Comment out the `app` service in `docker-compose.yml`
2. Start only the Supabase services:
   ```bash
   docker compose up -d db kong auth rest realtime storage meta imgproxy
   ```
3. Run the Next.js dev server locally:
   ```bash
   npm run dev
   ```

## Environment Variables Reference

See `.env.docker.example` for a complete list of available environment variables and their descriptions.

## Additional Resources

- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
