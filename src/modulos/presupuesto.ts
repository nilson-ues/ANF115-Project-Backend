import { Router } from 'express';
import { z } from 'zod';
import { registrarBitacora } from '../bitacora';
import { cargarEmpresa, cargarLibro, cargarParametros, requerido } from '../datos';
import { pool, transaccion } from '../db';
import { AppError } from '../errores';
import { D, num, txt } from '../finanzas/dinero';
import { estadoResultados } from '../finanzas/estados';
import { MesProyectado, proyectarResultados } from '../finanzas/presupuesto';
import { TEMAS } from '../finanzas/teoria';
import { permitir } from '../middleware/auth';

export const presupuestoRouter = Router();
presupuestoRouter.use(permitir('ADMIN', 'FINANZAS'));

const anioParam = z.coerce.number().int().min(2000).max(2100);

presupuestoRouter.get('/supuestos/:anio', async (req, res) => {
  const anio = anioParam.parse(req.params.anio);
  const { rows } = await pool.query('SELECT mes, inflacion, compras_pct FROM supuestos_mensuales WHERE anio = $1 ORDER BY mes', [anio]);
  res.json({ anio, meses: rows });
});

const esquemaSupuestos = z.array(z.object({
  mes: z.number().int().min(1).max(12),
  inflacion: z.coerce.number().min(-1).max(1),
  compras_pct: z.coerce.number().min(0).max(5)
})).length(12);

presupuestoRouter.put('/supuestos/:anio', async (req, res) => {
  const anio = anioParam.parse(req.params.anio);
  const meses = esquemaSupuestos.parse(req.body);
  await transaccion(async (c) => {
    for (const m of meses) {
      await c.query(
        `INSERT INTO supuestos_mensuales (anio, mes, inflacion, compras_pct) VALUES ($1, $2, $3, $4)
         ON CONFLICT (anio, mes) DO UPDATE SET inflacion = EXCLUDED.inflacion, compras_pct = EXCLUDED.compras_pct`,
        [anio, m.mes, m.inflacion, m.compras_pct]
      );
    }
    await registrarBitacora(req.usuario?.id, 'EDITAR', 'supuestos', anio, meses, c);
  });
  res.json({ ok: true });
});

const LINEAS: { clave: Exclude<keyof MesProyectado, 'mes'>; nombre: string; tipo: string }[] = [
  { clave: 'ventasNetas', nombre: 'Ventas netas', tipo: 'subtotal' },
  { clave: 'inventarioInicial', nombre: 'Inventario inicial', tipo: 'sub' },
  { clave: 'compras', nombre: '(+) Compras', tipo: 'sub' },
  { clave: 'inventarioFinal', nombre: '(-) Inventario final', tipo: 'sub' },
  { clave: 'costoVentas', nombre: '(-) Costo de ventas', tipo: 'detalle' },
  { clave: 'utilidadBruta', nombre: 'Utilidad bruta', tipo: 'subtotal' },
  { clave: 'gastosAdministracion', nombre: 'Gastos de administración', tipo: 'sub' },
  { clave: 'gastosVenta', nombre: 'Gastos de venta', tipo: 'sub' },
  { clave: 'gastosOperacion', nombre: '(-) Gastos de operación', tipo: 'detalle' },
  { clave: 'utilidadOperacion', nombre: 'Utilidad de operación', tipo: 'subtotal' },
  { clave: 'gastosFinancieros', nombre: '(-) Gastos financieros', tipo: 'detalle' },
  { clave: 'utilidadAntesImpuesto', nombre: 'Utilidad antes de impuesto y reserva', tipo: 'subtotal' },
  { clave: 'reservaLegal', nombre: '(-) Reserva legal', tipo: 'detalle' },
  { clave: 'impuestoRenta', nombre: '(-) Impuesto sobre la renta', tipo: 'detalle' },
  { clave: 'utilidadEjercicio', nombre: 'Utilidad del ejercicio', tipo: 'total' }
];

presupuestoRouter.get('/proyeccion/:anio', async (req, res) => {
  const anio = anioParam.parse(req.params.anio);
  const [libro, p, empresa, sup] = await Promise.all([
    cargarLibro('REAL', [anio - 1]),
    cargarParametros(),
    cargarEmpresa(),
    pool.query('SELECT mes, inflacion, compras_pct FROM supuestos_mensuales WHERE anio = $1 ORDER BY mes', [anio])
  ]);
  if (libro.meses(anio - 1).length !== 12) {
    throw new AppError(422, 'SIN_BASE', `Se necesita el año ${anio - 1} completo como base de la proyección`);
  }
  if (sup.rows.length !== 12) throw new AppError(422, 'SIN_SUPUESTOS', `Registre los supuestos mensuales de ${anio}`);
  const base = estadoResultados(libro, anio - 1, 1, 12);
  const crecimiento = requerido(p, 'crecimiento_ventas');
  const { meses, total } = proyectarResultados({
    ventasNetasBase: base.ventasNetas,
    crecimiento,
    inflaciones: sup.rows.map((r) => D(r.inflacion)),
    comprasPct: sup.rows.map((r) => D(r.compras_pct)),
    rebajasVentasPct: requerido(p, 'rebajas_ventas_pct'),
    costoVentasPct: requerido(p, 'costo_ventas_pct'),
    gastosVentaPct: requerido(p, 'gastos_venta_pct'),
    gastosAdministracionPct: requerido(p, 'gastos_administracion_pct'),
    gastosFinancierosMes: requerido(p, 'gastos_financieros_mes'),
    inventarioInicial: libro.saldo('1105', anio - 1, 12),
    reservaPct: requerido(p, 'reserva_legal'),
    reservaAcumulada: libro.saldoGrupo('3102', anio - 1, 12),
    reservaLimite: D(empresa.capital_social).times(requerido(p, 'reserva_legal_limite')),
    isrPct: requerido(p, 'isr')
  });
  res.json({
    anio,
    base: {
      anio: anio - 1,
      ventasNetas: txt(base.ventasNetas),
      inventarioFinal: txt(libro.saldo('1105', anio - 1, 12)),
      reservaLegal: txt(libro.saldoGrupo('3102', anio - 1, 12))
    },
    supuestos: {
      crecimiento: num(crecimiento),
      costoVentasPct: num(p.costo_ventas_pct),
      gastosVentaPct: num(p.gastos_venta_pct),
      gastosAdministracionPct: num(p.gastos_administracion_pct),
      gastosFinancierosMes: num(p.gastos_financieros_mes, 2),
      meses: sup.rows.map((r) => ({ mes: r.mes, inflacion: Number(r.inflacion), comprasPct: Number(r.compras_pct) }))
    },
    lineas: LINEAS.map((l) => ({
      clave: l.clave, nombre: l.nombre, tipo: l.tipo,
      valores: meses.map((m) => txt(m[l.clave] as ReturnType<typeof D>)),
      total: txt(total[l.clave] as ReturnType<typeof D>)
    })),
    rotacionInventario: meses.map((m) => num(m.rotacionInventario)),
    teoria: TEMAS.pronosticoVentas
  });
});
