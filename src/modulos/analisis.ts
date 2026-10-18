import { Router } from 'express';
import { z } from 'zod';
import { cargarCatalogo, cargarEmpresa, cargarLibro, cargarParametros, consultaPeriodo, mesesDisponibles } from '../datos';
import { AppError } from '../errores';
import { CERO, D, Decimal, dividir, num, txt } from '../finanzas/dinero';
import { balanceGeneral, CuentaCatalogo, EstadoResultados, estadoResultados, LINEAS_ER, Situacion, situacion } from '../finanzas/estados';
import { Libro } from '../finanzas/libro';
import { composicionVentas, variacion, verticalBalance, verticalResultados } from '../finanzas/analisis';
import { ArbolDupont, cambioRelativo, dupont } from '../finanzas/dupont';
import { capitalTrabajo, fuentesUsos } from '../finanzas/fuentes-usos';
import { Comportamiento, equilibrioEmpresa, RubroCosto } from '../finanzas/equilibrio';
import { registrarBitacora } from '../bitacora';
import { pool, transaccion } from '../db';
import { variacionUtilidadBruta } from '../finanzas/presupuesto';
import { calcularRazones, semaforo, ValoresRazones } from '../finanzas/razones';
import { RAZONES, TEMAS } from '../finanzas/teoria';
import { permitir } from '../middleware/auth';

export const analisisRouter = Router();
analisisRouter.use(permitir('ADMIN', 'FINANZAS'));

interface Contexto {
  acciones: number;
  parametros: Record<string, Decimal | null>;
}

export function razonesPeriodo(libro: Libro, anio: number, hasta: number | undefined, ctx: Contexto) {
  const meses = libro.meses(anio).filter((m) => !hasta || m <= hasta);
  if (meses.length === 0) return null;
  const ultimo = meses[meses.length - 1];
  const er = estadoResultados(libro, anio, meses[0], ultimo);
  const sit = situacion(libro, anio, ultimo);
  const factorAnual = D(12).div(meses.length);
  return {
    hasta: ultimo,
    er, sit, factorAnual,
    valores: calcularRazones({
      er,
      sit,
      factorAnual,
      acciones: ctx.acciones,
      arrendamientoAnual: ctx.parametros.arrendamiento_anual ?? CERO,
      principalAnual: ctx.parametros.pagos_principal_anual ?? CERO,
      tasaIsr: ctx.parametros.isr ?? CERO
    })
  };
}

// Cifras base de cada razón; los flujos van anualizados igual que en calcularRazones
function componentesRazones(er: EstadoResultados, sit: Situacion, factor: Decimal, acciones: number) {
  const anual = (v: Decimal) => txt(v.times(factor));
  return {
    factorAnual: num(factor, 6),
    activoCorriente: txt(sit.activoCorriente), pasivoCorriente: txt(sit.pasivoCorriente),
    inventario: txt(sit.inventario), inventarioTransito: txt(sit.inventarioTransito),
    cuentasPorCobrar: txt(sit.cuentasPorCobrar), cuentasPorPagar: txt(sit.cuentasPorPagar),
    activoTotal: txt(sit.activoTotal), pasivoTotal: txt(sit.pasivoTotal), patrimonio: txt(sit.patrimonio),
    ventasNetas: txt(er.ventasNetas), ventasAnuales: anual(er.ventasNetas),
    costoVentasAnual: anual(er.costoVentas), comprasAnuales: anual(er.compras.minus(er.rebajasCompras)),
    utilidadBruta: txt(er.utilidadBruta), utilidadOperacion: txt(er.utilidadOperacion), utilidadNeta: txt(er.utilidadEjercicio),
    uaiiAnual: anual(er.utilidadOperacion), interesesAnual: anual(er.gastosFinancieros), utilidadNetaAnual: anual(er.utilidadEjercicio),
    acciones
  };
}

export async function contextoRazones(): Promise<Contexto> {
  const [empresa, parametros] = await Promise.all([cargarEmpresa(), cargarParametros()]);
  return { acciones: Number(empresa.numero_acciones), parametros };
}

export async function estandares(): Promise<Record<string, Decimal | null>> {
  const { rows } = await pool.query('SELECT clave, valor FROM razones_estandar');
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor === null ? null : D(r.valor)]));
}

analisisRouter.get('/razones', async (req, res) => {
  const { anio, mes } = consultaPeriodo.parse(req.query);
  const [real, ppto, ctx, std] = await Promise.all([
    cargarLibro('REAL', [anio - 1, anio]),
    cargarLibro('PRESUPUESTO', [anio]),
    contextoRazones(),
    estandares()
  ]);
  const actual = razonesPeriodo(real, anio, mes, ctx);
  if (!actual) throw new AppError(404, 'SIN_DATOS', `No hay saldos reales para ${anio}`);
  const anterior = razonesPeriodo(real, anio - 1, actual.hasta, ctx);
  const presupuesto = ppto.meses(anio).length > 0 ? razonesPeriodo(ppto, anio, actual.hasta, ctx) : null;
  const tolerancia = ctx.parametros.tolerancia_presupuesto ?? D('0.05');
  const anualizado = actual.hasta < 12;
  res.json({
    anio,
    hastaMes: actual.hasta,
    base: anualizado
      ? `Acumulado enero a mes ${actual.hasta}, flujos anualizados (× 12 / ${actual.hasta}); saldos de balance al cierre del mes ${actual.hasta}`
      : 'Cifras anuales (enero a diciembre) y saldos de balance al 31 de diciembre',
    plazoCredito: num(ctx.parametros.plazo_credito_clientes ?? null, 0),
    componentes: componentesRazones(actual.er, actual.sit, actual.factorAnual, ctx.acciones),
    razones: RAZONES.map((def) => {
      const v = actual.valores[def.clave];
      const ant = anterior?.valores[def.clave] ?? null;
      const pre = presupuesto?.valores[def.clave] ?? null;
      const est = std[def.clave] ?? null;
      return {
        ...def,
        valor: num(v),
        anterior: num(ant),
        presupuesto: num(pre),
        estandar: num(est),
        semaforoAnterior: semaforo(def.clave, v, ant, tolerancia),
        semaforoPresupuesto: semaforo(def.clave, v, pre, tolerancia),
        semaforoEstandar: semaforo(def.clave, v, est, tolerancia)
      };
    })
  });
});

function filasBalance(libro: Libro, catalogo: CuentaCatalogo[], anio: number, mes: number) {
  return balanceGeneral(libro, catalogo, anio, mes).filas;
}

analisisRouter.get('/vertical', async (req, res) => {
  const { anio, escenario, mes } = consultaPeriodo.parse(req.query);
  const [libro, catalogo] = await Promise.all([cargarLibro(escenario, [anio]), cargarCatalogo()]);
  const meses = mesesDisponibles(libro, anio, mes);
  const hasta = meses[meses.length - 1];
  const er = estadoResultados(libro, anio, meses[0], hasta);
  const bg = verticalBalance(libro, catalogo, anio, hasta);
  res.json({
    anio, escenario, hastaMes: hasta,
    resultados: verticalResultados(er).map((l) => ({ clave: l.clave, nombre: l.nombre, tipo: l.tipo, monto: txt(l.monto), porcentaje: num(l.porcentaje, 6) })),
    balance: bg.filas.map((f) => ({ codigo: f.codigo, nombre: f.nombre, nivel: f.nivel, detalle: f.detalle, monto: txt(f.monto), porcentaje: num(f.porcentaje, 6) })),
    totales: { activo: txt(bg.activoTotal), pasivo: txt(bg.pasivoTotal), patrimonio: txt(bg.patrimonio), pasivoMasPatrimonio: txt(bg.pasivoMasPatrimonio) },
    comprobacion: {
      resultados: num(composicionVentas(er), 6),
      activo: num(bg.sumaActivo, 6),
      pasivoPatrimonio: num(bg.sumaPasivoPatrimonio, 6)
    }
  });
});

const consultaHorizontal = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  base_anio: z.coerce.number().int().min(2000).max(2100).optional(),
  base_mes: z.coerce.number().int().min(1).max(12).optional(),
  tipo: z.enum(['acumulado', 'mes']).default('acumulado')
});

analisisRouter.get('/horizontal', async (req, res) => {
  const q = consultaHorizontal.parse(req.query);
  const baseAnio = q.base_anio ?? q.anio - 1;
  const [libro, catalogo, parametros] = await Promise.all([cargarLibro('REAL', [...new Set([baseAnio, q.anio])]), cargarCatalogo(), cargarParametros()]);
  const ultimo = (anio: number, mes?: number) => {
    const meses = mesesDisponibles(libro, anio, mes);
    const m = meses[meses.length - 1];
    if (mes && m !== mes) throw new AppError(404, 'SIN_DATOS', `No hay saldos de ${anio} para el mes ${mes}`);
    return m;
  };
  const mesActual = ultimo(q.anio, q.mes);
  const mesBase = ultimo(baseAnio, q.base_mes ?? (q.mes ? mesActual : undefined));
  const umbral = parametros.umbral_variacion ?? D('0.10');
  const desde = (m: number) => (q.tipo === 'mes' ? m : 1);
  const er = estadoResultados(libro, q.anio, desde(mesActual), mesActual);
  const erBase = estadoResultados(libro, baseAnio, desde(mesBase), mesBase);
  const bg = filasBalance(libro, catalogo, q.anio, mesActual);
  const bgBase = filasBalance(libro, catalogo, baseAnio, mesBase);
  const fila = (actual: Decimal, base: Decimal) => {
    const v = variacion(actual, base, umbral);
    return { actual: txt(actual), base: txt(base), variacion: txt(v.absoluta), variacionPct: num(v.relativa), resaltar: v.resaltar };
  };
  res.json({
    tipo: q.tipo,
    actual: { anio: q.anio, mes: mesActual },
    base: { anio: baseAnio, mes: mesBase },
    umbral: num(umbral),
    resultados: LINEAS_ER.map((l) => ({ clave: l.clave, nombre: l.nombre, tipo: l.tipo, ...fila(er[l.clave], erBase[l.clave]) })),
    balance: bg.map((f, i) => ({ codigo: f.codigo, nombre: f.nombre, nivel: f.nivel, detalle: f.detalle, ...fila(f.monto, bgBase[i].monto) }))
  });
});

const consultaDosPeriodos = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  base_anio: z.coerce.number().int().min(2000).max(2100).optional(),
  base_mes: z.coerce.number().int().min(1).max(12).optional()
});

function arbolTexto(a: ArbolDupont) {
  return {
    margenNeto: num(a.margenNeto, 6), rotacionActivos: num(a.rotacionActivos, 6), multiplicador: num(a.multiplicador, 6),
    roa: num(a.roa, 6), roe: num(a.roe, 6), roaDirecto: num(a.roaDirecto, 6), roeDirecto: num(a.roeDirecto, 6)
  };
}

analisisRouter.get('/dupont', async (req, res) => {
  const q = consultaDosPeriodos.parse(req.query);
  const baseAnio = q.base_anio ?? q.anio - 1;
  const [libro, ctx] = await Promise.all([cargarLibro('REAL', [...new Set([baseAnio, q.anio])]), contextoRazones()]);
  const periodo = (anio: number, mes?: number) => {
    const r = razonesPeriodo(libro, anio, mes, ctx);
    if (!r) throw new AppError(404, 'SIN_DATOS', `No hay saldos reales para ${anio}`);
    const sit = situacion(libro, anio, r.hasta);
    return { anio, mes: r.hasta, arbol: dupont(r.valores, sit), activoTotal: sit.activoTotal, patrimonio: sit.patrimonio };
  };
  const actual = periodo(q.anio, q.mes);
  const base = periodo(baseAnio, q.base_mes ?? (q.mes ? actual.mes : undefined));
  const claves = ['margenNeto', 'rotacionActivos', 'multiplicador', 'roa', 'roe'] as const;
  res.json({
    actual: { anio: actual.anio, mes: actual.mes, ...arbolTexto(actual.arbol), activoTotal: txt(actual.activoTotal), patrimonio: txt(actual.patrimonio) },
    base: { anio: base.anio, mes: base.mes, ...arbolTexto(base.arbol), activoTotal: txt(base.activoTotal), patrimonio: txt(base.patrimonio) },
    cambios: Object.fromEntries(claves.map((c) => [c, num(cambioRelativo(actual.arbol[c], base.arbol[c]), 6)])),
    base_calculo: actual.mes < 12 ? `Acumulado enero a mes ${actual.mes}, anualizado (× 12 / ${actual.mes})` : 'Cifras anuales'
  });
});

analisisRouter.get('/sumario', async (req, res) => {
  const mes = z.coerce.number().int().min(1).max(12).optional().parse(req.query.mes);
  const { rows } = await pool.query(`SELECT DISTINCT anio FROM saldos_periodo WHERE escenario = 'REAL' ORDER BY anio`);
  const anios: number[] = rows.map((r) => Number(r.anio));
  const [libro, ctx, std] = await Promise.all([cargarLibro('REAL', anios), contextoRazones(), estandares()]);
  const tolerancia = ctx.parametros.tolerancia_presupuesto ?? D('0.05');
  const periodos = anios.map((anio) => ({ anio, r: razonesPeriodo(libro, anio, mes, ctx) })).filter((p) => p.r);
  res.json({
    periodos: periodos.map((p) => ({ anio: p.anio, mes: p.r!.hasta })),
    razones: RAZONES.map((def) => {
      const valores = periodos.map((p) => p.r!.valores[def.clave]);
      const ultimo = valores[valores.length - 1] ?? null;
      const anterior = valores.length > 1 ? valores[valores.length - 2] : null;
      const est = std[def.clave] ?? null;
      return {
        clave: def.clave, nombre: def.nombre, categoria: def.categoria, unidad: def.unidad, formula: def.formula, mayorEsMejor: def.mayorEsMejor,
        valores: valores.map((v) => num(v)),
        tendencia: ultimo === null || anterior === null ? 'sin_dato'
          : def.mayorEsMejor === null ? 'neutral'
          : ultimo.eq(anterior) ? 'igual'
          : ultimo.gt(anterior) === def.mayorEsMejor ? 'mejora' : 'empeora',
        estandar: num(est),
        referencia: est ? 'estándar de la industria' : 'año anterior',
        semaforo: semaforo(def.clave, ultimo, est ?? anterior, tolerancia)
      };
    })
  });
});

analisisRouter.get('/fuentes-usos', async (req, res) => {
  const q = consultaDosPeriodos.parse(req.query);
  const baseAnio = q.base_anio ?? q.anio - 1;
  const [libro, catalogo] = await Promise.all([cargarLibro('REAL', [...new Set([baseAnio, q.anio])]), cargarCatalogo()]);
  const mesesActual = mesesDisponibles(libro, q.anio, q.mes);
  const actual = { anio: q.anio, mes: mesesActual[mesesActual.length - 1] };
  const mesesBase = mesesDisponibles(libro, baseAnio, q.base_mes ?? (q.mes ? actual.mes : undefined));
  const base = { anio: baseAnio, mes: mesesBase[mesesBase.length - 1] };
  const r = fuentesUsos(libro, catalogo, base, actual);
  const linea = (c: (typeof r.fuentes)[number]) => ({ codigo: c.codigo, nombre: c.nombre, base: txt(c.base), actual: txt(c.actual), variacion: txt(c.variacion), monto: txt(c.monto) });
  const ct = (p: { anio: number; mes: number }) => {
    const c = capitalTrabajo(libro, p.anio, p.mes);
    return {
      anio: p.anio, mes: p.mes, activoCorriente: txt(c.activoCorriente), pasivoCorriente: txt(c.pasivoCorriente), neto: txt(c.neto),
      financiadoCortoPlazo: num(c.financiadoCortoPlazo, 6), financiadoLargoPlazo: num(c.financiadoLargoPlazo, 6)
    };
  };
  res.json({
    base, actual,
    fuentes: r.fuentes.sort((a, b) => b.monto.cmp(a.monto)).map(linea),
    usos: r.usos.sort((a, b) => b.monto.cmp(a.monto)).map(linea),
    totalFuentes: txt(r.totalFuentes),
    totalUsos: txt(r.totalUsos),
    diferencia: txt(r.diferencia),
    descuadreBalances: txt(r.descuadreBalances),
    capitalTrabajo: { base: ct(base), actual: ct(actual), meses: mesesActual.map((m) => ct({ anio: q.anio, mes: m })) }
  });
});

async function cargarClasificacion() {
  const { rows } = await pool.query('SELECT rubro, nombre, comportamiento FROM clasificacion_costos ORDER BY orden');
  return rows as { rubro: RubroCosto; nombre: string; comportamiento: Comportamiento }[];
}

analisisRouter.get('/equilibrio', async (req, res) => {
  const { anio, escenario, mes } = consultaPeriodo.parse(req.query);
  const [libro, clasificacion] = await Promise.all([cargarLibro(escenario, [anio]), cargarClasificacion()]);
  const meses = mesesDisponibles(libro, anio, mes);
  const hasta = meses[meses.length - 1];
  const r = equilibrioEmpresa(
    estadoResultados(libro, anio, 1, hasta),
    Object.fromEntries(clasificacion.map((c) => [c.rubro, c.comportamiento])) as Record<RubroCosto, Comportamiento>
  );
  const nombres = Object.fromEntries(clasificacion.map((c) => [c.rubro, c.nombre]));
  res.json({
    anio, escenario, hastaMes: hasta,
    ventas: txt(r.ventas),
    rubros: r.rubros.map((x) => ({ rubro: x.rubro, nombre: nombres[x.rubro], comportamiento: x.comportamiento, monto: txt(x.monto) })),
    costosFijos: txt(r.fijos),
    costosVariables: txt(r.variables),
    razonVariable: num(r.razonVariable, 6),
    margenContribucion: num(r.margenContribucion, 6),
    puntoEquilibrio: r.pe ? txt(r.pe) : null,
    margenSeguridad: num(r.margenSeguridad, 6),
    utilidadActual: txt(r.utilidadActual),
    comprobacion: r.comprobacion && {
      ventas: txt(r.comprobacion.ventas),
      costosVariables: txt(r.comprobacion.costosVariables),
      costosFijos: txt(r.comprobacion.costosFijos),
      utilidad: txt(r.comprobacion.utilidad)
    }
  });
});

const esquemaClasificacion = z.array(z.object({
  rubro: z.enum(['costoVentas', 'gastosVenta', 'gastosAdministracion', 'gastosFinancieros']),
  comportamiento: z.enum(['FIJO', 'VARIABLE'])
})).min(1);

analisisRouter.put('/equilibrio/clasificacion', async (req, res) => {
  const datos = esquemaClasificacion.parse(req.body);
  await transaccion(async (c) => {
    for (const d of datos) await c.query('UPDATE clasificacion_costos SET comportamiento = $1 WHERE rubro = $2', [d.comportamiento, d.rubro]);
    await registrarBitacora(req.usuario?.id, 'EDITAR', 'clasificacion_costos', 'varios', datos, c);
  });
  res.json(await cargarClasificacion());
});

analisisRouter.get('/comparativo', async (req, res) => {
  const { anio, mes } = consultaPeriodo.parse(req.query);
  const [real, ppto, catalogo, parametros] = await Promise.all([
    cargarLibro('REAL', [anio]), cargarLibro('PRESUPUESTO', [anio]), cargarCatalogo(), cargarParametros()
  ]);
  const mesesReal = mesesDisponibles(real, anio, mes);
  if (ppto.meses(anio).length === 0) throw new AppError(404, 'SIN_PRESUPUESTO', `No hay presupuesto registrado para ${anio}`);
  const hasta = mesesReal[mesesReal.length - 1];
  const tolerancia = parametros.tolerancia_presupuesto ?? D('0.05');
  const erR = estadoResultados(real, anio, 1, hasta);
  const erP = estadoResultados(ppto, anio, 1, hasta);
  const evaluar = (r: Decimal, p: Decimal, sentido: 1 | -1) => {
    const variacion = r.minus(p);
    const pct = dividir(variacion, p.abs());
    const favorable = sentido === 1 ? variacion.gte(0) : variacion.lte(0);
    const fueraTolerancia = pct !== null && pct.abs().gt(tolerancia);
    return {
      real: txt(r), presupuesto: txt(p), variacion: txt(variacion), variacionPct: num(pct),
      estado: favorable ? 'favorable' : 'desfavorable',
      alerta: !favorable && fueraTolerancia
    };
  };
  const bgR = filasBalance(real, catalogo, anio, hasta);
  const bgP = filasBalance(ppto, catalogo, anio, hasta);
  const vub = variacionUtilidadBruta(erR.ventasNetas, erR.utilidadBruta, erP.ventasNetas, erP.utilidadBruta);
  res.json({
    anio, hastaMes: hasta, tolerancia: num(tolerancia),
    resultados: LINEAS_ER.map((l) => ({ clave: l.clave, nombre: l.nombre, tipo: l.tipo, ...evaluar(erR[l.clave], erP[l.clave], l.sentido) })),
    balance: bgR.map((f, i) => ({
      codigo: f.codigo, nombre: f.nombre, nivel: f.nivel,
      ...evaluar(f.monto, bgP[i].monto, f.codigo.startsWith('1') || f.codigo.startsWith('3') ? 1 : -1)
    })),
    variacionUtilidadBruta: {
      margenReal: num(vub.margenReal), margenPresupuesto: num(vub.margenPpto),
      porVentaNoLograda: txt(vub.porVentaNoLograda), porMargenNoLogrado: txt(vub.porMargenNoLogrado), total: txt(vub.total)
    },
    teoria: { comparativo: TEMAS.comparativo, variacionUtilidadBruta: TEMAS.variacionUtilidadBruta }
  });
});

analisisRouter.get('/teoria', (_req, res) => {
  res.json({ razones: RAZONES, temas: TEMAS });
});
