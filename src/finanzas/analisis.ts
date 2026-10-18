import { CERO, Decimal, dividir, sumar } from './dinero';
import { balanceGeneral, CuentaCatalogo, EstadoResultados, LINEAS_ER } from './estados';
import { Libro } from './libro';

export function verticalResultados(er: EstadoResultados) {
  return LINEAS_ER.map((l) => ({ ...l, monto: er[l.clave], porcentaje: dividir(er[l.clave], er.ventasNetas) }));
}

// Ventas netas = costos y gastos + reserva + ISR + utilidad; sus % deben sumar 100
export function composicionVentas(er: EstadoResultados) {
  const partes = [
    er.costoVentas, er.gastosOperacion, er.gastosFinancieros, er.gastosNoDeducibles,
    er.ingresosNoOperacion.neg(), er.reservaLegal, er.impuestoRenta, er.utilidadEjercicio
  ];
  return sumar(partes.map((p) => dividir(p, er.ventasNetas) ?? CERO));
}

export function verticalBalance(libro: Libro, catalogo: CuentaCatalogo[], anio: number, mes: number) {
  const bg = balanceGeneral(libro, catalogo, anio, mes);
  const filas = bg.filas.map((f) => ({
    ...f,
    porcentaje: dividir(f.monto, f.codigo.startsWith('1') ? bg.activoTotal : bg.pasivoMasPatrimonio)
  }));
  const hojas = (prefijo: string[]) =>
    sumar(filas.filter((f) => prefijo.includes(f.codigo[0]) && f.detalle).map((f) => f.porcentaje ?? CERO));
  return { ...bg, filas, sumaActivo: hojas(['1']), sumaPasivoPatrimonio: hojas(['2', '3']) };
}

export function variacion(actual: Decimal, base: Decimal, umbral: Decimal) {
  const absoluta = actual.minus(base);
  const relativa = dividir(absoluta, base.abs());
  return { absoluta, relativa, resaltar: relativa !== null && relativa.abs().gt(umbral) };
}
