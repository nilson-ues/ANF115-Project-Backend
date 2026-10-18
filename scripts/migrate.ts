import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db';

async function migrar() {
  const reset = process.argv.includes('--reset');
  const cliente = await pool.connect();
  try {
    if (reset) {
      await cliente.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('Esquema reiniciado');
    }
    await cliente.query(`CREATE TABLE IF NOT EXISTS schema_migraciones (
      archivo VARCHAR(200) PRIMARY KEY, aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const { rows } = await cliente.query('SELECT archivo FROM schema_migraciones');
    const aplicadas = new Set(rows.map((r) => r.archivo));
    const carpeta = path.join(__dirname, '..', 'db', 'migrations');
    const archivos = fs.readdirSync(carpeta).filter((a) => a.endsWith('.sql')).sort();
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO schema_migraciones (archivo) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
        console.log(`Aplicada ${archivo}`);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      }
    }
    console.log('Migraciones al día');
  } finally {
    cliente.release();
    await pool.end();
  }
}

migrar().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
