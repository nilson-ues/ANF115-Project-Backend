import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const D = (valor: Decimal.Value | null | undefined) => new Decimal(valor ?? 0);
export const CERO = new Decimal(0);
export const r2 = (valor: Decimal) => valor.toDecimalPlaces(2);
export const txt = (valor: Decimal) => valor.toFixed(2);
export const sumar = (valores: Decimal[]) => valores.reduce((a, b) => a.plus(b), CERO);

export function dividir(numerador: Decimal, denominador: Decimal): Decimal | null {
  return denominador.isZero() ? null : numerador.div(denominador);
}

export function num(valor: Decimal | null, decimales = 4): number | null {
  return valor === null ? null : valor.toDecimalPlaces(decimales).toNumber();
}
