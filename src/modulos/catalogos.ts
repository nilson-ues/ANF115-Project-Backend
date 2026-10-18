import { Router } from 'express';
import { z } from 'zod';
import { registrarBitacora } from '../bitacora';
import { pool } from '../db';
import { noEncontrado } from '../errores';
import { permitir, Rol, TODOS } from '../middleware/auth';

export const catalogosRouter = Router();

const id = z.coerce.number().int().positive();
const texto = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const dinero = z.coerce.number().nonnegative().multipleOf(0.01);

interface Catalogo {
  ruta: string;
  tabla: string;
  entidad: string;
  escritura: Rol[];
  esquema: z.ZodObject;
  listado: string;
}

const catalogos: Catalogo[] = [
  {
    ruta: 'lineas', tabla: 'lineas', entidad: 'linea', escritura: ['ADMIN', 'FINANZAS'],
    esquema: z.object({
      nombre: z.string().trim().min(2).max(80),
      linea_padre_id: id.nullable().optional().transform((v) => v ?? null),
      activo: z.boolean().default(true)
    }),
    listado: `SELECT l.*, p.nombre AS linea_padre FROM lineas l LEFT JOIN lineas p ON p.id = l.linea_padre_id
              ORDER BY COALESCE(p.nombre, l.nombre), l.linea_padre_id NULLS FIRST, l.nombre`
  },
  {
    ruta: 'proveedores', tabla: 'proveedores', entidad: 'proveedor', escritura: ['ADMIN', 'FINANZAS'],
    esquema: z.object({
      nombre: z.string().trim().min(2).max(160),
      origen: z.enum(['LOCAL', 'EXTERIOR']),
      pais: z.string().trim().min(2).max(60),
      nit: texto(20),
      telefono: texto(30),
      email: z.union([z.email(), z.literal(''), z.null()]).optional().transform((v) => v || null),
      plazo_credito_dias: z.coerce.number().int().min(0).max(365),
      activo: z.boolean().default(true)
    }),
    listado: 'SELECT * FROM proveedores ORDER BY nombre'
  },
  {
    ruta: 'clientes', tabla: 'clientes', entidad: 'cliente', escritura: ['ADMIN', 'VENTAS'],
    esquema: z.object({
      nombre: z.string().trim().min(2).max(160),
      tipo: z.enum(['PUBLICO', 'PRIVADO']),
      nit: texto(20),
      telefono: texto(30),
      email: z.union([z.email(), z.literal(''), z.null()]).optional().transform((v) => v || null),
      direccion: texto(300),
      plazo_credito_dias: z.coerce.number().int().min(0).max(365),
      limite_credito: dinero,
      descuento_pronto_pago: z.coerce.number().min(0).max(0.5),
      dias_pronto_pago: z.coerce.number().int().min(0).max(365),
      activo: z.boolean().default(true)
    }),
    listado: 'SELECT * FROM clientes ORDER BY nombre'
  },
  {
    ruta: 'productos', tabla: 'productos', entidad: 'producto', escritura: ['ADMIN', 'FINANZAS'],
    esquema: z.object({
      codigo: z.string().trim().toUpperCase().min(2).max(20),
      nombre: z.string().trim().min(2).max(200),
      linea_id: id,
      proveedor_id: id,
      unidad: z.string().trim().min(1).max(20),
      precio_venta: dinero,
      existencia_minima: z.coerce.number().nonnegative(),
      activo: z.boolean().default(true)
    }),
    listado: `SELECT p.*, l.nombre AS linea, pr.nombre AS proveedor,
                (p.existencia <= p.existencia_minima) AS bajo_minimo,
                ROUND(p.existencia * p.costo_promedio, 2) AS valor_inventario
              FROM productos p JOIN lineas l ON l.id = p.linea_id JOIN proveedores pr ON pr.id = p.proveedor_id
              ORDER BY p.codigo`
  }
];

for (const cat of catalogos) {
  catalogosRouter.get(`/${cat.ruta}`, permitir(...TODOS), async (_req, res) => {
    const { rows } = await pool.query(cat.listado);
    res.json(rows);
  });

  catalogosRouter.post(`/${cat.ruta}`, permitir(...cat.escritura), async (req, res) => {
    const datos = cat.esquema.parse(req.body) as Record<string, unknown>;
    const columnas = Object.keys(datos);
    const { rows } = await pool.query(
      `INSERT INTO ${cat.tabla} (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      Object.values(datos)
    );
    await registrarBitacora(req.usuario?.id, 'CREAR', cat.entidad, rows[0].id, datos);
    res.status(201).json(rows[0]);
  });

  catalogosRouter.put(`/${cat.ruta}/:id`, permitir(...cat.escritura), async (req, res) => {
    const registroId = id.parse(req.params.id);
    const datos = cat.esquema.parse(req.body) as Record<string, unknown>;
    const columnas = Object.keys(datos);
    const { rows } = await pool.query(
      `UPDATE ${cat.tabla} SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columnas.length + 1} RETURNING *`,
      [...Object.values(datos), registroId]
    );
    if (!rows[0]) throw noEncontrado();
    await registrarBitacora(req.usuario?.id, 'EDITAR', cat.entidad, registroId, datos);
    res.json(rows[0]);
  });
}

catalogosRouter.get('/cuentas', permitir('ADMIN', 'FINANZAS'), async (_req, res) => {
  const { rows } = await pool.query('SELECT codigo, nombre, tipo, naturaleza, padre_codigo, nivel, acepta_movimiento FROM cuentas ORDER BY codigo');
  res.json(rows);
});
