import { Router } from 'express';
import { z } from 'zod';
import { registrarBitacora } from '../bitacora';
import { pool, transaccion } from '../db';
import { noEncontrado } from '../errores';
import { RAZONES } from '../finanzas/teoria';
import { permitir, TODOS } from '../middleware/auth';

export const empresaRouter = Router();

const dinero = z.coerce.number().nonnegative().multipleOf(0.01);

const esquemaEmpresa = z.object({
  razon_social: z.string().trim().min(3).max(200),
  nombre_comercial: z.string().trim().min(2).max(120),
  giro: z.string().trim().min(3),
  direccion: z.string().trim().min(3),
  fecha_constitucion: z.iso.date(),
  tipo_empresa: z.string().trim().min(3).max(40),
  tamano: z.string().trim().min(3).max(40),
  capital_social: dinero,
  capital_minimo: dinero,
  capital_variable: dinero,
  numero_acciones: z.coerce.number().int().positive(),
  valor_nominal_accion: dinero,
  mision: z.string().trim().nullable().optional(),
  vision: z.string().trim().nullable().optional()
});

empresaRouter.get('/empresa', permitir(...TODOS), async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM empresa WHERE id = 1');
  if (!rows[0]) throw noEncontrado('Datos de la empresa no registrados');
  res.json(rows[0]);
});

empresaRouter.put('/empresa', permitir('ADMIN'), async (req, res) => {
  const d = esquemaEmpresa.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE empresa SET razon_social = $1, nombre_comercial = $2, giro = $3, direccion = $4, fecha_constitucion = $5,
       tipo_empresa = $6, tamano = $7, capital_social = $8, capital_minimo = $9, capital_variable = $10,
       numero_acciones = $11, valor_nominal_accion = $12, mision = $13, vision = $14
     WHERE id = 1 RETURNING *`,
    [d.razon_social, d.nombre_comercial, d.giro, d.direccion, d.fecha_constitucion, d.tipo_empresa, d.tamano,
     d.capital_social, d.capital_minimo, d.capital_variable, d.numero_acciones, d.valor_nominal_accion, d.mision ?? null, d.vision ?? null]
  );
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'empresa', 1, d);
  res.json(rows[0]);
});

empresaRouter.get('/parametros', permitir(...TODOS), async (_req, res) => {
  const { rows } = await pool.query('SELECT clave, nombre, grupo, unidad, valor, descripcion FROM parametros ORDER BY grupo, nombre');
  res.json(rows);
});

const esquemaParametros = z.array(z.object({
  clave: z.string().min(1).max(40),
  valor: z.coerce.number().min(-1000000000).max(1000000000).nullable()
})).min(1);

empresaRouter.put('/parametros', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const cambios = esquemaParametros.parse(req.body);
  await transaccion(async (c) => {
    for (const p of cambios) {
      const r = await c.query('UPDATE parametros SET valor = $1 WHERE clave = $2', [p.valor, p.clave]);
      if (r.rowCount === 0) throw noEncontrado(`Parámetro ${p.clave} no existe`);
    }
    await registrarBitacora(req.usuario?.id, 'EDITAR', 'parametros', 'varios', cambios, c);
  });
  const { rows } = await pool.query('SELECT clave, nombre, grupo, unidad, valor, descripcion FROM parametros ORDER BY grupo, nombre');
  res.json(rows);
});

empresaRouter.get('/estandares', permitir(...TODOS), async (_req, res) => {
  const { rows } = await pool.query('SELECT clave, valor, fuente FROM razones_estandar');
  const mapa = new Map(rows.map((r) => [r.clave, r]));
  res.json(RAZONES.map((r) => ({
    clave: r.clave, nombre: r.nombre, categoria: r.categoria, unidad: r.unidad,
    valor: mapa.get(r.clave)?.valor ?? null, fuente: mapa.get(r.clave)?.fuente ?? null
  })));
});

const esquemaEstandares = z.array(z.object({
  clave: z.enum(RAZONES.map((r) => r.clave) as [string, ...string[]]),
  valor: z.coerce.number().nullable(),
  fuente: z.string().trim().max(200).nullable().optional()
})).min(1);

empresaRouter.put('/estandares', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const datos = esquemaEstandares.parse(req.body);
  await transaccion(async (c) => {
    for (const e of datos) {
      await c.query(
        `INSERT INTO razones_estandar (clave, valor, fuente) VALUES ($1, $2, $3)
         ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, fuente = EXCLUDED.fuente`,
        [e.clave, e.valor, e.fuente ?? null]
      );
    }
    await registrarBitacora(req.usuario?.id, 'EDITAR', 'estandares', 'varios', datos, c);
  });
  res.json({ ok: true });
});

empresaRouter.get('/bitacora', permitir('ADMIN'), async (req, res) => {
  const limite = z.coerce.number().int().min(1).max(500).default(100).parse(req.query.limite);
  const { rows } = await pool.query(
    `SELECT b.id, b.accion, b.entidad, b.entidad_id, b.detalle, b.creado_en, u.nombre AS usuario
     FROM bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id ORDER BY b.id DESC LIMIT $1`,
    [limite]
  );
  res.json(rows);
});
