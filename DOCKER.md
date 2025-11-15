# Docker Deployment Guide

This guide explains how to deploy the Health Tracker application using Docker Compose with a minimal self-hosted backend.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- At least 2GB of RAM available for Docker

## Quick Start

1. **Copy the environment file:**
   ```bash
   cp .env.docker.example .env
   ```

2. **Start the services:**
   ```bash
   docker compose up -d
   ```

3. **Access the application:**
   - Health Tracker App: http://localhost:3000
   - PostgREST API: http://localhost:3001
   - PostgreSQL Database: localhost:5432

The default configuration uses demo credentials which are fine for local development.

## Services

The Docker Compose setup includes three core services:

- **app**: Health Tracker Next.js application (port 3000)
- **rest**: PostgREST API providing REST interface to PostgreSQL (port 3001)
- **db**: PostgreSQL database with Supabase extensions (port 5432)
- **meta**: Database management and introspection
- **imgproxy**: Image transformation service

## Database Migrations

The database setup happens automatically in two stages:

1. **Initialization** (00-init-supabase-roles.sh): Sets up required Supabase roles and schemas
2. **Migrations** (01-run-migrations.sh): Runs all SQL migration files from `./supabase/migrations/`

These scripts run automatically when the database container starts for the first time.

If you need to run additional migrations after initial setup:

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

Data is persisted using a Docker volume:

- `db-data`: PostgreSQL database data

This volume persists even when containers are stopped or removed. To completely remove all data, use:
```bash
docker compose down -v
```

## Security Considerations

### For Production Deployment

1. **Change default credentials:**
   - Update `POSTGRES_PASSWORD` in `.env`
   - Generate a new `JWT_SECRET` (minimum 32 characters): `openssl rand -base64 32`
   - Generate new ANON_KEY using the new JWT secret

2. **Use HTTPS:**
   - Set up a reverse proxy (nginx, Traefik, Caddy) with SSL certificates
   - Update `NEXT_PUBLIC_SUPABASE_URL` to use your HTTPS domain

3. **Network security:**
   - Don't expose database port (5432) to the public
   - Consider using Docker networks to isolate services

## Troubleshooting

### Database connection issues

Check if the database is healthy:
```bash
docker compose ps
docker compose logs db
```

### Application can't connect to API

Verify the environment variables:
```bash
docker compose exec app env | grep SUPABASE
```

Ensure PostgREST is running:
```bash
docker compose logs rest
curl http://localhost:3001
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

1. Start only the database and API:
   ```bash
   docker compose up -d db rest
   ```

2. Run the Next.js dev server locally:
   ```bash
   npm run dev
   ```

The app will connect to PostgREST running at http://localhost:3001.

Alternatively, use `docker-compose.dev.yml` which includes Supabase Studio for database management:
```bash
docker compose -f docker-compose.dev.yml up -d
```

## Environment Variables Reference

See `.env.docker.example` for a complete list of available environment variables and their descriptions.

## Additional Resources

- [PostgREST Documentation](https://postgrest.org/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
