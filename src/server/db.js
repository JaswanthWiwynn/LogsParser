import pg from 'pg'

const { Pool } = pg

/** @type {import('pg').Pool | null} */
let pool = null

export function getPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Run `neon deploy` or `neon env pull`.')
  }
  if (!pool) {
    // Pooled URL for app traffic (Neon guidance for web apps).
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export async function ensureSchema() {
  const client = await getPool().connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS parse_runs (
        id BIGSERIAL PRIMARY KEY,
        source_file TEXT NOT NULL,
        total_rows INT NOT NULL DEFAULT 0,
        failed_rows INT NOT NULL DEFAULT 0,
        retrieved_ok INT NOT NULL DEFAULT 0,
        retrieved_error INT NOT NULL DEFAULT 0,
        neon_branch TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } finally {
    client.release()
  }
}

export async function insertParseRun(run) {
  const result = await getPool().query(
    `INSERT INTO parse_runs
      (source_file, total_rows, failed_rows, retrieved_ok, retrieved_error, neon_branch)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, source_file, total_rows, failed_rows, retrieved_ok, retrieved_error, neon_branch, created_at`,
    [
      run.sourceFile,
      run.totalRows,
      run.failedRows,
      run.retrievedOk,
      run.retrievedError,
      process.env.NEON_BRANCH || null,
    ],
  )
  return result.rows[0]
}

export async function listParseRuns(limit = 20) {
  const result = await getPool().query(
    `SELECT id, source_file, total_rows, failed_rows, retrieved_ok, retrieved_error, neon_branch, created_at
     FROM parse_runs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
  return result.rows
}

export async function pingDatabase() {
  const result = await getPool().query(
    'SELECT 1 AS ok, current_database() AS database, now() AS server_time',
  )
  return result.rows[0]
}
