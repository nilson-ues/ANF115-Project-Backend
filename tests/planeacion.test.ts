import historico from '../db/seeds/historico.json';
import { D, sumar } from '../src/finanzas/dinero';
import { estadoResultados } from '../src/finanzas/estados';
import { Libro } from '../src/finanzas/libro';
import { AJUSTES, historicoDesdeLibro, indicadores } from '../src/finanzas/movimientos';
import {
  cicloEfectivo, eva, periodoRecuperacion, politicaCredito, presupuestoCaja, pronosticoVentas, ratioIncremento, tir, vpn
} from '../src/finanzas/planeacion';

const filas = historico as { anio: number; mes: number; escenario: string; cuenta: string; monto: string }[];
const real = new Libro(filas.filter((f) => f.escenario === 'REAL'));

describe('Control de ingresos y gastos (guía del proyecto)', () => {
  test('Resultado financiero y porcentaje de gastos', () => {
    const i = indicadores('1000', '250');
    expect(i.resultado.toFixed(2)).toBe('750.00');
    expect(i.porcentajeGastos!.toFixed(2)).toBe('25.00');
  });

  test('Sin ingresos el porcentaje de gastos no se calcula', () => {
    expect(indicadores('0', '100').porcentajeGastos).toBeNull();
  });

  test.each([2008, 2009])('Los movimientos cargados de la tesis concilian con la utilidad antes de impuesto %i', (anio) => {
    const movs = historicoDesdeLibro(real, anio);
    const total = (t: string) => sumar(movs.filter((m) => m.tipo === t).map((m) => m.monto));
    const resultado = total('INGRESO').minus(total('GASTO'));
    expect(resultado.toFixed(2)).toBe(estadoResultados(real, anio, 1, 12).utilidadAntesImpuesto.toFixed(2));
    expect(movs.every((m) => m.monto.gt(0))).toBe(true);
  });

  test('Ventas 2009 suman las ventas netas publicadas (US$866,126.16)', () => {
    const ventas = historicoDesdeLibro(real, 2009).filter((m) => m.categoria === 'Ventas');
    expect(sumar(ventas.map((m) => m.monto)).toFixed(2)).toBe('866126.16');
  });

  test('Los saldos negativos de gastos se registran como reversiones', () => {
    const ajustes = historicoDesdeLibro(real, 2009).filter((m) => m.categoria === AJUSTES);
    expect(ajustes.length).toBeGreaterThan(0);
    expect(ajustes.every((m) => m.tipo === 'INGRESO')).toBe(true);
  });
});

describe('Guía práctica 1: pronóstico y presupuesto de caja', () => {
  const ventas2023 = ['98540.50', '125570.50', '60785.60', '30266.00', '75288.00', '40089.80', '95710.00', '78450.25',
    '277539.07', '213568.07', '299508.00', '145876.00'].map(D);
  const supuestos = {
    saldoInicial: D('90723.36'), costoPct: D('0.42'), gastosVentaPct: D('0.38'), gastosAdministracionPct: D('0.075'),
    gastosFinancierosMes: D(6600), impuestosMes: D(11973), contadoPct: D(1), cobroMes1Pct: D(0), cobroMes2Pct: D(0), saldoMinimo: D(0)
  };

  test('El total de ventas 2023 coincide con la guía', () => {
    expect(sumar(ventas2023).toFixed(2)).toBe('1541191.79');
  });

  test('Método promedio: cada mes es el promedio mensual', () => {
    const p = pronosticoVentas(ventas2023, 'promedio');
    expect(p[0].toFixed(2)).toBe('128432.65');
    expect(sumar(p).toFixed(2)).toBe('1541191.79');
  });

  test('Método de ratio: aplica el promedio de las tasas de cambio mensual', () => {
    const r = ratioIncremento(ventas2023);
    const p = pronosticoVentas(ventas2023, 'ratio');
    expect(p[0].toFixed(2)).toBe(ventas2023[0].times(D(1).plus(r)).toFixed(2));
  });

  test('El flujo de caja encadena saldos y aplica los porcentajes de la guía', () => {
    const meses = presupuestoCaja(pronosticoVentas(ventas2023, 'promedio'), supuestos);
    const enero = meses[0];
    expect(enero.saldoInicial.toFixed(2)).toBe('90723.36');
    expect(enero.costo.toFixed(2)).toBe(enero.ventas.times('0.42').toFixed(2));
    expect(enero.totalSalidas.toFixed(2)).toBe(enero.ventas.times('0.875').plus(18573).toFixed(2));
    expect(meses[1].saldoInicial.eq(enero.saldoFinal)).toBe(true);
  });

  test('Cobros con ventas a crédito (ejemplo Pacific James, Unidad III)', () => {
    const meses = presupuestoCaja([D(250000), D(0), D(0)], { ...supuestos, contadoPct: D('0.10'), cobroMes1Pct: D('0.81'), cobroMes2Pct: D('0.09') });
    expect(meses[0].cobros.toFixed(2)).toBe('25000.00');
    expect(meses[1].cobros.toFixed(2)).toBe('202500.00');
    expect(meses[2].cobros.toFixed(2)).toBe('22500.00');
  });
});

describe('Unidad III: presupuesto de capital', () => {
  const flujos = [150000, 250000, 400000, 500000].map(D);

  test('VAN del ejemplo de la unidad (US$191,580 al 3 %)', () => {
    expect(vpn(D(1000000), flujos, D('0.03')).toFixed(0)).toBe('191580');
  });

  test('Periodo de recuperación con flujo mixto', () => {
    expect(periodoRecuperacion(D(1000000), flujos).anios!.toFixed(2)).toBe('3.40');
  });

  test('Periodo de recuperación de una anualidad = inversión ÷ entrada anual', () => {
    expect(periodoRecuperacion(D(42000), Array(5).fill(D(14000))).anios!.toFixed(2)).toBe('3.00');
  });

  test('VAN y TIR del ejemplo con reinversión al tercer mes (US$179,401.92; 45.66 %)', () => {
    const mensual = [135000, 135000, -65000, 135000, 135000, 135000].map(D);
    expect(vpn(D(200000), mensual, D('0.15')).toFixed(0)).toBe('179402');
    expect(tir(D(200000), mensual)!.times(100).toFixed(2)).toBe('45.66');
  });

  test('En la TIR el VPN es cero', () => {
    const t = tir(D(1000000), flujos)!;
    expect(vpn(D(1000000), flujos, t).abs().lt(0.01)).toBe(true);
  });

  test('EVA a perpetuidad del ejemplo (US$200,000)', () => {
    const e = eva(D(1000000), Array(10).fill(D(120000)), D('0.10'));
    expect(e.porAnio[0].toFixed(2)).toBe('20000.00');
    expect(e.perpetuidad!.toFixed(2)).toBe('200000.00');
  });
});

describe('Guía práctica 2: política de crédito', () => {
  const r = politicaCredito({
    ventasCredito: D(60000000), periodoCobroActual: D(45), periodoCobroNuevo: D(75), incrementoVentas: D('0.15'),
    costoVariable: D('0.80'), rendimientoRequerido: D('0.20'), diasAnio: D(360)
  });

  test('Rotaciones antes y después del cambio', () => {
    expect(r.rotacionAnterior.toFixed(2)).toBe('8.00');
    expect(r.rotacionNueva.toFixed(2)).toBe('4.80');
  });

  test('Rentabilidad e inversión adicional', () => {
    expect(r.rentabilidadVentasAdicionales.toFixed(0)).toBe('1800000');
    expect(r.cxcAdicionalesNuevas.toFixed(0)).toBe('1875000');
    expect(r.inversionNuevas.toFixed(0)).toBe('1500000');
    expect(r.cxcAntes.toFixed(0)).toBe('7500000');
    expect(r.cxcOriginalesNuevo.toFixed(0)).toBe('12500000');
    expect(r.inversionOriginales.toFixed(0)).toBe('5000000');
    expect(r.inversionTotal.toFixed(0)).toBe('6500000');
    expect(r.rendimientoRequerido.toFixed(0)).toBe('1300000');
  });

  test('Conviene extender el crédito porque 1.8 M > 1.3 M', () => {
    expect(r.conviene).toBe(true);
    expect(r.beneficioNeto.toFixed(0)).toBe('500000');
  });
});

describe('Unidad IV: ciclo de conversión del efectivo', () => {
  test('CCE = EPI + PPC − PPP y efectivo mínimo', () => {
    const c = cicloEfectivo(D(85), D(70), D(35), D(1200000), D(360));
    expect(c.cicloOperativo.toFixed(0)).toBe('155');
    expect(c.cicloConversion.toFixed(0)).toBe('120');
    expect(c.rotacionEfectivo!.toFixed(2)).toBe('3.00');
    expect(c.efectivoMinimo!.toFixed(0)).toBe('400000');
  });
});
