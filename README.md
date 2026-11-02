# Salus

Self-hosted personal health tracker built with Next.js 16, PostgreSQL, Tailwind CSS, and Recharts.

## Technology Stack

- **Next.js 16**: React framework with App Router and Server Components
- **PostgreSQL 17**: Database accessed directly by the Next.js server
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Recharts**: Composable charting library for data visualization
- **TypeScript**: Type-safe development

## Getting Started

### Docker

With Docker Engine and Docker Compose v2 available, run:

```bash
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000). There are exactly two services:
the Next.js app on Node 24 LTS and PostgreSQL 17. The database becomes healthy,
then the app applies pending migrations before starting. No cloud account,
API gateway, or manual schema setup is needed.

The app binds to loopback and the database has no published port. Optional
settings are in `.env.docker.example`; copy it to `.env` to override defaults.
Choose a URL-safe database password before first startup on your home server.
This is a private single-user app with no login; do not expose it to the internet.
See [DOCKER.md](DOCKER.md) for persistence, development, and server deployment.

This setup uses a new `postgres-data` volume. Old database volumes are not reused
or deleted. If the old stack is still running, stop its containers first with
`docker compose down --remove-orphans`, without `-v`, from the same project folder.

### MCP Server

An optional MCP server (Python, streamable HTTP) lets an AI agent read and log
data through the app's REST API: add weigh-ins, activities, stress, sleep, and
nutrition; bulk import CSV; find logging gaps; and analyse weight/body
composition trends and energy balance. Start it alongside the app with:

```bash
docker compose --profile mcp up --build -d
```

Point your MCP client at `http://localhost:8000/mcp`. Like the app, it has no
authentication and binds to loopback by default.

### Development

For containerized development with hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open http://localhost:3000. Saving frontend files triggers Next.js Fast Refresh
in the existing browser tab; no image rebuild or manual refresh is needed.
Source files are mounted into the app while dependencies and Next.js output use
separate volumes. The normal production command does not enable live reload.

Alternatively, use Node 24 LTS locally and run only PostgreSQL in Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm ci
cp -n .env.local.example .env.local
# Set DATABASE_URL to match your database password and localhost port.
npm run dev
```

This local option also supports Fast Refresh. The development override publishes
PostgreSQL only on loopback and adds a normal Docker network connection so host
tools can reach it; production keeps the database internal-only and unpublished.
Compose reads `.env`, while local Next.js and migrations read `.env.local`.
Match the password and `POSTGRES_PORT` in both; injected `DATABASE_URL` takes
precedence. Do not run two app servers on the same port. Development and
production currently share the database volume for a given Compose project.

Frontend/API edits reload during development. Adding SQL migrations requires
restarting the app so its startup hook runs; changing environment values also
requires a restart. Dependency changes require rerunning `npm ci` locally or
restarting the development container. Use `Ctrl+C` for the foreground workflow;
use the same paired Compose files with `down` to stop it without deleting data.

### Migrations and Tests

`npm run dev` and `npm start` apply pending SQL files from `db/migrations`.
Run `npm run db:migrate` to apply them separately. Migrations use an advisory lock
and transactional filename/checksum tracking in `schema_migrations`; failures
block startup. Add new numbered SQL files instead of editing applied files, and
keep transaction control statements out of migration SQL. `npm run build` works
without a database. The migrations target a fresh database, not old multi-profile data.

Run `npm test` for unit tests and available Compose checks. Set `TEST_DATABASE_URL`
to also run live PostgreSQL checks in disposable schemas. Compose checks skip when
Docker Compose is unavailable; `COMPOSE_BINARY` may point to a standalone Compose
executable for daemon-free configuration checks.

For production HTTP acceptance checks, set `ACCEPTANCE_URL` to an app connected
to an empty, disposable database when running `npm test`. These checks create
sample records and exercise every existing entry type, profile updates, CSV
import/export, and invalid-input responses. Never use a personal-data instance
for this option. See [DOCKER.md](DOCKER.md#backup-and-restore) for complete
database backups and tested restore commands.

The dashboard's original visual layout and descriptive subtitle are preserved;
the subtitle still names the old stack. The actual backend is PostgreSQL as
described above.

## Project Structure

```
health-tracker/
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   │   └── biometrics/  # Biometric data endpoints
│   ├── layout.tsx       # Root layout component
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/          # React components
│   └── BiometricForm.tsx # Form for adding biometric data
├── lib/                 # Utility functions and configurations
│   ├── db.ts            # Server-only PostgreSQL connection pool
│   └── types.ts         # TypeScript type definitions
├── db/                  # Database schema
│   └── migrations/      # Numbered SQL migrations
├── scripts/             # Migration runner
├── tests/               # Database and deployment checks
├── public/              # Static assets
├── .env.local.example   # Environment variables template
└── package.json         # Project dependencies
```

## Features

- ✅ **Biometric Data Entry**: Add weight and waistline measurements with date and optional notes
- ✅ **Data Persistence**: Store biometric data in PostgreSQL
- ✅ **Extensible Design**: Database schema designed to support multiple types of health metrics
- ✅ **Responsive UI**: Beautiful, accessible form with Tailwind CSS
- ✅ **Data Visualization**: Sample charts with Recharts library
- 🚧 **User Authentication**: Coming soon
- 🚧 **Historical Data Charts**: Visualize your biometric data over time

### Biometric Data

The app currently supports tracking:
- **Weight**: Record your weight in kg or lbs
- **Waistline**: Track waist measurements in cm or inches

The database schema is extensible, making it easy to add more biometric types in the future.

## Development

The application uses:
- ESLint for code linting: `npm run lint`
- TypeScript for type checking
- Tailwind CSS for styling

## License

MIT

