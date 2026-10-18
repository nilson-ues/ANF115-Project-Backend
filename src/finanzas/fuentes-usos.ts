import { CERO, dividir, sumar } from './dinero';
import { balanceGeneral, CuentaCatalogo, situacion } from './estados';
import { Libro } from './libro';

interface Periodo { anio: number; mes: number }

// Fuente: baja un activo o sube un pasivo/patrimonio. Uso: lo contrario
export function fuentesUsos(libro: Libro, catalogo: CuentaCatalogo[], base: Periodo, actual: Periodo) {
  const bgBase = balanceGeneral(libro, catalogo, base.anio, base.mes);
  const bgActual = balanceGeneral(libro, catalogo, actual.anio, actual.mes);
  const cuentas = bgActual.filas
    .map((f, i) => ({ ...f, base: bgBase.filas[i].monto, actual: f.monto, variacion: f.monto.minus(bgBase.filas[i].monto) }))
    .filter((f) => f.detalle && !f.variacion.isZero())
    .map((f) => {
      const esActivo = f.codigo.startsWith('1');
      const fuente = esActivo ? f.variacion.lt(0) : f.variacion.gt(0);
      return { codigo: f.codigo, nombre: f.nombre, base: f.base, actual: f.actual, variacion: f.variacion, clasificacion: fuente ? 'fuente' as const : 'uso' as const, monto: f.variacion.abs() };
    });
  const fuentes = cuentas.filter((c) => c.clasificacion === 'fuente');
  const usos = cuentas.filter((c) => c.clasificacion === 'uso');
  const totalFuentes = sumar(fuentes.map((c) => c.monto));
  const totalUsos = sumar(usos.map((c) => c.monto));
  return {
    fuentes, usos, totalFuentes, totalUsos,
    diferencia: totalFuentes.minus(totalUsos),
    descuadreBalances: bgActual.diferencia.minus(bgBase.diferencia)
  };
}

export function capitalTrabajo(libro: Libro, anio: number, mes: number) {
  const s = situacion(libro, anio, mes);
  const neto = s.activoCorriente.minus(s.pasivoCorriente);
  return {
    activoCorriente: s.activoCorriente,
    pasivoCorriente: s.pasivoCorriente,
    neto,
    financiadoCortoPlazo: dividir(s.pasivoCorriente, s.activoCorriente),
    financiadoLargoPlazo: neto.gt(0) ? dividir(neto, s.activoCorriente) : CERO
  };
}
