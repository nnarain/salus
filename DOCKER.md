# Docker Deployment Guide

The stack contains exactly two services: `app` (Next.js on Node 24 LTS) and `db`
(official PostgreSQL 17). No separate database API or authentication service is required.

## Prerequisites

- A maintained Docker Engine installation with Docker Compose v2
- Enough memory to build Next.js (at least 2 GB is recommended)

## GitHub Container Registry Images

The workflow in `.github/workflows/docker-publish.yml` builds both production
images independently using the existing Dockerfiles:

- Application: `ghcr.io/<owner>/<repository>`
- MCP server: `ghcr.io/<owner>/<repository>-mcp`
- Sleep webhook: `ghcr.io/<owner>/<repository>-sleep-webhook`

Image names use lowercase owner and repository names. Builds run on branch
pushes, pull requests, `v*` tag pushes, and manual workflow dispatches. Only
the repository's default branch and `v*` tags publish images; pull requests and
other branches build without registry login or publication. Manual runs follow
the same publication rules for the selected branch or tag.

Default-branch builds publish `latest`, a branch tag, and a `sha-<commit>` tag.
Version tags retain their full name, such as `v1.2.3`; semantic versions also
publish `1.2.3` and `1.2`. Release tags do not overwrite `latest`. Each image has
its own GitHub Actions build cache. Images currently target Linux AMD64.

Authentication uses the workflow's automatic `GITHUB_TOKEN` with
`packages: write`; no Docker Hub account or additional registry secret is needed.
Ensure GitHub Actions is enabled and repository or organization policy permits
package publication. If a package with the same name already exists, grant this
repository Actions access in that package's settings.

After committing and pushing the workflow to the default branch, monitor
**Actions > Build and Publish Docker Images**. Published images appear under
the repository owner's **Packages**. New packages are private by default;
change each package's visibility explicitly if anonymous pulls are desired.
Private pulls require `docker login ghcr.io` with a token that has
`read:packages` and access to the package.

Pull the published images, replacing the placeholders with your repository:

```bash
docker pull ghcr.io/<owner>/<repository>:latest
docker pull ghcr.io/<owner>/<repository>-mcp:latest
```

The existing Compose configuration still builds the application locally.
Publishing images does not deploy containers or change Compose services.

## Quick Start

```bash
docker compose up --build -d
docker compose ps
```

Open http://localhost:3000. On a fresh database the app automatically applies the
five initial migrations. Subsequent starts apply only pending files.

No environment file is required for local defaults. To override them, copy
`.env.docker.example` to `.env`. Before the first home-server start, choose a
URL-safe `POSTGRES_PASSWORD`, for example with `openssl rand -hex 24`.
Changing that setting later does not change the password in an existing database;
update the PostgreSQL role password explicitly rather than deleting its volume.

If upgrading from the previous stack, stop its containers with
`docker compose down --remove-orphans` from the same project folder. Do not use
`-v`: old database volumes are left untouched and are not mounted by this setup.

## Services

- `app`: exposes container port 3000 through `127.0.0.1:3000` by default.
- `db`: available only on the internal `database` network; no host port is published.

Compose waits for `db` to become healthy. The app runs the packaged migration
runner, then replaces its startup shell with the standalone Next.js server.
If migration fails, the server does not start. The app healthcheck queries its
profile API so that database connectivity is included in readiness.

## Database Migrations

Add a new numbered SQL file under `db/migrations`, then rebuild and start the app:

```bash
docker compose up --build -d app
```

Migrations are included in the app image, not database initialization mounts.
Restarting only the database does not apply new migrations. Applied SQL files
must not be edited or removed; filename/checksum tracking detects such changes.
Each migration and its tracking entry commit together, protected by an advisory lock.

With `db` already running, migrations can also be applied without launching a server:

```bash
docker compose run --rm --no-deps app node scripts/migrate.mjs
```

## Managing the Services

### View logs
```bash
docker compose logs -f
docker compose logs -f app
docker compose logs -f db
```

### Stop services
```bash
docker compose down
```

### Rebuild after code changes
```bash
docker compose up -d --build app
```

## Data Persistence

`postgres-data` is a new named volume, normally prefixed with the Compose project
name. It survives container restarts and `docker compose down`. Keep the project
name stable so moving or renaming the stack folder does not select another volume.

**Warning:** `docker compose down -v` destroys the new database volume and all
records. It is not a troubleshooting or upgrade step. Old volumes such as
`db-data` are neither reused nor deleted by the new configuration.

## Backup and Restore

Use a PostgreSQL dump, not the CSV exporter, for complete backups. The dump
includes all four application tables, the profile, and migration history. CSV
export omits the profile and does not safely quote every possible notes field.
Backups contain personal health data: store them outside the repository and
protect their permissions.

With the database running, create a consistent backup:

```bash
mkdir -p "$HOME/health-tracker-backups"
chmod 700 "$HOME/health-tracker-backups"
umask 077
docker compose exec -T db pg_dump -U postgres -d postgres --format=custom \
	> "$HOME/health-tracker-backups/health-tracker.dump"
```

Check the command's exit status before treating the file as a valid backup.
Use dated filenames when retaining multiple backups. For a development stack,
include the same paired Compose files and project name used to start it.

**Restore replaces the target database's application tables.** Verify the target
Compose project and take a current backup first. Restore using a compatible
PostgreSQL image, preferably the same major version used to create the dump.
Stop the app to prevent writes during restore; the database must remain running:

```bash
docker compose stop app
docker compose exec -T db pg_restore -U postgres -d postgres \
	--clean --if-exists --single-transaction --no-owner --exit-on-error \
	< "$HOME/health-tracker-backups/health-tracker.dump"
docker compose up -d app
```

Only start the app after restore succeeds. Restored migration history is checked
against the image's SQL files at startup; use a matching image or a newer image
with unchanged historical migrations. Test restores in a separate Compose
project before relying on a backup. Neither operation requires deleting volumes.

## Security Considerations

This app has no login: anyone who can reach it can read and change health data.
Use only a trusted private home network or private VPN, behind your existing
Caddy proxy. Do not publish it to the internet or forward router ports to it.

Host-based Caddy can proxy to `127.0.0.1:3000`. For containerized Caddy in another
stack, connect only `app` to the existing shared proxy network and use a unique
upstream alias; keep `db` solely on `database`. Caddy is not part of this stack.
`APP_BIND_ADDRESS` can explicitly select a private LAN address when necessary;
the default loopback binding cannot be reached by a proxy on another machine.

## Troubleshooting

### Database connection issues

Check if the database is healthy:
```bash
docker compose ps
docker compose logs db
```

### Application not healthy

Check migration and application errors, then check the API:

```bash
docker compose logs app
curl --fail http://localhost:3000/api/profile
```

Use your configured `APP_PORT` if different. The container connection uses
`db:5432`, not `localhost`. For a host Node server use `localhost` and the
development database port instead. Never delete volumes to repair a connection.

## Development

The development file is an override, not a standalone stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

It still has only `app` and `db`. Source files are mounted for hot reload, with
separate `node_modules` and `.next` volumes. Startup uses `npm ci` against the
lockfile, then `npm run dev` applies migrations and starts Next.js. The database
is additionally available at `127.0.0.1:5432` (or `POSTGRES_PORT`), using a normal
network connection in development so the published port works from the host.
Production still keeps the database on its internal-only network with no host port.

Save frontend files to trigger Fast Refresh in the browser without rebuilding.
API source edits reload on subsequent requests. New migrations and environment
changes require an app restart; dependency changes require restarting the
development container to rerun `npm ci`. Production images do not live-reload.

For host development, start only the database using the same paired files,
then use Node 24 LTS locally:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm ci
cp -n .env.local.example .env.local
# Adjust DATABASE_URL for your password and POSTGRES_PORT.
npm run dev
```

Use `.env` for Compose settings and `.env.local` for the host server. They are
not interchangeable: the local `DATABASE_URL` must use `localhost`, the selected
database port, and the same database password. The copy command preserves an
existing local environment file. When testing a different app port, use
`npm run dev -- --port 3100` and open the corresponding browser URL.

Production and development share the new database volume. Do not run both app
modes at once under the same Compose project; use the paired files consistently
when managing a development stack.

## Environment Variables Reference

The optional `.env` contains only `POSTGRES_PASSWORD`, `APP_BIND_ADDRESS`,
`APP_PORT`, and development-only `POSTGRES_PORT`. Compose sets a server-only
`DATABASE_URL` inside the app. No public database credentials are used. Local
environment files are excluded from image builds.

Validate without starting containers or writing configuration files:

```bash
bash docker/validate.sh
```

## Additional Resources

- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Next.js Docker Documentation](https://nextjs.org/docs/app/getting-started/deploying#docker)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
