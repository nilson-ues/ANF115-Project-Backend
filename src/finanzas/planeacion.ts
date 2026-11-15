import { CERO, D, Decimal, sumar } from './dinero';

// ---------- Pronóstico de ventas (Guía práctica 1) ----------

export type MetodoPronostico = 'promedio' | 'ratio';

// Promedio de las tasas de cambio de un mes a otro: (V_t / V_t-1) − 1
export function ratioIncremento(ventas: Decimal[]): Decimal {
  const tasas: Decimal[] = [];
  for (let i = 1; i < ventas.length; i++) {
    if (!ventas[i - 1].isZero()) tasas.push(ventas[i].div(ventas[i - 1]).minus(1));
  }
  return tasas.length ? sumar(tasas).div(tasas.length) : CERO;
}

export function pronosticoVentas(base: Decimal[], metodo: MetodoPronostico, ratio?: Decimal): Decimal[] {
  if (metodo === 'promedio') {
    const promedio = sumar(base).div(base.length);
    return base.map(() => promedio);
  }
  const r = ratio ?? ratioIncremento(base);
  return base.map((v) => v.times(D(1).plus(r)));
}

// ---------- Presupuesto de caja ----------

export interface SupuestosCaja {
  saldoInicial: Decimal;
  costoPct: Decimal;
  gastosVentaPct: Decimal;
  gastosAdministracionPct: Decimal;
  gastosFinancierosMes: Decimal;
  impuestosMes: Decimal;
  contadoPct: Decimal;
  cobroMes1Pct: Decimal;
  cobroMes2Pct: Decimal;
  saldoMinimo: Decimal;
}

export interface MesCaja {
  mes: number;
  ventas: Decimal;
  cobros: Decimal;
  costo: Decimal;
  gastosVenta: Decimal;
  gastosAdministracion: Decimal;
  gastosFinancieros: Decimal;
  impuestos: Decimal;
  totalSalidas: Decimal;
  flujoNeto: Decimal;
  saldoInicial: Decimal;
  saldoFinal: Decimal;
  financiamiento: Decimal;
  excedente: Decimal;
}

export function presupuestoCaja(ventas: Decimal[], s: SupuestosCaja): MesCaja[] {
  const meses: MesCaja[] = [];
  let saldo = s.saldoInicial;
  ventas.forEach((v, i) => {
    const credito1 = i >= 1 ? ventas[i - 1].times(s.cobroMes1Pct) : CERO;
    const credito2 = i >= 2 ? ventas[i - 2].times(s.cobroMes2Pct) : CERO;
    const cobros = v.times(s.contadoPct).plus(credito1).plus(credito2);
    const costo = v.times(s.costoPct);
    const gastosVenta = v.times(s.gastosVentaPct);
    const gastosAdministracion = v.times(s.gastosAdministracionPct);
    const totalSalidas = sumar([costo, gastosVenta, gastosAdministracion, s.gastosFinancierosMes, s.impuestosMes]);
    const flujoNeto = cobros.minus(totalSalidas);
    const saldoFinal = saldo.plus(flujoNeto);
    meses.push({
      mes: i + 1, ventas: v, cobros, costo, gastosVenta, gastosAdministracion,
      gastosFinancieros: s.gastosFinancierosMes, impuestos: s.impuestosMes, totalSalidas, flujoNeto,
      saldoInicial: saldo, saldoFinal,
      financiamiento: Decimal.max(CERO, s.saldoMinimo.minus(saldoFinal)),
      excedente: Decimal.max(CERO, saldoFinal.minus(s.saldoMinimo))
    });
    saldo = saldoFinal;
  });
  return meses;
}

// ---------- Presupuesto de capital (Unidad III) ----------

export interface Recuperacion {
  anios: Decimal | null;
  acumulado: Decimal[];
}

// Flujo mixto: se suman las entradas hasta recuperar la inversión; la fracción del último año es proporcional
export function periodoRecuperacion(inversion: Decimal, flujos: Decimal[]): Recuperacion {
  const acumulado: Decimal[] = [];
  let suma = CERO;
  let anios: Decimal | null = null;
  flujos.forEach((f, i) => {
    const previo = suma;
    suma = suma.plus(f);
    acumulado.push(suma);
    if (anios === null && suma.gte(inversion) && f.gt(0)) {
      anios = D(i).plus(inversion.minus(previo).div(f));
    }
  });
  return { anios, acumulado };
}

export function valorPresente(flujos: Decimal[], k: Decimal): Decimal[] {
  return flujos.map((f, i) => f.div(D(1).plus(k).pow(i + 1)));
}

export function vpn(inversion: Decimal, flujos: Decimal[], k: Decimal): Decimal {
  return sumar(valorPresente(flujos, k)).minus(inversion);
}

// Bisección sobre el VPN; devuelve null si no hay cambio de signo en el intervalo
export function tir(inversion: Decimal, flujos: Decimal[]): Decimal | null {
  let bajo = D('-0.9999');
  let alto = D(10);
  const f = (k: Decimal) => vpn(inversion, flujos, k);
  if (f(bajo).times(f(alto)).gt(0)) return null;
  for (let i = 0; i < 200; i++) {
    const medio = bajo.plus(alto).div(2);
    const valor = f(medio);
    if (valor.abs().lt('1e-9')) return medio;
    if (f(bajo).times(valor).lt(0)) alto = medio;
    else bajo = medio;
  }
  return bajo.plus(alto).div(2);
}

export interface Eva {
  porAnio: Decimal[];
  valorPresente: Decimal;
  perpetuidad: Decimal | null;
}

// EVA = flujo de efectivo − costo de capital × capital invertido
export function eva(inversion: Decimal, flujos: Decimal[], k: Decimal): Eva {
  const cargo = inversion.times(k);
  const porAnio = flujos.map((f) => f.minus(cargo));
  const constante = flujos.length > 0 && flujos.every((f) => f.eq(flujos[0]));
  return {
    porAnio,
    valorPresente: sumar(valorPresente(porAnio, k)),
    perpetuidad: constante && k.gt(0) ? porAnio[0].div(k) : null
  };
}

// ---------- Política de crédito (Guía práctica 2) ----------

export interface SupuestosCredito {
  ventasCredito: Decimal;
  periodoCobroActual: Decimal;
  periodoCobroNuevo: Decimal;
  incrementoVentas: Decimal;
  costoVariable: Decimal;
  rendimientoRequerido: Decimal;
  diasAnio: Decimal;
}

export function politicaCredito(s: SupuestosCredito) {
  const rotacionAnterior = s.diasAnio.div(s.periodoCobroActual);
  const rotacionNueva = s.diasAnio.div(s.periodoCobroNuevo);
  const ventasAdicionales = s.ventasCredito.times(s.incrementoVentas);
  const rentabilidadVentasAdicionales = ventasAdicionales.times(D(1).minus(s.costoVariable));
  const cxcAdicionalesNuevas = ventasAdicionales.div(rotacionNueva);
  const inversionNuevas = cxcAdicionalesNuevas.times(s.costoVariable);
  const cxcAntes = s.ventasCredito.div(rotacionAnterior);
  const cxcOriginalesNuevo = s.ventasCredito.div(rotacionNueva);
  const inversionOriginales = cxcOriginalesNuevo.minus(cxcAntes);
  const inversionTotal = inversionNuevas.plus(inversionOriginales);
  const rendimientoRequerido = inversionTotal.times(s.rendimientoRequerido);
  const beneficioNeto = rentabilidadVentasAdicionales.minus(rendimientoRequerido);
  return {
    rotacionAnterior, rotacionNueva, ventasAdicionales, rentabilidadVentasAdicionales,
    cxcAdicionalesNuevas, inversionNuevas, cxcAntes, cxcOriginalesNuevo, inversionOriginales,
    inversionTotal, rendimientoRequerido, beneficioNeto, conviene: beneficioNeto.gt(0)
  };
}

// ---------- Administración del efectivo (Unidad IV) ----------

export function cicloEfectivo(edadInventario: Decimal, periodoCobro: Decimal, periodoPago: Decimal, desembolsosAnuales: Decimal, diasAnio: Decimal) {
  const cicloOperativo = edadInventario.plus(periodoCobro);
  const cicloConversion = cicloOperativo.minus(periodoPago);
  const rotacionEfectivo = cicloConversion.gt(0) ? diasAnio.div(cicloConversion) : null;
  return {
    cicloOperativo,
    cicloConversion,
    rotacionEfectivo,
    efectivoMinimo: rotacionEfectivo ? desembolsosAnuales.div(rotacionEfectivo) : null
  };
}
