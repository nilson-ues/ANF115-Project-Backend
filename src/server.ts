import { crearApp } from './app';
import { config } from './config';
import { pool } from './db';

async function iniciar() {
  await pool.query('SELECT 1');
  crearApp().listen(config.PORT, () => {
    console.log(`API DistriFarma escuchando en http://localhost:${config.PORT}/api`);
  });
}

iniciar().catch((error) => {
  console.error('No se pudo iniciar la API:', error.message);
  process.exit(1);
});
