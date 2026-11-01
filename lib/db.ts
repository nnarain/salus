import 'server-only';
import { Pool, types, type QueryResultRow } from 'pg';

types.setTypeParser(types.builtins.NUMERIC, Number);
types.setTypeParser(types.builtins.DATE, (value) => value);

const databaseGlobal = globalThis as typeof globalThis & {
  healthTrackerPool?: Pool;
};

function getPool(): Pool {
  if (!databaseGlobal.healthTrackerPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be set to connect to PostgreSQL');
    }

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
    pool.on('error', (error) => {
      console.error('Unexpected PostgreSQL pool error:', error);
    });
    databaseGlobal.healthTrackerPool = pool;
  }

  return databaseGlobal.healthTrackerPool;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<Row[]> {
  const result = await getPool().query<Row>(text, values);
  return result.rows;
}