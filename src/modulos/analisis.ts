import { Router } from 'express';
import { cargarCatalogo, cargarEmpresa, cargarLibro, cargarParametros, consultaPeriodo, mesesDisponibles } from '../datos';
import { pool } from '../db';
import { AppError } from '../errores';
import { CERO, D, Decimal, dividir, num, txt } from '../finanzas/dinero';
import { balanceGeneral, CuentaCatalogo, estadoResultados, LINEAS_ER, situacion } from '../finanzas/estados';
import { Libro } from '../finanzas/libro';
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

export function razonesPeriodo(libro: Libro, anio: number, hasta: number | undefined, ctx: Contexto): { valores: ValoresRazones; hasta: number } | null {
  const meses = libro.meses(anio).filter((m) => !hasta || m <= hasta);
  if (meses.length === 0) return null;
  const ultimo = meses[meses.length - 1];
  return {
    hasta: ultimo,
    valores: calcularRazones({
      er: estadoResultados(libro, anio, meses[0], ultimo),
      sit: situacion(libro, anio, ultimo),
      factorAnual: D(12).div(meses.length),
      acciones: ctx.acciones,
      arrendamientoAnual: ctx.parametros.arrendamiento_anual ?? CERO,
      principalAnual: ctx.parametros.pagos_principal_anual ?? CERO,
      tasaIsr: ctx.parametros.isr ?? CERO
    })
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

function comparar(actual: Decimal, referencia: Decimal) {
  const variacion = actual.minus(referencia);
  return { variacion: txt(variacion), variacionPct: num(dividir(variacion, referencia.abs())) };
}

analisisRouter.get('/horizontal', async (req, res) => {
  const { anio } = consultaPeriodo.parse(req.query);
  const [libro, catalogo] = await Promise.all([cargarLibro('REAL', [anio - 1, anio]), cargarCatalogo()]);
  const meses = mesesDisponibles(libro, anio);
  const mesesAnt = libro.meses(anio - 1);
  if (mesesAnt.length === 0) throw new AppError(404, 'SIN_DATOS', `No hay datos de ${anio - 1} para comparar`);
  const hasta = meses[meses.length - 1];
  const er = estadoResultados(libro, anio, 1, hasta);
  const erAnt = estadoResultados(libro, anio - 1, 1, Math.min(hasta, mesesAnt[mesesAnt.length - 1]));
  const bg = filasBalance(libro, catalogo, anio, hasta);
  const bgAnt = filasBalance(libro, catalogo, anio - 1, Math.min(hasta, mesesAnt[mesesAnt.length - 1]));
  res.json({
    anio, anterior: anio - 1, hastaMes: hasta,
    resultados: LINEAS_ER.map((l) => ({
      clave: l.clave, nombre: l.nombre, tipo: l.tipo,
      actual: txt(er[l.clave]), anterior: txt(erAnt[l.clave]), ...comparar(er[l.clave], erAnt[l.clave])
    })),
    balance: bg.map((f, i) => ({
      codigo: f.codigo, nombre: f.nombre, nivel: f.nivel,
      actual: txt(f.monto), anterior: txt(bgAnt[i].monto), ...comparar(f.monto, bgAnt[i].monto)
    })),
    teoria: TEMAS.horizontal
  });
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
