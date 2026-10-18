import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { registrarBitacora } from '../bitacora';
import { pool } from '../db';
import { noEncontrado } from '../errores';
import { permitir } from '../middleware/auth';

export const usuariosRouter = Router();
usuariosRouter.use(permitir('ADMIN'));

const id = z.coerce.number().int().positive();
const base = {
  nombre: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
  rol: z.enum(['ADMIN', 'VENTAS', 'FINANZAS']),
  activo: z.boolean().default(true)
};
const crear = z.object({ ...base, password: z.string().min(8).max(100) });
const editar = z.object({ ...base, password: z.string().min(8).max(100).optional() });

usuariosRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre');
  res.json(rows);
});

usuariosRouter.post('/', async (req, res) => {
  const d = crear.parse(req.body);
  const hash = await bcrypt.hash(d.password, 10);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, email, rol, activo, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email, rol, activo',
    [d.nombre, d.email, d.rol, d.activo, hash]
  );
  await registrarBitacora(req.usuario?.id, 'CREAR', 'usuario', rows[0].id, { email: d.email, rol: d.rol });
  res.status(201).json(rows[0]);
});

usuariosRouter.put('/:id', async (req, res) => {
  const usuarioId = id.parse(req.params.id);
  const d = editar.parse(req.body);
  const hash = d.password ? await bcrypt.hash(d.password, 10) : null;
  const { rows } = await pool.query(
    `UPDATE usuarios SET nombre = $1, email = $2, rol = $3, activo = $4, password_hash = COALESCE($5, password_hash)
     WHERE id = $6 RETURNING id, nombre, email, rol, activo`,
    [d.nombre, d.email, d.rol, d.activo, hash, usuarioId]
  );
  if (!rows[0]) throw noEncontrado('Usuario no encontrado');
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'usuario', usuarioId, { email: d.email, rol: d.rol, activo: d.activo });
  res.json(rows[0]);
});
