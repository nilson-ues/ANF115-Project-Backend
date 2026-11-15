import { Router } from 'express';
import { z } from 'zod';
import { registrarBitacora } from '../bitacora';
import { cargarLibro } from '../datos';
import { pool } from '../db';
import { AppError, noEncontrado } from '../errores';
import { D, Decimal, num, sumar, txt } from '../finanzas/dinero';
import { estadoResultados } from '../finanzas/estados';
import {
  cicloEfectivo, eva, MesCaja, periodoRecuperacion, politicaCredito, presupuestoCaja, pronosticoVentas,
  ratioIncremento, tir, valorPresente, vpn
} from '../finanzas/planeacion';
import { permitir } from '../middleware/auth';
import { contextoRazones, razonesPeriodo } from './analisis';

export const planeacionRouter = Router();
export const circulanteRouter = Router();
planeacionRouter.use(permitir('ADMIN', 'FINANZAS'));
circulanteRouter.use(permitir('ADMIN', 'FINANZAS'));

const valor = z.coerce.number().finite();
const pct = z.coerce.number().min(0).max(1);
const anio = z.coerce.number().int().min(2000).max(2100);

// ---------- Presupuesto de caja ----------

const esquemaCaja = z.object({
  ventasBase: z.array(valor.nonnegative()).length(12),
  ratio: z.coerce.number().min(-0.99).max(10).nullable().optional(),
  saldoInicial: valor,
  costoPct: pct,
  gastosVentaPct: pct,
  gastosAdministracionPct: pct,
  gastosFinancierosMes: valor.nonnegative(),
  impuestosMes: valor.nonnegative(),
  contadoPct: pct.default(1),
  cobroMes1Pct: pct.default(0),
  cobroMes2Pct: pct.default(0),
  saldoMinimo: valor.nonnegative().default(0)
}).refine((d) => Math.abs(d.contadoPct + d.cobroMes1Pct + d.cobroMes2Pct - 1) < 1e-9, {
  message: 'Los porcentajes de contado y cobro deben sumar 100 %', path: ['contadoPct']
});

const mesTxt = (m: MesCaja) => ({
  mes: m.mes, ventas: txt(m.ventas), cobros: txt(m.cobros), costo: txt(m.costo), gastosVenta: txt(m.gastosVenta),
  gastosAdministracion: txt(m.gastosAdministracion), gastosFinancieros: txt(m.gastosFinancieros), impuestos: txt(m.impuestos),
  totalSalidas: txt(m.totalSalidas), flujoNeto: txt(m.flujoNeto), saldoInicial: txt(m.saldoInicial), saldoFinal: txt(m.saldoFinal),
  financiamiento: txt(m.financiamiento), excedente: txt(m.excedente)
});

function resumenCaja(meses: MesCaja[]) {
  const saldos = meses.map((m) => m.saldoFinal);
  return {
    ventas: txt(sumar(meses.map((m) => m.ventas))),
    cobros: txt(sumar(meses.map((m) => m.cobros))),
    salidas: txt(sumar(meses.map((m) => m.totalSalidas))),
    flujoNeto: txt(sumar(meses.map((m) => m.flujoNeto))),
    saldoFinal: txt(saldos[saldos.length - 1]),
    saldoMinimoAlcanzado: txt(Decimal.min(...saldos)),
    mesesDeficit: meses.filter((m) => m.saldoFinal.lt(0)).length,
    mesesFinanciamiento: meses.filter((m) => m.financiamiento.gt(0)).length,
    financiamientoMaximo: txt(Decimal.max(...meses.map((m) => m.financiamiento)))
  };
}

planeacionRouter.post('/caja', async (req, res) => {
  const d = esquemaCaja.parse(req.body);
  const base = d.ventasBase.map((v) => D(v));
  const supuestos = {
    saldoInicial: D(d.saldoInicial), costoPct: D(d.costoPct), gastosVentaPct: D(d.gastosVentaPct),
    gastosAdministracionPct: D(d.gastosAdministracionPct), gastosFinancierosMes: D(d.gastosFinancierosMes),
    impuestosMes: D(d.impuestosMes), contadoPct: D(d.contadoPct), cobroMes1Pct: D(d.cobroMes1Pct),
    cobroMes2Pct: D(d.cobroMes2Pct), saldoMinimo: D(d.saldoMinimo)
  };
  const ratioCalculado = ratioIncremento(base);
  const ratio = d.ratio === null || d.ratio === undefined ? ratioCalculado : D(d.ratio);
  const totalBase = sumar(base);
  const metodos = (['promedio', 'ratio'] as const).map((metodo) => {
    const ventas = pronosticoVentas(base, metodo, ratio);
    const meses = presupuestoCaja(ventas, supuestos);
    const total = sumar(ventas);
    return {
      metodo,
      nombre: metodo === 'promedio' ? 'Método promedio' : 'Método de ratio de incremento',
      crecimientoAnual: num(totalBase.isZero() ? null : total.div(totalBase).minus(1), 6),
      resumen: resumenCaja(meses),
      meses: meses.map(mesTxt)
    };
  });
  res.json({
    totalBase: txt(totalBase),
    promedioBase: txt(totalBase.div(12)),
    ratioCalculado: num(ratioCalculado, 6),
    ratioUsado: num(ratio, 6),
    metodos
  });
});

planeacionRouter.get('/caja/base/:anio', async (req, res) => {
  const a = anio.parse(req.params.anio);
  const libro = await cargarLibro('REAL', [a - 1, a]);
  if (libro.meses(a).length !== 12) throw new AppError(404, 'SIN_DATOS', `No hay 12 meses de saldos reales para ${a}`);
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const ers = meses.map((m) => estadoResultados(libro, a, m, m));
  const ventas = sumar(ers.map((e) => e.ventasNetas));
  const proporcion = (f: (e: (typeof ers)[number]) => Decimal) => num(sumar(ers.map(f)).div(ventas), 4);
  res.json({
    anio: a,
    ventas: ers.map((e) => txt(e.ventasNetas)),
    // efectivo al cierre del año anterior
    saldoInicial: libro.tiene(a - 1, 12) ? txt(libro.saldo('1101', a - 1, 12)) : null,
    costoPct: proporcion((e) => e.costoVentas),
    gastosVentaPct: proporcion((e) => e.gastosVenta),
    gastosAdministracionPct: proporcion((e) => e.gastosAdministracion),
    gastosFinancierosMes: txt(sumar(ers.map((e) => e.gastosFinancieros)).div(12)),
    impuestosMes: txt(sumar(ers.map((e) => e.impuestoRenta)).div(12))
  });
});

// ---------- Evaluación de proyectos ----------

const esquemaProyecto = z.object({
  nombre: z.string().trim().min(3).max(120),
  descripcion: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
  inversion_inicial: valor.positive(),
  flujos: z.array(valor).min(1).max(30),
  costo_capital: z.coerce.number().min(0).lt(1),
  periodo_maximo: z.coerce.number().positive().max(30).nullable().optional().transform((v) => v ?? null)
});

type Proyecto = z.infer<typeof esquemaProyecto>;

export function evaluarProyecto(p: Proyecto) {
  const inversion = D(p.inversion_inicial);
  const flujos = p.flujos.map((f) => D(f));
  const k = D(p.costo_capital);
  const pr = periodoRecuperacion(inversion, flujos);
  const valorPresenteNeto = vpn(inversion, flujos, k);
  const tasaInterna = tir(inversion, flujos);
  const e = eva(inversion, flujos, k);
  const vp = valorPresente(flujos, k);
  return {
    periodoRecuperacion: num(pr.anios, 4),
    aceptaPR: pr.anios === null || p.periodo_maximo === null ? null : pr.anios.lte(p.periodo_maximo),
    vpn: txt(valorPresenteNeto),
    aceptaVPN: valorPresenteNeto.gt(0) ? true : valorPresenteNeto.lt(0) ? false : null,
    tir: num(tasaInterna, 6),
    aceptaTIR: tasaInterna === null ? null : tasaInterna.gt(k),
    eva: { porAnio: e.porAnio.map(txt), valorPresente: txt(e.valorPresente), perpetuidad: e.perpetuidad ? txt(e.perpetuidad) : null },
    detalle: flujos.map((f, i) => ({ periodo: i + 1, flujo: txt(f), acumulado: txt(pr.acumulado[i]), valorPresente: txt(vp[i]) })),
    valorPresenteEntradas: txt(sumar(vp))
  };
}

planeacionRouter.post('/proyectos/evaluar', async (req, res) => {
  res.json(evaluarProyecto(esquemaProyecto.parse(req.body)));
});

const filaProyecto = (r: Record<string, unknown>) => {
  const p: Proyecto = {
    nombre: r.nombre as string, descripcion: r.descripcion as string | null,
    inversion_inicial: Number(r.inversion_inicial), flujos: (r.flujos as string[]).map(Number),
    costo_capital: Number(r.costo_capital), periodo_maximo: r.periodo_maximo === null ? null : Number(r.periodo_maximo)
  };
  return { id: r.id, ...p, evaluacion: evaluarProyecto(p) };
};

planeacionRouter.get('/proyectos', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM proyectos_inversion ORDER BY nombre');
  const proyectos = rows.map(filaProyecto);
  // enfoque de clasificación: mayor VPN primero
  const ranking = [...proyectos].sort((a, b) => Number(b.evaluacion.vpn) - Number(a.evaluacion.vpn)).map((p) => p.id);
  res.json({ proyectos, ranking });
});

planeacionRouter.post('/proyectos', async (req, res) => {
  const p = esquemaProyecto.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO proyectos_inversion (nombre, descripcion, inversion_inicial, flujos, costo_capital, periodo_maximo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [p.nombre, p.descripcion, p.inversion_inicial, p.flujos, p.costo_capital, p.periodo_maximo]
  );
  await registrarBitacora(req.usuario?.id, 'CREAR', 'proyecto', rows[0].id, p);
  res.status(201).json(filaProyecto(rows[0]));
});

planeacionRouter.put('/proyectos/:id', async (req, res) => {
  const pid = z.coerce.number().int().positive().parse(req.params.id);
  const p = esquemaProyecto.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE proyectos_inversion SET nombre = $1, descripcion = $2, inversion_inicial = $3, flujos = $4, costo_capital = $5,
       periodo_maximo = $6 WHERE id = $7 RETURNING *`,
    [p.nombre, p.descripcion, p.inversion_inicial, p.flujos, p.costo_capital, p.periodo_maximo, pid]
  );
  if (!rows[0]) throw noEncontrado('Proyecto no encontrado');
  await registrarBitacora(req.usuario?.id, 'EDITAR', 'proyecto', pid, p);
  res.json(filaProyecto(rows[0]));
});

planeacionRouter.delete('/proyectos/:id', async (req, res) => {
  const pid = z.coerce.number().int().positive().parse(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM proyectos_inversion WHERE id = $1', [pid]);
  if (!rowCount) throw noEncontrado('Proyecto no encontrado');
  await registrarBitacora(req.usuario?.id, 'ELIMINAR', 'proyecto', pid, {});
  res.status(204).end();
});

// ---------- Unidad IV: efectivo y crédito ----------

circulanteRouter.get('/efectivo', async (req, res) => {
  const a = anio.parse(req.query.anio);
  const [libro, ctx] = await Promise.all([cargarLibro('REAL', [a]), contextoRazones()]);
  const r = razonesPeriodo(libro, a, undefined, ctx);
  if (!r) throw new AppError(404, 'SIN_DATOS', `No hay saldos reales para ${a}`);
  const { edad_inventario: epi, periodo_cobro: ppc, periodo_pago: ppp } = r.valores;
  if (!epi || !ppc || !ppp) throw new AppError(422, 'SIN_DATOS', 'Faltan datos para calcular el ciclo de conversión');
  const desembolsos = r.er.costoVentas.plus(r.er.gastosOperacion).plus(r.er.gastosFinancieros).times(r.factorAnual);
  const c = cicloEfectivo(epi, ppc, ppp, desembolsos, D(365));
  const plazo = ctx.parametros.plazo_credito_clientes;
  const { rows: clientes } = await pool.query(
    'SELECT nombre, tipo, plazo_credito_dias, limite_credito, descuento_pronto_pago, dias_pronto_pago FROM clientes WHERE activo ORDER BY nombre'
  );
  res.json({
    anio: a, hastaMes: r.hasta, diasAnio: 365,
    edadInventario: num(epi, 2), periodoCobro: num(ppc, 2), periodoPago: num(ppp, 2),
    cicloOperativo: num(c.cicloOperativo, 2), cicloConversion: num(c.cicloConversion, 2),
    rotacionEfectivo: num(c.rotacionEfectivo, 4), desembolsosAnuales: txt(desembolsos),
    efectivoMinimo: c.efectivoMinimo ? txt(c.efectivoMinimo) : null,
    efectivoReal: txt(r.sit.efectivo),
    plazoCredito: num(plazo ?? null, 0),
    cobroExcedePlazo: plazo ? ppc.gt(plazo) : null,
    clientes
  });
});

const esquemaCredito = z.object({
  ventasCredito: valor.positive(),
  periodoCobroActual: valor.positive(),
  periodoCobroNuevo: valor.positive(),
  incrementoVentas: z.coerce.number().min(-1).max(10),
  costoVariable: pct,
  rendimientoRequerido: pct,
  diasAnio: z.union([z.literal(360), z.literal(365)]).default(360)
});

circulanteRouter.post('/credito', async (req, res) => {
  const d = esquemaCredito.parse(req.body);
  const r = politicaCredito({
    ventasCredito: D(d.ventasCredito), periodoCobroActual: D(d.periodoCobroActual), periodoCobroNuevo: D(d.periodoCobroNuevo),
    incrementoVentas: D(d.incrementoVentas), costoVariable: D(d.costoVariable), rendimientoRequerido: D(d.rendimientoRequerido),
    diasAnio: D(d.diasAnio)
  });
  res.json({
    rotacionAnterior: num(r.rotacionAnterior, 4), rotacionNueva: num(r.rotacionNueva, 4),
    ventasAdicionales: txt(r.ventasAdicionales), rentabilidadVentasAdicionales: txt(r.rentabilidadVentasAdicionales),
    cxcAdicionalesNuevas: txt(r.cxcAdicionalesNuevas), inversionNuevas: txt(r.inversionNuevas),
    cxcAntes: txt(r.cxcAntes), cxcOriginalesNuevo: txt(r.cxcOriginalesNuevo), inversionOriginales: txt(r.inversionOriginales),
    inversionTotal: txt(r.inversionTotal), rendimientoRequerido: txt(r.rendimientoRequerido),
    beneficioNeto: txt(r.beneficioNeto), conviene: r.conviene
  });
});
