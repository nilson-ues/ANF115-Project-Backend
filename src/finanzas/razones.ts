import { D, Decimal, dividir } from './dinero';
import { EstadoResultados, Situacion } from './estados';
import { RAZONES } from './teoria';

export interface BaseRazones {
  er: EstadoResultados;
  sit: Situacion;
  factorAnual: Decimal;
  acciones: number;
  arrendamientoAnual: Decimal;
  principalAnual: Decimal;
  tasaIsr: Decimal;
}

export type ValoresRazones = Record<string, Decimal | null>;

export function calcularRazones(b: BaseRazones): ValoresRazones {
  const f = b.factorAnual;
  const ventas = b.er.ventasNetas.times(f);
  const costo = b.er.costoVentas.times(f);
  const compras = b.er.compras.minus(b.er.rebajasCompras).times(f);
  const uaii = b.er.utilidadOperacion.times(f);
  const intereses = b.er.gastosFinancieros.times(f);
  const utilidadNeta = b.er.utilidadEjercicio.times(f);
  const acciones = D(b.acciones);
  const dias = D(365);

  const rotacionInventarios = dividir(costo, b.sit.inventario);
  const edadInventario = rotacionInventarios && !rotacionInventarios.isZero() ? dias.div(rotacionInventarios) : null;
  const ventasDiarias = ventas.div(dias);
  const comprasDiarias = compras.div(dias);
  const periodoCobro = dividir(b.sit.cuentasPorCobrar, ventasDiarias);
  const periodoPago = dividir(b.sit.cuentasPorPagar, comprasDiarias);
  const cicloConversion = edadInventario && periodoCobro && periodoPago ? edadInventario.plus(periodoCobro).minus(periodoPago) : null;
  const ajustePrincipal = D(1).minus(b.tasaIsr).isZero() ? null : b.principalAnual.div(D(1).minus(b.tasaIsr));
  const denominadorPagosFijos = ajustePrincipal ? intereses.plus(b.arrendamientoAnual).plus(ajustePrincipal) : null;

  return {
    liquidez_corriente: dividir(b.sit.activoCorriente, b.sit.pasivoCorriente),
    razon_rapida: dividir(b.sit.activoCorriente.minus(b.sit.inventario).minus(b.sit.inventarioTransito), b.sit.pasivoCorriente),
    capital_trabajo_neto: b.sit.activoCorriente.minus(b.sit.pasivoCorriente),
    rotacion_inventarios: rotacionInventarios,
    edad_inventario: edadInventario,
    periodo_cobro: periodoCobro,
    periodo_pago: periodoPago,
    rotacion_activos: dividir(ventas, b.sit.activoTotal),
    ciclo_conversion: cicloConversion,
    endeudamiento: dividir(b.sit.pasivoTotal, b.sit.activoTotal),
    cargos_interes_fijo: intereses.gt(0) ? uaii.div(intereses) : null,
    cobertura_pagos_fijos: denominadorPagosFijos && denominadorPagosFijos.gt(0)
      ? uaii.plus(b.arrendamientoAnual).div(denominadorPagosFijos)
      : null,
    margen_bruto: dividir(b.er.utilidadBruta, b.er.ventasNetas),
    margen_operativo: dividir(b.er.utilidadOperacion, b.er.ventasNetas),
    margen_neto: dividir(b.er.utilidadEjercicio, b.er.ventasNetas),
    roa: dividir(utilidadNeta, b.sit.activoTotal),
    roe: dividir(utilidadNeta, b.sit.patrimonio),
    utilidad_por_accion: dividir(utilidadNeta, acciones),
    valor_libros_accion: dividir(b.sit.patrimonio, acciones)
  };
}

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';

export function semaforo(clave: string, valor: Decimal | null, referencia: Decimal | null, tolerancia: Decimal): Semaforo {
  const def = RAZONES.find((r) => r.clave === clave);
  if (!def || def.mayorEsMejor === null || valor === null || referencia === null) return 'gris';
  const diferencia = valor.minus(referencia);
  const favorable = def.mayorEsMejor ? diferencia.gte(0) : diferencia.lte(0);
  if (favorable) return 'verde';
  if (referencia.isZero()) return 'rojo';
  return diferencia.abs().div(referencia.abs()).lte(tolerancia) ? 'amarillo' : 'rojo';
}
