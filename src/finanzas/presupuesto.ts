import { CERO, D, Decimal, dividir, r2, sumar } from './dinero';

export function proyectarVentas(ventasNetasBase: Decimal, crecimiento: Decimal, inflaciones: Decimal[]): Decimal[] {
  const mensual = ventasNetasBase.div(12);
  return inflaciones.map((inflacion) => r2(mensual.times(D(1).plus(crecimiento).plus(inflacion))));
}

export function reservaLegal(utilidadAntesImpuesto: Decimal, tasa: Decimal, reservaAcumulada: Decimal, limite: Decimal): Decimal {
  if (utilidadAntesImpuesto.lte(0)) return CERO;
  const disponible = Decimal.max(limite.minus(reservaAcumulada), CERO);
  return Decimal.min(r2(utilidadAntesImpuesto.times(tasa)), disponible);
}

export function impuestoRenta(utilidadAntesImpuesto: Decimal, reserva: Decimal, tasa: Decimal): Decimal {
  const base = utilidadAntesImpuesto.minus(reserva);
  return base.lte(0) ? CERO : r2(base.times(tasa));
}

export interface SupuestosPresupuesto {
  ventasNetasBase: Decimal;
  crecimiento: Decimal;
  inflaciones: Decimal[];
  comprasPct: Decimal[];
  rebajasVentasPct: Decimal;
  costoVentasPct: Decimal;
  gastosVentaPct: Decimal;
  gastosAdministracionPct: Decimal;
  gastosFinancierosMes: Decimal;
  inventarioInicial: Decimal;
  reservaPct: Decimal;
  reservaAcumulada: Decimal;
  reservaLimite: Decimal;
  isrPct: Decimal;
}

export interface MesProyectado {
  mes: number;
  ventasTotales: Decimal;
  rebajasVentas: Decimal;
  ventasNetas: Decimal;
  inventarioInicial: Decimal;
  compras: Decimal;
  inventarioFinal: Decimal;
  costoVentas: Decimal;
  utilidadBruta: Decimal;
  gastosVenta: Decimal;
  gastosAdministracion: Decimal;
  gastosOperacion: Decimal;
  utilidadOperacion: Decimal;
  gastosFinancieros: Decimal;
  utilidadAntesImpuesto: Decimal;
  reservaLegal: Decimal;
  impuestoRenta: Decimal;
  utilidadEjercicio: Decimal;
  rotacionInventario: Decimal | null;
}

export function proyectarResultados(s: SupuestosPresupuesto): { meses: MesProyectado[]; total: Omit<MesProyectado, 'mes'> } {
  const ventas = proyectarVentas(s.ventasNetasBase, s.crecimiento, s.inflaciones);
  let inventario = s.inventarioInicial;
  let reservaAcumulada = s.reservaAcumulada;
  const meses: MesProyectado[] = ventas.map((ventasNetas, i) => {
    const ventasTotales = s.rebajasVentasPct.isZero() ? ventasNetas : r2(ventasNetas.div(D(1).minus(s.rebajasVentasPct)));
    const rebajasVentas = ventasTotales.minus(ventasNetas);
    const compras = r2(ventasNetas.times(s.comprasPct[i]));
    const costoVentas = r2(ventasNetas.times(s.costoVentasPct));
    const inventarioInicial = inventario;
    const inventarioFinal = inventarioInicial.plus(compras).minus(costoVentas);
    inventario = inventarioFinal;
    const utilidadBruta = ventasNetas.minus(costoVentas);
    const gastosVenta = r2(ventasNetas.times(s.gastosVentaPct));
    const gastosAdministracion = r2(ventasNetas.times(s.gastosAdministracionPct));
    const gastosOperacion = gastosVenta.plus(gastosAdministracion);
    const utilidadOperacion = utilidadBruta.minus(gastosOperacion);
    const utilidadAntesImpuesto = utilidadOperacion.minus(s.gastosFinancierosMes);
    const reserva = reservaLegal(utilidadAntesImpuesto, s.reservaPct, reservaAcumulada, s.reservaLimite);
    reservaAcumulada = reservaAcumulada.plus(reserva);
    const isr = impuestoRenta(utilidadAntesImpuesto, reserva, s.isrPct);
    return {
      mes: i + 1, ventasTotales, rebajasVentas, ventasNetas, inventarioInicial, compras, inventarioFinal, costoVentas,
      utilidadBruta, gastosVenta, gastosAdministracion, gastosOperacion, utilidadOperacion,
      gastosFinancieros: s.gastosFinancierosMes, utilidadAntesImpuesto, reservaLegal: reserva, impuestoRenta: isr,
      utilidadEjercicio: utilidadAntesImpuesto.minus(reserva).minus(isr),
      rotacionInventario: dividir(costoVentas, inventarioFinal)
    };
  });
  const suma = (clave: keyof MesProyectado) => sumar(meses.map((m) => m[clave] as Decimal));
  const costoTotal = suma('costoVentas');
  const total = {
    ventasTotales: suma('ventasTotales'), rebajasVentas: suma('rebajasVentas'), ventasNetas: suma('ventasNetas'),
    inventarioInicial: s.inventarioInicial, compras: suma('compras'), inventarioFinal: inventario, costoVentas: costoTotal,
    utilidadBruta: suma('utilidadBruta'), gastosVenta: suma('gastosVenta'), gastosAdministracion: suma('gastosAdministracion'),
    gastosOperacion: suma('gastosOperacion'), utilidadOperacion: suma('utilidadOperacion'), gastosFinancieros: suma('gastosFinancieros'),
    utilidadAntesImpuesto: suma('utilidadAntesImpuesto'), reservaLegal: suma('reservaLegal'), impuestoRenta: suma('impuestoRenta'),
    utilidadEjercicio: suma('utilidadEjercicio'), rotacionInventario: dividir(costoTotal, inventario)
  };
  return { meses, total };
}

export function variacionUtilidadBruta(ventasReales: Decimal, utilidadBrutaReal: Decimal, ventasPpto: Decimal, utilidadBrutaPpto: Decimal) {
  const margenPpto = dividir(utilidadBrutaPpto, ventasPpto) ?? CERO;
  const margenReal = dividir(utilidadBrutaReal, ventasReales) ?? CERO;
  return {
    margenReal,
    margenPpto,
    porVentaNoLograda: r2(ventasReales.minus(ventasPpto).times(margenPpto)),
    porMargenNoLogrado: r2(margenReal.minus(margenPpto).times(ventasReales)),
    total: utilidadBrutaReal.minus(utilidadBrutaPpto)
  };
}
