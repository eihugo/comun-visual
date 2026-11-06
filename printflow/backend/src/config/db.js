import pg from 'pg';
import { env } from './env.js';

pg.types.setTypeParser(20, (v) => Number(v)); // BIGINT -> number
pg.types.setTypeParser(1082, (v) => v); // DATE -> 'AAAA-MM-DD'

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

export const query = (texto, params) => pool.query(texto, params);

// Executa várias queries juntas: se qualquer uma falhar, nada é gravado.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
