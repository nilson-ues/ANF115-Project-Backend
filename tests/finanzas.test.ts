import historico from '../db/seeds/historico.json';
import { D, Decimal } from '../src/finanzas/dinero';
import { estadoResultados, flujoEfectivo, situacion } from '../src/finanzas/estados';
import { Libro } from '../src/finanzas/libro';
import { impuestoRenta, proyectarResultados, proyectarVentas, reservaLegal, variacionUtilidadBruta } from '../src/finanzas/presupuesto';
import { calcularRazones } from '../src/finanzas/razones';

const filas = (escenario: string) =>
  (historico as { anio: number; mes: number; escenario: string; cuenta: string; monto: string }[])
    .filter((f) => f.escenario === escenario)
    .map((f) => ({ anio: f.anio, mes: f.mes, cuenta: f.cuenta, monto: f.monto }));

const real = new Libro(filas('REAL'));
const ppto = new Libro([...filas('REAL').filter((f) => f.anio === 2008), ...filas('PRESUPUESTO')]);

const cerca = (valor: Decimal, esperado: string, tolerancia = '0.05') =>
  expect(valor.minus(D(esperado)).abs().lte(D(tolerancia))).toBe(true);

const INFLACION_2010 = ['-0.0034', '-0.0038', '-0.0055', '-0.0020', '-0.0009', '0.0043', '0.0124', '0.0145', '0.0174', '0.0165', '0.0158', '0.0152'].map(D);
const COMPRAS_2010 = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.3, 0.3, 0.3, 0.3, 0.4].map(D);

describe('Estados financieros históricos (tesis, Anexo 4)', () => {
  test('Estado de resultados real 2009', () => {
    const er = estadoResultados(real, 2009, 1, 12);
    cerca(er.ventasTotales, '885850.10');
    cerca(er.ventasNetas, '866126.16');
    cerca(er.costoVentas, '502855.68');
    cerca(er.inventarioInicial, '376850.61');
    cerca(er.inventarioFinal, '361213.70');
    cerca(er.utilidadBruta, '363270.48');
    cerca(er.utilidadOperacion, '40511.77');
    cerca(er.utilidadAntesImpuesto, '32248.62');
    cerca(er.utilidadEjercicio, '21774.90');
  });

  test('Estado de resultados real 2008 y presupuesto 2009', () => {
    cerca(estadoResultados(real, 2008, 1, 12).utilidadEjercicio, '63013.38');
    const p = estadoResultados(ppto, 2009, 1, 12);
    cerca(p.ventasNetas, '967088.05');
    cerca(p.utilidadBruta, '437883.82');
    cerca(p.utilidadEjercicio, '72984.53');
  });

  test('Balance general al 31/12/2009 cuadra', () => {
    const s = situacion(real, 2009, 12);
    cerca(s.activoCorriente, '694904.25');
    cerca(s.activoTotal, '1356374.87');
    cerca(s.pasivoTotal, '851306.05');
    cerca(s.patrimonio, '505068.82');
    cerca(s.activoTotal.minus(s.pasivoTotal).minus(s.patrimonio), '0');
  });

  test('Flujo de efectivo 2009 concilia con el efectivo del balance', () => {
    const flujo = flujoEfectivo(real, 2009, 1, 12)!;
    cerca(flujo.efectivoInicial, '7373.03');
    cerca(flujo.efectivoBalance, '41078.88');
    cerca(flujo.diferencia, '0');
  });
});

describe('Razones financieras 2009 (Unidad II)', () => {
  const r = calcularRazones({
    er: estadoResultados(real, 2009, 1, 12),
    sit: situacion(real, 2009, 12),
    factorAnual: D(1),
    acciones: 3812,
    arrendamientoAnual: D(0),
    principalAnual: D(0),
    tasaIsr: D('0.25')
  });
  const truncar = (v: Decimal | null) => v!.toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber();

  test('Liquidez corriente ~1.42 y prueba ácida ~0.67 como en la tesis', () => {
    expect(truncar(r.liquidez_corriente)).toBe(1.42);
    expect(truncar(r.razon_rapida)).toBe(0.67);
  });

  test('Razones derivadas son consistentes', () => {
    expect(r.edad_inventario!.toNumber()).toBeCloseTo(365 / r.rotacion_inventarios!.toNumber(), 6);
    cerca(r.capital_trabajo_neto!, '208347.73');
    cerca(r.valor_libros_accion!, '132.49', '0.01');
  });
});

describe('Presupuesto 2010 (tesis, cuadros 12 a 14)', () => {
  const supuestos = {
    ventasNetasBase: D('866126.16'),
    crecimiento: D('0.05'),
    inflaciones: INFLACION_2010,
    comprasPct: COMPRAS_2010,
    rebajasVentasPct: D(0),
    costoVentasPct: D('0.45'),
    gastosVentaPct: D('0.25'),
    gastosAdministracionPct: D('0.12'),
    gastosFinancierosMes: D(800),
    inventarioInicial: D('361213.70'),
    reservaPct: D('0.07'),
    reservaAcumulada: D('39080.65'),
    reservaLimite: D('76240.00'),
    isrPct: D('0.25')
  };

  test('Ventas netas mensuales 2010', () => {
    const esperadas = ['75540.64', '75511.77', '75389.06', '75641.68', '75721.08', '76096.40', '76681.04', '76832.61', '77041.92', '76976.96', '76926.44', '76883.13'];
    const ventas = proyectarVentas(supuestos.ventasNetasBase, supuestos.crecimiento, supuestos.inflaciones);
    ventas.forEach((v, i) => expect(v.toFixed(2)).toBe(esperadas[i]));
  });

  test('Totales del estado de resultados proyectado 2010', () => {
    const { meses, total } = proyectarResultados(supuestos);
    cerca(total.ventasNetas, '915242.73');
    cerca(total.costoVentas, '411859.23');
    cerca(total.compras, '202673.88');
    cerca(total.inventarioFinal, '152028.35');
    cerca(total.utilidadBruta, '503383.50');
    cerca(total.gastosAdministracion, '109829.13');
    cerca(total.gastosVenta, '228810.68');
    cerca(total.gastosOperacion, '338639.81');
    cerca(total.utilidadOperacion, '164743.69');
    cerca(total.gastosFinancieros, '9600.00');
    cerca(total.utilidadAntesImpuesto, '155143.69');
    cerca(total.reservaLegal, '10860.06');
    cerca(total.impuestoRenta, '36070.91');
    cerca(total.utilidadEjercicio, '108212.72');
    expect(meses[0].compras.toFixed(2)).toBe('11331.10');
    expect(meses[0].costoVentas.toFixed(2)).toBe('33993.29');
    expect(meses[0].inventarioFinal.toFixed(2)).toBe('338551.51');
  });

  test('Reserva legal e ISR de enero 2010 (verificación de la sección 3)', () => {
    const reserva = reservaLegal(D('12797.31'), D('0.07'), D(0), D('76240'));
    expect(reserva.toFixed(2)).toBe('895.81');
    const isr = impuestoRenta(D('12797.31'), reserva, D('0.25'));
    expect(isr.toFixed(2)).toBe('2975.38');
    expect(D('12797.31').minus(reserva).minus(isr).toFixed(2)).toBe('8926.12');
  });

  test('La reserva legal se detiene al llegar a la quinta parte del capital', () => {
    expect(reservaLegal(D(100000), D('0.07'), D('76000'), D('76240')).toFixed(2)).toBe('240.00');
  });
});

describe('Control presupuestario 2009', () => {
  test('Descomposición de la variación de utilidad bruta', () => {
    const v = variacionUtilidadBruta(D('866126.16'), D('363270.48'), D('967088.05'), D('437883.82'));
    cerca(v.porVentaNoLograda, '-45714.12', '0.01');
    cerca(v.porMargenNoLogrado, '-28899.22', '0.01');
    cerca(v.total, '-74613.34', '0.01');
  });
});
