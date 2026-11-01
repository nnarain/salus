import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const migrationLock = 20261031;

export async function applyMigrations(client, directory = migrationDirectory) {
  const filenames = (await readdir(directory)).filter((filename) => filename.endsWith('.sql')).sort();
  if (filenames.length === 0) throw new Error('No database migrations found');

  const versions = new Set();
  const migrations = [];
  for (const filename of filenames) {
    const match = /^(\d+)_.*\.sql$/.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const version = Number(match[1]);
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`);
    versions.add(version);
    const sql = await readFile(resolve(directory, filename), 'utf8');
    migrations.push({ version, filename, sql, checksum: createHash('sha256').update(sql).digest('hex') });
  }
  migrations.sort((first, second) => first.version - second.version);

  await client.query('SELECT pg_advisory_lock($1)', [migrationLock]);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);
    const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
    for (const applied of rows) {
      const migration = migrations.find((entry) => entry.filename === applied.filename);
      if (!migration || migration.checksum !== applied.checksum) {
        throw new Error(`Applied migration is missing or changed: ${applied.filename}`);
      }
    }

    const applied = new Set(rows.map((row) => row.filename));
    for (const migration of migrations) {
      if (applied.has(migration.filename)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [migration.filename, migration.checksum],
        );
        await client.query('COMMIT');
        console.log(`Applied migration: ${migration.filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [migrationLock]);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set to run database migrations');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await applyMigrations(client);
    console.log('Database migrations are up to date');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Database migrations failed:', error.message);
    process.exitCode = 1;
  });
}