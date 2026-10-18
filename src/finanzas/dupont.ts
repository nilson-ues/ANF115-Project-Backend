import { Decimal, dividir } from './dinero';
import { Situacion } from './estados';
import { ValoresRazones } from './razones';

export interface ArbolDupont {
  margenNeto: Decimal | null;
  rotacionActivos: Decimal | null;
  multiplicador: Decimal | null;
  roa: Decimal | null;
  roe: Decimal | null;
  roaDirecto: Decimal | null;
  roeDirecto: Decimal | null;
}

// ROA = Margen neto × Rotación de activos; ROE = ROA × (Activo total / Patrimonio)
export function dupont(r: ValoresRazones, sit: Situacion): ArbolDupont {
  const multiplicador = dividir(sit.activoTotal, sit.patrimonio);
  const roa = r.margen_neto && r.rotacion_activos ? r.margen_neto.times(r.rotacion_activos) : null;
  return {
    margenNeto: r.margen_neto,
    rotacionActivos: r.rotacion_activos,
    multiplicador,
    roa,
    roe: roa && multiplicador ? roa.times(multiplicador) : null,
    roaDirecto: r.roa,
    roeDirecto: r.roe
  };
}

export function cambioRelativo(actual: Decimal | null, base: Decimal | null) {
  return actual === null || base === null ? null : dividir(actual.minus(base), base.abs());
}
