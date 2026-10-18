import { Router } from 'express';
import { cargarCatalogo, cargarLibro, consultaPeriodo, mesesDisponibles } from '../datos';
import { pool } from '../db';
import { AppError } from '../errores';
import { dividir, num, txt } from '../finanzas/dinero';
import { balanceGeneral, cambiosPatrimonio, estadoResultados, FlujoEfectivo, flujoEfectivo, LINEAS_ER } from '../finanzas/estados';
import { TEMAS } from '../finanzas/teoria';
import { permitir } from '../middleware/auth';

export const estadosRouter = Router();
estadosRouter.use(permitir('ADMIN', 'FINANZAS'));

estadosRouter.get('/periodos', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT anio, escenario, COUNT(DISTINCT mes)::int AS meses, MAX(mes)::int AS ultimo_mes
     FROM saldos_periodo GROUP BY anio, escenario ORDER BY anio DESC, escenario`
  );
  res.json(rows);
});

estadosRouter.get('/resultados', async (req, res) => {
  const { anio, escenario, mes } = consultaPeriodo.parse(req.query);
  const libro = await cargarLibro(escenario, [anio]);
  const meses = mesesDisponibles(libro, anio, mes);
  const porMes = meses.map((m) => estadoResultados(libro, anio, m, m));
  const total = estadoResultados(libro, anio, meses[0], meses[meses.length - 1]);
  res.json({
    anio, escenario, meses,
    lineas: LINEAS_ER.map((l) => ({
      clave: l.clave, nombre: l.nombre, tipo: l.tipo,
      valores: porMes.map((er) => txt(er[l.clave])),
      total: txt(total[l.clave]),
      porcentaje: num(dividir(total[l.clave], total.ventasNetas))
    })),
    teoria: TEMAS.tamanoComun
  });
});

estadosRouter.get('/balance', async (req, res) => {
  const { anio, escenario, mes } = consultaPeriodo.parse(req.query);
  const [libro, catalogo] = await Promise.all([cargarLibro(escenario, [anio]), cargarCatalogo()]);
  const meses = mesesDisponibles(libro, anio, mes);
  const balances = meses.map((m) => balanceGeneral(libro, catalogo, anio, m));
  const ultimo = balances[balances.length - 1];
  res.json({
    anio, escenario, meses,
    filas: ultimo.filas.map((f, i) => ({
      codigo: f.codigo, nombre: f.nombre, nivel: f.nivel,
      valores: balances.map((b) => txt(b.filas[i].monto)),
      porcentaje: num(dividir(f.monto, f.codigo.startsWith('1') ? ultimo.activoTotal : ultimo.pasivoMasPatrimonio))
    })),
    totales: {
      activo: balances.map((b) => txt(b.activoTotal)),
      pasivo: balances.map((b) => txt(b.pasivoTotal)),
      patrimonio: balances.map((b) => txt(b.patrimonio)),
      pasivoMasPatrimonio: balances.map((b) => txt(b.pasivoMasPatrimonio)),
      diferencia: balances.map((b) => txt(b.diferencia))
    },
    teoria: {
      titulo: 'Estado de situación financiera',
      formula: 'Activo = Pasivo + Patrimonio',
      texto: 'Muestra la relación entre activos, pasivos y patrimonio a una fecha. Activos y pasivos se clasifican en corrientes (12 meses o menos) y no corrientes. El patrimonio es la parte residual de los activos una vez deducidos los pasivos.',
      fuente: 'Unidad I - Estados financieros'
    }
  });
});

estadosRouter.get('/flujo', async (req, res) => {
  const { anio, escenario, mes } = consultaPeriodo.parse(req.query);
  const libro = await cargarLibro(escenario, [anio - 1, anio]);
  const meses = mesesDisponibles(libro, anio, mes);
  const anual = flujoEfectivo(libro, anio, meses[0], meses[meses.length - 1]);
  if (!anual) throw new AppError(404, 'SIN_SALDO_INICIAL', `No hay balance al cierre de ${anio - 1} para calcular el flujo de ${anio}`);
  const mensuales = meses.map((m) => flujoEfectivo(libro, anio, m, m) as FlujoEfectivo);
  const seccion = (nombre: string, lineas: 'operacion' | 'inversion' | 'financiamiento', total: 'totalOperacion' | 'totalInversion' | 'totalFinanciamiento') => ({
    nombre,
    lineas: anual[lineas].map((l, i) => ({ nombre: l.nombre, valores: mensuales.map((f) => txt(f[lineas][i].monto)), total: txt(l.monto) })),
    valores: mensuales.map((f) => txt(f[total])),
    total: txt(anual[total])
  });
  const resumen = (clave: 'flujoNeto' | 'efectivoInicial' | 'efectivoFinal' | 'efectivoBalance' | 'diferencia') => ({
    valores: mensuales.map((f) => txt(f[clave])),
    total: txt(anual[clave])
  });
  res.json({
    anio, escenario, meses,
    secciones: [
      seccion('Actividades de operación', 'operacion', 'totalOperacion'),
      seccion('Actividades de inversión', 'inversion', 'totalInversion'),
      seccion('Actividades de financiamiento', 'financiamiento', 'totalFinanciamiento')
    ],
    flujoNeto: resumen('flujoNeto'),
    efectivoInicial: resumen('efectivoInicial'),
    efectivoFinal: resumen('efectivoFinal'),
    efectivoBalance: resumen('efectivoBalance'),
    diferencia: resumen('diferencia'),
    cuadra: anual.diferencia.abs().lte(0.05),
    teoria: TEMAS.flujoIndirecto
  });
});

estadosRouter.get('/patrimonio', async (req, res) => {
  const { anio, escenario, mes } = consultaPeriodo.parse(req.query);
  const [libro, catalogo] = await Promise.all([cargarLibro(escenario, [anio - 1, anio]), cargarCatalogo()]);
  const meses = mesesDisponibles(libro, anio, mes);
  const cambios = cambiosPatrimonio(libro, catalogo, anio, meses[meses.length - 1]);
  if (!cambios) throw new AppError(404, 'SIN_SALDO_INICIAL', `No hay balance al cierre de ${anio - 1}`);
  const er = estadoResultados(libro, anio, meses[0], meses[meses.length - 1]);
  res.json({
    anio, escenario, hastaMes: meses[meses.length - 1],
    filas: cambios.filas.map((f) => ({ codigo: f.codigo, nombre: f.nombre, inicial: txt(f.inicial), variacion: txt(f.variacion), final: txt(f.final) })),
    totales: { inicial: txt(cambios.totalInicial), variacion: txt(cambios.totalVariacion), final: txt(cambios.totalFinal) },
    utilidadPeriodo: txt(er.utilidadEjercicio),
    reservaPeriodo: txt(er.reservaLegal),
    teoria: {
      titulo: 'Estado de cambios en el patrimonio',
      formula: 'Saldo inicial + Movimientos del período = Saldo final (por cada componente)',
      texto: 'Concilia el patrimonio al inicio y al final del período: resultado del ejercicio, reservas, aportes y distribuciones a los accionistas. Conecta el balance general con el estado de resultados.',
      fuente: 'Unidad I - Estados financieros'
    }
  });
});
