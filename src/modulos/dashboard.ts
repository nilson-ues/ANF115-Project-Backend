import { Router } from 'express';
import { z } from 'zod';
import { cargarEmpresa, cargarLibro, cargarParametros } from '../datos';
import { pool } from '../db';
import { AppError } from '../errores';
import { D, num, txt } from '../finanzas/dinero';
import { estadoResultados, situacion } from '../finanzas/estados';
import { semaforo } from '../finanzas/razones';
import { RAZONES, TEMAS } from '../finanzas/teoria';
import { permitir, TODOS } from '../middleware/auth';
import { contextoRazones, estandares, razonesPeriodo } from './analisis';

export const dashboardRouter = Router();

const CLAVES = ['liquidez_corriente', 'razon_rapida', 'rotacion_inventarios', 'periodo_cobro', 'endeudamiento', 'cargos_interes_fijo', 'margen_bruto', 'margen_neto', 'roa', 'roe'];

dashboardRouter.get('/', permitir(...TODOS), async (req, res) => {
  const anioSolicitado = z.coerce.number().int().min(2000).max(2100).optional().parse(req.query.anio);
  const { rows } = await pool.query(`SELECT DISTINCT anio FROM saldos_periodo WHERE escenario = 'REAL' ORDER BY anio DESC`);
  const anios: number[] = rows.map((r) => Number(r.anio));
  if (anios.length === 0) throw new AppError(404, 'SIN_DATOS', 'No hay saldos registrados');
  const anio = anioSolicitado ?? anios[0];
  const [real, ppto, ctx, std, parametros, empresa] = await Promise.all([
    cargarLibro('REAL', [anio - 1, anio]),
    cargarLibro('PRESUPUESTO', [anio]),
    contextoRazones(),
    estandares(),
    cargarParametros(),
    cargarEmpresa()
  ]);
  const meses = real.meses(anio);
  if (meses.length === 0) throw new AppError(404, 'SIN_DATOS', `No hay saldos reales para ${anio}`);
  const hasta = meses[meses.length - 1];
  const tienePpto = ppto.meses(anio).length > 0;
  const ventasMes = Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
    mes: m,
    real: real.tiene(anio, m) ? txt(estadoResultados(real, anio, m, m).ventasNetas) : null,
    presupuesto: tienePpto && ppto.tiene(anio, m) ? txt(estadoResultados(ppto, anio, m, m).ventasNetas) : null,
    anterior: real.tiene(anio - 1, m) ? txt(estadoResultados(real, anio - 1, m, m).ventasNetas) : null
  }));
  const er = estadoResultados(real, anio, 1, hasta);
  const erP = tienePpto ? estadoResultados(ppto, anio, 1, hasta) : null;
  const sit = situacion(real, anio, hasta);
  const actual = razonesPeriodo(real, anio, hasta, ctx)!;
  const anterior = razonesPeriodo(real, anio - 1, hasta, ctx);
  const presupuesto = tienePpto ? razonesPeriodo(ppto, anio, hasta, ctx) : null;
  const tolerancia = parametros.tolerancia_presupuesto ?? D('0.05');
  const costoCapital = parametros.costo_capital ?? null;
  const roa = actual.valores.roa;

  res.json({
    empresa: { nombre: empresa.nombre_comercial, razonSocial: empresa.razon_social, tamano: empresa.tamano },
    anios, anio, hastaMes: hasta,
    kpis: {
      ventasNetas: txt(er.ventasNetas),
      ventasPresupuesto: erP ? txt(erP.ventasNetas) : null,
      utilidadBruta: txt(er.utilidadBruta),
      utilidadEjercicio: txt(er.utilidadEjercicio),
      utilidadPresupuesto: erP ? txt(erP.utilidadEjercicio) : null,
      efectivo: txt(sit.efectivo),
      capitalTrabajo: txt(sit.activoCorriente.minus(sit.pasivoCorriente)),
      activoTotal: txt(sit.activoTotal)
    },
    ventasMes,
    efectivoMes: meses.map((m) => ({ mes: m, efectivo: txt(real.saldo('1101', anio, m)) })),
    composicionActivoCorriente: [
      { nombre: 'Efectivo', monto: txt(sit.efectivo) },
      { nombre: 'Clientes', monto: txt(sit.cuentasPorCobrar) },
      { nombre: 'Inventarios', monto: txt(sit.inventario.plus(sit.inventarioTransito)) },
      { nombre: 'Otros', monto: txt(sit.activoCorriente.minus(sit.efectivo).minus(sit.cuentasPorCobrar).minus(sit.inventario).minus(sit.inventarioTransito)) }
    ],
    razones: RAZONES.filter((r) => CLAVES.includes(r.clave)).map((r) => {
      const v = actual.valores[r.clave];
      const ref = std[r.clave] ?? presupuesto?.valores[r.clave] ?? anterior?.valores[r.clave] ?? null;
      return {
        clave: r.clave, nombre: r.nombre, categoria: r.categoria, decision: r.decision, unidad: r.unidad,
        formula: r.formula, interpretacion: r.interpretacion,
        valor: num(v), anterior: num(anterior?.valores[r.clave] ?? null), presupuesto: num(presupuesto?.valores[r.clave] ?? null),
        estandar: num(std[r.clave] ?? null),
        referencia: std[r.clave] ? 'estándar de la industria' : presupuesto ? 'presupuesto' : 'año anterior',
        semaforo: semaforo(r.clave, v, ref, tolerancia)
      };
    }),
    supervivencia: {
      roa: num(roa),
      costoCapital: num(costoCapital),
      cumple: roa !== null && costoCapital !== null ? roa.gt(costoCapital) : null,
      ...TEMAS.supervivencia
    }
  });
});
