import { Request, Router } from 'express';
import { z } from 'zod';
import { registrarBitacora } from '../bitacora';
import { cargarLibro } from '../datos';
import { pool } from '../db';
import { AppError, noEncontrado } from '../errores';
import { D, dividir, num, sumar, txt } from '../finanzas/dinero';
import { estadoResultados } from '../finanzas/estados';
import { Agrupacion, indicadores } from '../finanzas/movimientos';
import { permitir, TODOS } from '../middleware/auth';

export const categoriasRouter = Router();
export const movimientosRouter = Router();
export const periodosRouter = Router();

const id = z.coerce.number().int().positive();
const tipo = z.enum(['INGRESO', 'GASTO']);
const fecha = z.iso.date();
const monto = z.coerce.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Monto con hasta dos decimales').refine((v) => Number(v) > 0, 'El monto debe ser mayor que cero');
const opcional = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);

// ---------- Categorías ----------

const categoria = z.object({
  nombre: z.string().trim().min(2).max(80),
  tipo,
  cuenta_codigo: opcional(10),
  descripcion: opcional(300),
  activa: z.boolean().default(true)
});

categoriasRouter.get('/', permitir(...TODOS), async (req, res) => {
  const filtro = z.object({ tipo: tipo.optional(), activas: z.enum(['true', 'false']).optional() }).parse(req.query);
  const { rows } = await pool.query(
    `SELECT c.*, cu.nombre AS cuenta_nombre,
       (SELECT COUNT(*)::int FROM movimientos m WHERE m.categoria_id = c.id AND NOT m.anulado) AS movimientos
     FROM categorias c LEFT JOIN cuentas cu ON cu.codigo = c.cuenta_codigo
     WHERE ($1::text IS NULL OR c.tipo = $1) AND ($2::boolean IS NULL OR c.activa = $2)
     ORDER BY c.tipo DESC, c.nombre`,
    [filtro.tipo ?? null, filtro.activas === undefined ? null : filtro.activas === 'true']
  );
  res.json(rows);
});

categoriasRouter.post('/', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const d = categoria.parse(req.body);
  const { rows } = await pool.query(
    'INSERT INTO categorias (nombre, tipo, cuenta_codigo, descripcion, activa) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [d.nombre, d.tipo, d.cuenta_codigo, d.descripcion, d.activa]
  );
  await registrarBitacora(req.usuario?.id, 'CREAR', 'categoria', rows[0].id, d);
  res.status(201).json(rows[0]);
});

categoriasRouter.put('/:id', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const categoriaId = id.parse(req.params.id);
  const d = categoria.parse(req.body);
  const actual = await pool.query('SELECT tipo, (SELECT COUNT(*)::int FROM movimientos WHERE categoria_id = $1) AS usos FROM categorias WHERE id = $1', [categoriaId]);
  if (!actual.rows[0]) throw noEncontrado('Categoría no encontrada');
  if (actual.rows[0].tipo !== d.tipo && actual.rows[0].usos > 0) {
    throw new AppError(409, 'CATEGORIA_EN_USO', 'No se puede cambiar el tipo de una categoría que ya tiene movimientos');
  }
  const { rows } = await pool.query(
    'UPDATE categorias SET nombre = $1, tipo = $2, cuenta_codigo = $3, descripcion = $4, activa = $5 WHERE id = $6 RETURNING *',
    [d.nombre, d.tipo, d.cuenta_codigo, d.descripcion, d.activa, categoriaId]
  );
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'categoria', categoriaId, d);
  res.json(rows[0]);
});

// ---------- Movimientos ----------

const movimiento = z.object({
  fecha,
  tipo,
  categoria_id: id,
  concepto: z.string().trim().min(3).max(200),
  monto,
  forma_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'CREDITO']).default('EFECTIVO'),
  referencia: opcional(60)
});

const filtros = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  tipo: tipo.optional(),
  categoria_id: id.optional(),
  estado: z.enum(['activos', 'anulados', 'todos']).default('activos'),
  q: z.string().trim().max(100).optional()
}).refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, { message: 'La fecha inicial debe ser anterior a la final', path: ['desde'] });

type Filtros = z.infer<typeof filtros>;

function where(f: Filtros, alias = 'm') {
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  const agregar = (sql: string, valor: unknown) => {
    valores.push(valor);
    condiciones.push(sql.replace('?', `$${valores.length}`));
  };
  if (f.desde) agregar(`${alias}.fecha >= ?`, f.desde);
  if (f.hasta) agregar(`${alias}.fecha <= ?`, f.hasta);
  if (f.tipo) agregar(`${alias}.tipo = ?`, f.tipo);
  if (f.categoria_id) agregar(`${alias}.categoria_id = ?`, f.categoria_id);
  if (f.q) agregar(`(${alias}.concepto ILIKE ? OR ${alias}.referencia ILIKE $${valores.length})`, `%${f.q}%`);
  if (f.estado === 'activos') condiciones.push(`NOT ${alias}.anulado`);
  if (f.estado === 'anulados') condiciones.push(`${alias}.anulado`);
  return { sql: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', valores };
}

async function periodoCerrado(f: string) {
  const { rows } = await pool.query(
    `SELECT 1 FROM periodos WHERE anio = $1 AND mes = $2 AND estado = 'CERRADO'`,
    [Number(f.slice(0, 4)), Number(f.slice(5, 7))]
  );
  return rows.length > 0;
}

async function exigirPeriodoAbierto(f: string) {
  if (await periodoCerrado(f)) {
    throw new AppError(409, 'PERIODO_CERRADO', `El período ${f.slice(0, 7)} está cerrado; no admite cambios`);
  }
}

async function validarCategoria(categoriaId: number, t: string) {
  const { rows } = await pool.query('SELECT tipo, activa FROM categorias WHERE id = $1', [categoriaId]);
  if (!rows[0]) throw new AppError(422, 'CATEGORIA_INVALIDA', 'La categoría no existe');
  if (rows[0].tipo !== t) throw new AppError(422, 'CATEGORIA_INVALIDA', 'La categoría no corresponde al tipo de movimiento');
  if (!rows[0].activa) throw new AppError(422, 'CATEGORIA_INVALIDA', 'La categoría está desactivada');
}

function exigirPermisoTipo(req: Request, t: string) {
  // el rol VENTAS solo registra ingresos
  if (req.usuario?.rol === 'VENTAS' && t !== 'INGRESO') {
    throw new AppError(403, 'FORBIDDEN', 'Su rol solo puede registrar ingresos');
  }
}

const SELECT_MOV = `SELECT m.id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.tipo, m.categoria_id, c.nombre AS categoria,
  m.concepto, m.monto, m.forma_pago, m.referencia, m.anulado, m.motivo_anulacion, u.nombre AS usuario, m.creado_en
  FROM movimientos m JOIN categorias c ON c.id = m.categoria_id LEFT JOIN usuarios u ON u.id = m.usuario_id`;

movimientosRouter.get('/', permitir(...TODOS), async (req, res) => {
  const f = filtros.parse(req.query);
  const { pagina, tamano } = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    tamano: z.coerce.number().int().min(1).max(500).default(50)
  }).parse(req.query);
  const w = where(f);
  const [datos, totales] = await Promise.all([
    pool.query(`${SELECT_MOV} ${w.sql} ORDER BY m.fecha DESC, m.id DESC LIMIT ${tamano} OFFSET ${(pagina - 1) * tamano}`, w.valores),
    pool.query(
      `SELECT COUNT(*)::int AS total,
         COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO' AND NOT m.anulado), 0) AS ingresos,
         COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO' AND NOT m.anulado), 0) AS gastos
       FROM movimientos m ${w.sql}`,
      w.valores
    )
  ]);
  const t = totales.rows[0];
  res.json({ datos: datos.rows, total: t.total, pagina, tamano, indicadores: formatear(indicadores(t.ingresos, t.gastos)) });
});

movimientosRouter.post('/', permitir(...TODOS), async (req, res) => {
  const d = movimiento.parse(req.body);
  exigirPermisoTipo(req, d.tipo);
  await validarCategoria(d.categoria_id, d.tipo);
  await exigirPeriodoAbierto(d.fecha);
  const { rows } = await pool.query(
    `INSERT INTO movimientos (fecha, tipo, categoria_id, concepto, monto, forma_pago, referencia, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [d.fecha, d.tipo, d.categoria_id, d.concepto, d.monto, d.forma_pago, d.referencia, req.usuario?.id ?? null]
  );
  await registrarBitacora(req.usuario?.id, 'CREAR', 'movimiento', rows[0].id, d);
  const creado = await pool.query(`${SELECT_MOV} WHERE m.id = $1`, [rows[0].id]);
  res.status(201).json(creado.rows[0]);
});

async function cargarMovimiento(movId: number) {
  const { rows } = await pool.query(`SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, anulado FROM movimientos WHERE id = $1`, [movId]);
  if (!rows[0]) throw noEncontrado('Movimiento no encontrado');
  return rows[0];
}

movimientosRouter.put('/:id', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const movId = id.parse(req.params.id);
  const d = movimiento.parse(req.body);
  const actual = await cargarMovimiento(movId);
  if (actual.anulado) throw new AppError(409, 'ANULADO', 'Un movimiento anulado no se puede modificar');
  await exigirPeriodoAbierto(actual.fecha);
  await exigirPeriodoAbierto(d.fecha);
  await validarCategoria(d.categoria_id, d.tipo);
  await pool.query(
    `UPDATE movimientos SET fecha = $1, tipo = $2, categoria_id = $3, concepto = $4, monto = $5, forma_pago = $6, referencia = $7
     WHERE id = $8`,
    [d.fecha, d.tipo, d.categoria_id, d.concepto, d.monto, d.forma_pago, d.referencia, movId]
  );
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'movimiento', movId, d);
  const editado = await pool.query(`${SELECT_MOV} WHERE m.id = $1`, [movId]);
  res.json(editado.rows[0]);
});

movimientosRouter.patch('/:id/anular', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const movId = id.parse(req.params.id);
  const { motivo } = z.object({ motivo: z.string().trim().min(5).max(300) }).parse(req.body);
  const actual = await cargarMovimiento(movId);
  if (actual.anulado) throw new AppError(409, 'ANULADO', 'El movimiento ya está anulado');
  await exigirPeriodoAbierto(actual.fecha);
  await pool.query(
    'UPDATE movimientos SET anulado = TRUE, motivo_anulacion = $1, anulado_por = $2, anulado_en = now() WHERE id = $3',
    [motivo, req.usuario?.id ?? null, movId]
  );
  await registrarBitacora(req.usuario?.id, 'ANULAR', 'movimiento', movId, { motivo });
  res.json({ id: movId, anulado: true, motivo_anulacion: motivo });
});

// ---------- Panel y reportes ----------

function formatear(i: ReturnType<typeof indicadores>) {
  return {
    ingresos: txt(i.ingresos),
    gastos: txt(i.gastos),
    resultado: txt(i.resultado),
    porcentajeGastos: num(i.porcentajeGastos, 2)
  };
}

async function rangoPorDefecto(f: Filtros) {
  if (f.desde && f.hasta) return f;
  const { rows } = await pool.query(`SELECT to_char(MAX(fecha), 'YYYY-MM-DD') AS ultima FROM movimientos WHERE NOT anulado`);
  const ultima: string = rows[0].ultima ?? new Date().toISOString().slice(0, 10);
  return { ...f, desde: f.desde ?? `${ultima.slice(0, 4)}-01-01`, hasta: f.hasta ?? `${ultima.slice(0, 4)}-12-31` };
}

movimientosRouter.get('/resumen', permitir(...TODOS), async (req, res) => {
  const f = await rangoPorDefecto(filtros.parse(req.query));
  const w = where({ ...f, estado: 'activos' });
  const [totales, porMes, porCategoria, ultimos, anios] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO'), 0) AS ingresos,
              COALESCE(SUM(monto) FILTER (WHERE tipo = 'GASTO'), 0) AS gastos, COUNT(*)::int AS cantidad
       FROM movimientos m ${w.sql}`, w.valores),
    pool.query(
      `SELECT to_char(m.fecha, 'YYYY-MM') AS periodo,
              COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO'), 0) AS ingresos,
              COALESCE(SUM(monto) FILTER (WHERE tipo = 'GASTO'), 0) AS gastos
       FROM movimientos m ${w.sql} GROUP BY 1 ORDER BY 1`, w.valores),
    pool.query(
      `SELECT c.id, c.nombre, m.tipo, SUM(m.monto) AS monto, COUNT(*)::int AS cantidad
       FROM movimientos m JOIN categorias c ON c.id = m.categoria_id ${w.sql}
       GROUP BY c.id, c.nombre, m.tipo ORDER BY m.tipo DESC, SUM(m.monto) DESC`, w.valores),
    pool.query(`${SELECT_MOV} ${w.sql} ORDER BY m.fecha DESC, m.id DESC LIMIT 8`, w.valores),
    pool.query(`SELECT DISTINCT EXTRACT(YEAR FROM fecha)::int AS anio FROM movimientos WHERE NOT anulado ORDER BY 1 DESC`)
  ]);
  const t = totales.rows[0];
  res.json({
    desde: f.desde, hasta: f.hasta,
    anios: anios.rows.map((r) => r.anio),
    cantidad: t.cantidad,
    indicadores: formatear(indicadores(t.ingresos, t.gastos)),
    porMes: porMes.rows.map((r) => ({ periodo: r.periodo, ...formatear(indicadores(r.ingresos, r.gastos)) })),
    porCategoria: porCategoria.rows.map((r) => {
      const base = D(r.tipo === 'INGRESO' ? t.ingresos : t.gastos);
      const participacion = dividir(D(r.monto), base);
      return { id: r.id, nombre: r.nombre, tipo: r.tipo, monto: txt(D(r.monto)), cantidad: r.cantidad, participacion: num(participacion && participacion.times(100), 2) };
    }),
    ultimos: ultimos.rows
  });
});

movimientosRouter.get('/reporte', permitir(...TODOS), async (req, res) => {
  const f = await rangoPorDefecto(filtros.parse(req.query));
  const agrupar = z.enum(['dia', 'mes', 'anio']).default('mes').parse(req.query.agrupar) as Agrupacion;
  const w = where({ ...f, estado: 'activos' });
  const formato = agrupar === 'anio' ? 'YYYY' : agrupar === 'mes' ? 'YYYY-MM' : 'YYYY-MM-DD';
  const [periodos, categorias] = await Promise.all([
    pool.query(
      `SELECT to_char(m.fecha, '${formato}') AS periodo,
              COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO'), 0) AS ingresos,
              COALESCE(SUM(monto) FILTER (WHERE tipo = 'GASTO'), 0) AS gastos, COUNT(*)::int AS cantidad
       FROM movimientos m ${w.sql} GROUP BY 1 ORDER BY 1`, w.valores),
    pool.query(
      `SELECT c.nombre, m.tipo, to_char(m.fecha, '${formato}') AS periodo, SUM(m.monto) AS monto
       FROM movimientos m JOIN categorias c ON c.id = m.categoria_id ${w.sql}
       GROUP BY 1, 2, 3 ORDER BY 2 DESC, 1, 3`, w.valores)
  ]);
  const filas = periodos.rows.map((r) => ({ periodo: r.periodo, cantidad: r.cantidad, ...formatear(indicadores(r.ingresos, r.gastos)) }));
  const ingresos = sumar(periodos.rows.map((r) => D(r.ingresos)));
  const gastos = sumar(periodos.rows.map((r) => D(r.gastos)));

  type FilaCategoria = { nombre: string; tipo: string; periodos: Record<string, string>; total: string };
  const mapa = new Map<string, FilaCategoria>();
  for (const r of categorias.rows) {
    const clave = `${r.tipo}|${r.nombre}`;
    const fila: FilaCategoria = mapa.get(clave) ?? { nombre: r.nombre, tipo: r.tipo, periodos: {}, total: '0.00' };
    fila.periodos[r.periodo] = txt(D(r.monto));
    fila.total = txt(D(fila.total).plus(D(r.monto)));
    mapa.set(clave, fila);
  }

  res.json({
    desde: f.desde, hasta: f.hasta, agrupar,
    filas,
    categorias: Array.from(mapa.values()),
    totales: formatear(indicadores(ingresos, gastos)),
    conciliacion: f.tipo || f.categoria_id || f.q ? [] : await conciliar(f.desde!, f.hasta!, filas)
  });
});

// Compara el resultado de los movimientos con la utilidad antes de impuesto y reserva de los años completos
async function conciliar(desde: string, hasta: string, filas: { periodo: string; resultado: string }[]) {
  const anios: number[] = [];
  for (let a = Number(desde.slice(0, 4)); a <= Number(hasta.slice(0, 4)); a++) {
    if (desde <= `${a}-01-01` && hasta >= `${a}-12-31`) anios.push(a);
  }
  if (anios.length === 0) return [];
  const libro = await cargarLibro('REAL', anios);
  const resultadoAnio = (a: number) => sumar(filas.filter((f) => f.periodo.startsWith(String(a))).map((f) => D(f.resultado)));
  return anios.filter((a) => libro.meses(a).length === 12).map((a) => {
    const uai = estadoResultados(libro, a, 1, 12).utilidadAntesImpuesto;
    const resultado = resultadoAnio(a);
    return { anio: a, resultadoMovimientos: txt(resultado), utilidadAntesImpuesto: txt(uai), diferencia: txt(resultado.minus(uai)) };
  });
}

// ---------- Períodos ----------

periodosRouter.get('/', permitir('ADMIN', 'FINANZAS'), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.anio, p.mes, p.estado, p.cerrado_en,
       (SELECT COUNT(*)::int FROM movimientos m WHERE EXTRACT(YEAR FROM m.fecha) = p.anio AND EXTRACT(MONTH FROM m.fecha) = p.mes AND NOT m.anulado) AS movimientos
     FROM periodos p ORDER BY p.anio DESC, p.mes DESC`
  );
  res.json(rows);
});

const periodo = z.object({ anio: z.coerce.number().int().min(2000).max(2100), mes: z.coerce.number().int().min(1).max(12) });

periodosRouter.post('/:anio/:mes/cerrar', permitir('ADMIN', 'FINANZAS'), async (req, res) => {
  const p = periodo.parse(req.params);
  await pool.query(
    `INSERT INTO periodos (anio, mes, estado, cerrado_en) VALUES ($1, $2, 'CERRADO', now())
     ON CONFLICT (anio, mes) DO UPDATE SET estado = 'CERRADO', cerrado_en = now()`,
    [p.anio, p.mes]
  );
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'periodo', `${p.anio}-${p.mes}`, { estado: 'CERRADO' });
  res.json({ ...p, estado: 'CERRADO' });
});

periodosRouter.post('/:anio/:mes/abrir', permitir('ADMIN'), async (req, res) => {
  const p = periodo.parse(req.params);
  const { rowCount } = await pool.query(`UPDATE periodos SET estado = 'ABIERTO', cerrado_en = NULL WHERE anio = $1 AND mes = $2`, [p.anio, p.mes]);
  if (!rowCount) throw noEncontrado('Período no encontrado');
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'periodo', `${p.anio}-${p.mes}`, { estado: 'ABIERTO' });
  res.json({ ...p, estado: 'ABIERTO' });
});
