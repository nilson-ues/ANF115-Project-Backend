import { CERO, D, Decimal, sumar } from './dinero';

export interface SaldoFila {
  anio: number;
  mes: number;
  cuenta: string;
  monto: Decimal.Value;
}

export class Libro {
  private datos = new Map<string, Decimal>();
  private periodos = new Set<string>();

  constructor(filas: SaldoFila[]) {
    for (const f of filas) {
      this.datos.set(`${f.anio}-${f.mes}-${f.cuenta}`, D(f.monto));
      this.periodos.add(`${f.anio}-${f.mes}`);
    }
  }

  tiene(anio: number, mes: number) {
    return this.periodos.has(`${anio}-${mes}`);
  }

  meses(anio: number) {
    return Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => this.tiene(anio, m));
  }

  saldo(cuenta: string, anio: number, mes: number): Decimal {
    return this.datos.get(`${anio}-${mes}-${cuenta}`) ?? CERO;
  }

  saldoGrupo(prefijo: string, anio: number, mes: number): Decimal {
    let total = CERO;
    for (const [clave, valor] of this.datos) {
      const [a, m, cuenta] = clave.split('-');
      if (Number(a) === anio && Number(m) === mes && cuenta.startsWith(prefijo)) total = total.plus(valor);
    }
    return total;
  }

  movimiento(cuenta: string, anio: number, desde: number, hasta: number): Decimal {
    const valores: Decimal[] = [];
    for (let m = desde; m <= hasta; m++) valores.push(this.saldo(cuenta, anio, m));
    return sumar(valores);
  }
}

export function mesAnterior(anio: number, mes: number) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}
