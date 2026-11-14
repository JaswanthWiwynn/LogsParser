import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!connectionString) {
  console.error('Missing DATABASE_URL_UNPOOLED / DATABASE_URL. Run `neon deploy` first.')
  process.exit(1)
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
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
const check = await client.query(
  `SELECT to_regclass('public.parse_runs') AS table_name, current_database() AS database`,
)
console.log('Schema ready:', check.rows[0])
await client.end()
