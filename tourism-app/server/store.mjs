import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { emptyState } from './core.mjs';

export async function openStore() {
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    // Run schema.sql explicitly before enabling PostgreSQL; no automatic schema changes.
    const result = await pool.query('SELECT state FROM tourism_demo_state WHERE id = 1');
    return {
      state: result.rows[0]?.state ?? emptyState(),
      save: state => pool.query('INSERT INTO tourism_demo_state(id, state) VALUES (1, $1) ON CONFLICT(id) DO UPDATE SET state = EXCLUDED.state', [state]),
      close: () => pool.end()
    };
  }
  const directory = process.env.DATA_DIRECTORY ? resolve(process.env.DATA_DIRECTORY) : fileURLToPath(new URL('../data/', import.meta.url));
  const path = join(directory, 'state.json');
  await mkdir(directory, { recursive: true });
  let state;
  try { state = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = emptyState(); }
  if (!state || !Array.isArray(state.points) || !Object.hasOwn(state, 'latest')) throw new Error('Invalid saved state; preserve the file and inspect it before restarting');
  return {
    state,
    async save(next) { await writeFile(`${path}.tmp`, JSON.stringify(next), 'utf8'); await rename(`${path}.tmp`, path); },
    async close() {}
  };
}
