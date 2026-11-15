import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { manejadorErrores, rutaNoEncontrada } from './errores';
import { autenticar } from './middleware/auth';
import { analisisRouter } from './modulos/analisis';
import { authRouter } from './modulos/auth';
import { catalogosRouter } from './modulos/catalogos';
import { dashboardRouter } from './modulos/dashboard';
import { empresaRouter } from './modulos/empresa';
import { estadosRouter } from './modulos/estados';
import { categoriasRouter, movimientosRouter, periodosRouter } from './modulos/movimientos';
import { circulanteRouter, planeacionRouter } from './modulos/planeacion';
import { presupuestoRouter } from './modulos/presupuesto';
import { usuariosRouter } from './modulos/usuarios';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  // En Azure la API está detrás de un proxy; necesario para el límite de intentos de login
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api', autenticar);
  app.use('/api/usuarios', usuariosRouter);
  app.use('/api/configuracion', empresaRouter);
  app.use('/api/catalogos', catalogosRouter);
  app.use('/api/estados', estadosRouter);
  app.use('/api/analisis', analisisRouter);
  app.use('/api/presupuesto', presupuestoRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/categorias', categoriasRouter);
  app.use('/api/movimientos', movimientosRouter);
  app.use('/api/periodos', periodosRouter);
  app.use('/api/planeacion', planeacionRouter);
  app.use('/api/circulante', circulanteRouter);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}
