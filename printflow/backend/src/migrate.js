import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './config/db.js';

const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  nome VARCHAR(200) PRIMARY KEY,
  executada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);

const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();

for (const arquivo of arquivos) {
  const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations WHERE nome = $1', [arquivo]);
  if (rowCount) continue;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(pasta, arquivo), 'utf8'));
    await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
    await client.query('COMMIT');
    console.log(`✔ ${arquivo}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`✖ ${arquivo}: ${e.message}`);
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}
await pool.end();
