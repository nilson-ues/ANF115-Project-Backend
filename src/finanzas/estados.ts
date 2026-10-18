import { CERO, Decimal } from './dinero';
import { Libro, mesAnterior } from './libro';

export interface EstadoResultados {
  ventasTotales: Decimal;
  rebajasVentas: Decimal;
  ventasNetas: Decimal;
  inventarioInicial: Decimal;
  compras: Decimal;
  rebajasCompras: Decimal;
  inventarioFinal: Decimal;
  costoVentas: Decimal;
  utilidadBruta: Decimal;
  gastosAdministracion: Decimal;
  gastosVenta: Decimal;
  gastosOperacion: Decimal;
  utilidadOperacion: Decimal;
  gastosFinancieros: Decimal;
  gastosNoDeducibles: Decimal;
  ingresosNoOperacion: Decimal;
  utilidadAntesImpuesto: Decimal;
  reservaLegal: Decimal;
  impuestoRenta: Decimal;
  utilidadEjercicio: Decimal;
}

export type ClaveER = keyof EstadoResultados;

export const LINEAS_ER: { clave: ClaveER; nombre: string; tipo: 'detalle' | 'subtotal' | 'total' | 'sub'; sentido: 1 | -1 }[] = [
  { clave: 'ventasTotales', nombre: 'Ventas totales', tipo: 'detalle', sentido: 1 },
  { clave: 'rebajasVentas', nombre: '(-) Rebajas y devoluciones sobre ventas', tipo: 'detalle', sentido: -1 },
  { clave: 'ventasNetas', nombre: 'Ventas netas', tipo: 'subtotal', sentido: 1 },
  { clave: 'inventarioInicial', nombre: 'Inventario inicial', tipo: 'sub', sentido: -1 },
  { clave: 'compras', nombre: '(+) Compras', tipo: 'sub', sentido: -1 },
  { clave: 'rebajasCompras', nombre: '(-) Rebajas y devoluciones sobre compras', tipo: 'sub', sentido: 1 },
  { clave: 'inventarioFinal', nombre: '(-) Inventario final', tipo: 'sub', sentido: 1 },
  { clave: 'costoVentas', nombre: '(-) Costo de ventas', tipo: 'detalle', sentido: -1 },
  { clave: 'utilidadBruta', nombre: 'Utilidad bruta', tipo: 'subtotal', sentido: 1 },
  { clave: 'gastosAdministracion', nombre: 'Gastos de administración', tipo: 'sub', sentido: -1 },
  { clave: 'gastosVenta', nombre: 'Gastos de venta', tipo: 'sub', sentido: -1 },
  { clave: 'gastosOperacion', nombre: '(-) Gastos de operación', tipo: 'detalle', sentido: -1 },
  { clave: 'utilidadOperacion', nombre: 'Utilidad de operación', tipo: 'subtotal', sentido: 1 },
  { clave: 'gastosFinancieros', nombre: '(-) Gastos financieros', tipo: 'detalle', sentido: -1 },
  { clave: 'gastosNoDeducibles', nombre: '(-) Gastos no deducibles', tipo: 'detalle', sentido: -1 },
  { clave: 'ingresosNoOperacion', nombre: '(+) Ingresos de no operación', tipo: 'detalle', sentido: 1 },
  { clave: 'utilidadAntesImpuesto', nombre: 'Utilidad antes de impuesto y reserva', tipo: 'subtotal', sentido: 1 },
  { clave: 'reservaLegal', nombre: '(-) Reserva legal', tipo: 'detalle', sentido: -1 },
  { clave: 'impuestoRenta', nombre: '(-) Impuesto sobre la renta', tipo: 'detalle', sentido: -1 },
  { clave: 'utilidadEjercicio', nombre: 'Utilidad del ejercicio', tipo: 'total', sentido: 1 }
];

export function estadoResultados(libro: Libro, anio: number, desde: number, hasta: number): EstadoResultados {
  const mov = (cuenta: string) => libro.movimiento(cuenta, anio, desde, hasta);
  const ventasTotales = mov('4101');
  const rebajasVentas = mov('4102');
  const ventasNetas = ventasTotales.minus(rebajasVentas);
  const compras = mov('5201');
  const rebajasCompras = mov('5202');
  const costoVentas = mov('5101');
  const inventarioFinal = libro.saldo('1105', anio, hasta);
  const inventarioInicial = inventarioFinal.plus(costoVentas).minus(compras).plus(rebajasCompras);
  const utilidadBruta = ventasNetas.minus(costoVentas);
  const gastosAdministracion = mov('6101');
  const gastosVenta = mov('6102');
  const gastosOperacion = gastosAdministracion.plus(gastosVenta);
  const utilidadOperacion = utilidadBruta.minus(gastosOperacion);
  const gastosFinancieros = mov('6201');
  const gastosNoDeducibles = mov('6202');
  const ingresosNoOperacion = mov('4201');
  const utilidadAntesImpuesto = utilidadOperacion.minus(gastosFinancieros).minus(gastosNoDeducibles).plus(ingresosNoOperacion);
  const reservaLegal = mov('6301');
  const impuestoRenta = mov('6302');
  const utilidadEjercicio = utilidadAntesImpuesto.minus(reservaLegal).minus(impuestoRenta);
  return {
    ventasTotales, rebajasVentas, ventasNetas, inventarioInicial, compras, rebajasCompras, inventarioFinal,
    costoVentas, utilidadBruta, gastosAdministracion, gastosVenta, gastosOperacion, utilidadOperacion,
    gastosFinancieros, gastosNoDeducibles, ingresosNoOperacion, utilidadAntesImpuesto, reservaLegal,
    impuestoRenta, utilidadEjercicio
  };
}

export interface CuentaCatalogo {
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  padre_codigo: string | null;
  acepta_movimiento: boolean;
}

export interface Situacion {
  activoCorriente: Decimal;
  activoNoCorriente: Decimal;
  activoTotal: Decimal;
  pasivoCorriente: Decimal;
  pasivoNoCorriente: Decimal;
  pasivoTotal: Decimal;
  patrimonio: Decimal;
  efectivo: Decimal;
  cuentasPorCobrar: Decimal;
  inventario: Decimal;
  inventarioTransito: Decimal;
  cuentasPorPagar: Decimal;
  capitalSocial: Decimal;
}

export function situacion(libro: Libro, anio: number, mes: number): Situacion {
  const g = (prefijo: string) => libro.saldoGrupo(prefijo, anio, mes);
  const activoCorriente = g('11');
  const activoNoCorriente = g('12');
  const pasivoCorriente = g('21');
  const pasivoNoCorriente = g('22');
  return {
    activoCorriente,
    activoNoCorriente,
    activoTotal: activoCorriente.plus(activoNoCorriente),
    pasivoCorriente,
    pasivoNoCorriente,
    pasivoTotal: pasivoCorriente.plus(pasivoNoCorriente),
    patrimonio: g('3'),
    efectivo: g('1101'),
    cuentasPorCobrar: g('1102'),
    inventario: g('1105'),
    inventarioTransito: g('1106'),
    cuentasPorPagar: g('2102'),
    capitalSocial: g('3101')
  };
}

export function balanceGeneral(libro: Libro, catalogo: CuentaCatalogo[], anio: number, mes: number) {
  const filas = catalogo
    .filter((c) => ['ACTIVO', 'PASIVO', 'PATRIMONIO'].includes(c.tipo))
    .map((c) => ({ codigo: c.codigo, nombre: c.nombre, nivel: c.nivel, detalle: c.acepta_movimiento, monto: libro.saldoGrupo(c.codigo, anio, mes) }));
  const s = situacion(libro, anio, mes);
  const pasivoMasPatrimonio = s.pasivoTotal.plus(s.patrimonio);
  return {
    filas,
    activoTotal: s.activoTotal,
    pasivoTotal: s.pasivoTotal,
    patrimonio: s.patrimonio,
    pasivoMasPatrimonio,
    diferencia: s.activoTotal.minus(pasivoMasPatrimonio)
  };
}

interface Variacion {
  nombre: string;
  cuentas: string[];
  tipo: 'activo' | 'pasivo';
}

const OPERACION: Variacion[] = [
  { nombre: 'Cuentas y documentos por cobrar', cuentas: ['1102'], tipo: 'activo' },
  { nombre: 'Crédito fiscal IVA', cuentas: ['1103'], tipo: 'activo' },
  { nombre: 'Cuentas por cobrar por arrendamiento financiero', cuentas: ['1104'], tipo: 'activo' },
  { nombre: 'Inventarios comerciales', cuentas: ['1105'], tipo: 'activo' },
  { nombre: 'Inventario en tránsito', cuentas: ['1106'], tipo: 'activo' },
  { nombre: 'Gastos pagados por anticipado', cuentas: ['1108'], tipo: 'activo' },
  { nombre: 'Partes relacionadas', cuentas: ['1107', '1205'], tipo: 'activo' },
  { nombre: 'Cuentas y documentos por pagar', cuentas: ['2102'], tipo: 'pasivo' },
  { nombre: 'Remuneraciones y prestaciones por pagar', cuentas: ['2103'], tipo: 'pasivo' },
  { nombre: 'Acreedores varios y provisiones', cuentas: ['2104'], tipo: 'pasivo' },
  { nombre: 'Retenciones y descuentos', cuentas: ['2105'], tipo: 'pasivo' },
  { nombre: 'Impuesto por pagar', cuentas: ['2107'], tipo: 'pasivo' },
  { nombre: 'Provisión para garantía a clientes', cuentas: ['2202'], tipo: 'pasivo' },
  { nombre: 'Provisión para obligaciones laborales', cuentas: ['2203'], tipo: 'pasivo' }
];

const INVERSION: Variacion[] = [
  { nombre: 'Propiedad, planta y equipo (neto)', cuentas: ['1201'], tipo: 'activo' },
  { nombre: 'Activos intangibles', cuentas: ['1202'], tipo: 'activo' },
  { nombre: 'Inversiones permanentes', cuentas: ['1203'], tipo: 'activo' },
  { nombre: 'Depósitos en garantía L.P.', cuentas: ['1204'], tipo: 'activo' }
];

const FINANCIAMIENTO: Variacion[] = [
  { nombre: 'Préstamos bancarios C.P.', cuentas: ['2101'], tipo: 'pasivo' },
  { nombre: 'Préstamos bancarios L.P.', cuentas: ['2201'], tipo: 'pasivo' },
  { nombre: 'Dividendos por pagar', cuentas: ['2106'], tipo: 'pasivo' },
  { nombre: 'Capital social', cuentas: ['3101'], tipo: 'pasivo' }
];

export interface LineaFlujo {
  nombre: string;
  monto: Decimal;
}

export interface FlujoEfectivo {
  operacion: LineaFlujo[];
  totalOperacion: Decimal;
  inversion: LineaFlujo[];
  totalInversion: Decimal;
  financiamiento: LineaFlujo[];
  totalFinanciamiento: Decimal;
  flujoNeto: Decimal;
  efectivoInicial: Decimal;
  efectivoFinal: Decimal;
  efectivoBalance: Decimal;
  diferencia: Decimal;
}

export function flujoEfectivo(libro: Libro, anio: number, desde: number, hasta: number): FlujoEfectivo | null {
  const previo = mesAnterior(anio, desde);
  if (!libro.tiene(previo.anio, previo.mes) || !libro.tiene(anio, hasta)) return null;
  const inicial = (cuentas: string[]) => cuentas.reduce((t, c) => t.plus(libro.saldoGrupo(c, previo.anio, previo.mes)), CERO);
  const final = (cuentas: string[]) => cuentas.reduce((t, c) => t.plus(libro.saldoGrupo(c, anio, hasta)), CERO);
  const variar = (v: Variacion): LineaFlujo => ({
    nombre: `${v.tipo === 'activo' ? 'Decremento (incremento)' : 'Incremento (decremento)'} en ${v.nombre.toLowerCase()}`,
    monto: v.tipo === 'activo' ? inicial(v.cuentas).minus(final(v.cuentas)) : final(v.cuentas).minus(inicial(v.cuentas))
  });
  const er = estadoResultados(libro, anio, desde, hasta);
  const total = (lineas: LineaFlujo[]) => lineas.reduce((t, l) => t.plus(l.monto), CERO);

  const operacion: LineaFlujo[] = [
    { nombre: 'Utilidad del ejercicio', monto: er.utilidadEjercicio },
    { nombre: 'Reserva legal', monto: er.reservaLegal },
    { nombre: 'Gastos por intereses', monto: er.gastosFinancieros },
    ...OPERACION.map(variar)
  ];
  const inversion = INVERSION.map(variar);
  const cambioPatrimonio = final(['3']).minus(inicial(['3']));
  const cambioCapital = final(['3101']).minus(inicial(['3101']));
  const financiamiento: LineaFlujo[] = [
    ...FINANCIAMIENTO.map(variar),
    { nombre: 'Pago de intereses por préstamos', monto: er.gastosFinancieros.negated() },
    {
      nombre: 'Utilidades por distribuir y otros movimientos patrimoniales',
      monto: cambioPatrimonio.minus(cambioCapital).minus(er.utilidadEjercicio).minus(er.reservaLegal)
    }
  ];
  const totalOperacion = total(operacion);
  const totalInversion = total(inversion);
  const totalFinanciamiento = total(financiamiento);
  const flujoNeto = totalOperacion.plus(totalInversion).plus(totalFinanciamiento);
  const efectivoInicial = libro.saldo('1101', previo.anio, previo.mes);
  const efectivoFinal = efectivoInicial.plus(flujoNeto);
  const efectivoBalance = libro.saldo('1101', anio, hasta);
  return {
    operacion, totalOperacion, inversion, totalInversion, financiamiento, totalFinanciamiento,
    flujoNeto, efectivoInicial, efectivoFinal, efectivoBalance, diferencia: efectivoFinal.minus(efectivoBalance)
  };
}

export function cambiosPatrimonio(libro: Libro, catalogo: CuentaCatalogo[], anio: number, hasta: number) {
  const previo = mesAnterior(anio, 1);
  if (!libro.tiene(previo.anio, previo.mes)) return null;
  const componentes = catalogo.filter((c) => c.tipo === 'PATRIMONIO' && c.nivel === 2);
  const filas = componentes.map((c) => {
    const inicial = libro.saldoGrupo(c.codigo, previo.anio, previo.mes);
    const final = libro.saldoGrupo(c.codigo, anio, hasta);
    return { codigo: c.codigo, nombre: c.nombre, inicial, variacion: final.minus(inicial), final };
  });
  const totalInicial = filas.reduce((t, f) => t.plus(f.inicial), CERO);
  const totalFinal = filas.reduce((t, f) => t.plus(f.final), CERO);
  return { filas, totalInicial, totalVariacion: totalFinal.minus(totalInicial), totalFinal };
}
