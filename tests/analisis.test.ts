import historico from '../db/seeds/historico.json';
import { CUENTAS } from '../db/seeds/base';
import { composicionVentas, variacion, verticalBalance, verticalResultados } from '../src/finanzas/analisis';
import { D } from '../src/finanzas/dinero';
import { dupont } from '../src/finanzas/dupont';
import { equilibrioEmpresa, puntoEquilibrio } from '../src/finanzas/equilibrio';
import { capitalTrabajo, fuentesUsos } from '../src/finanzas/fuentes-usos';
import { balanceGeneral, CuentaCatalogo, estadoResultados, situacion } from '../src/finanzas/estados';
import { Libro } from '../src/finanzas/libro';
import { calcularRazones } from '../src/finanzas/razones';

type Fila = { anio: number; mes: number; escenario: string; cuenta: string; monto: string };
const todas = historico as Fila[];
const libro = (escenario: string) => new Libro(todas.filter((f) => f.escenario === escenario));
const real = libro('REAL');
const ppto = libro('PRESUPUESTO');
const catalogo: CuentaCatalogo[] = CUENTAS.map((c) => ({
  codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, nivel: c.nivel, padre_codigo: c.padre, acepta_movimiento: c.acepta
}));

describe('Análisis vertical', () => {
  test('Estado de resultados 2009: ventas netas = 100% y sus componentes suman 100%', () => {
    const er = estadoResultados(real, 2009, 1, 12);
    const v = verticalResultados(er);
    expect(v.find((l) => l.clave === 'ventasNetas')!.porcentaje!.toFixed(6)).toBe('1.000000');
    expect(composicionVentas(er).toFixed(6)).toBe('1.000000');
  });

  test('Componentes del estado de resultados suman 100% en cada mes real y presupuestado', () => {
    for (const [l, anios] of [[real, [2008, 2009]], [ppto, [2009]]] as const) {
      for (const anio of anios) {
        for (const m of l.meses(anio)) expect(composicionVentas(estadoResultados(l, anio, m, m)).toFixed(6)).toBe('1.000000');
      }
    }
  });

  test('Balance: cuentas de detalle suman 100% del activo y 100% de pasivo + patrimonio', () => {
    for (const anio of [2008, 2009]) {
      for (const m of real.meses(anio)) {
        const v = verticalBalance(real, catalogo, anio, m);
        expect(v.sumaActivo.toFixed(6)).toBe('1.000000');
        expect(v.sumaPasivoPatrimonio.toFixed(6)).toBe('1.000000');
      }
    }
  });
});

describe('Ecuación contable', () => {
  test('Activo = Pasivo + Patrimonio en todos los períodos reales y presupuestados', () => {
    for (const [l, anios] of [[real, [2008, 2009]], [ppto, [2009]]] as const) {
      for (const anio of anios) {
        for (const m of l.meses(anio)) expect(balanceGeneral(l, catalogo, anio, m).diferencia.abs().lte(D('0.05'))).toBe(true);
      }
    }
  });
});

describe('Análisis horizontal', () => {
  test('Variación de ventas netas 2009 vs 2008', () => {
    const actual = estadoResultados(real, 2009, 1, 12).ventasNetas;
    const base = estadoResultados(real, 2008, 1, 12).ventasNetas;
    const v = variacion(actual, base, D('0.10'));
    expect(v.absoluta.toFixed(2)).toBe(actual.minus(base).toFixed(2));
    expect(v.relativa!.toFixed(6)).toBe(actual.minus(base).div(base).toFixed(6));
  });

  test('Resalta solo variaciones mayores al umbral y no divide entre cero', () => {
    expect(variacion(D(111), D(100), D('0.10')).resaltar).toBe(true);
    expect(variacion(D(110), D(100), D('0.10')).resaltar).toBe(false);
    expect(variacion(D(80), D(100), D('0.10')).resaltar).toBe(true);
    expect(variacion(D(50), D(0), D('0.10'))).toEqual({ absoluta: D(50), relativa: null, resaltar: false });
  });
});

describe('Sistema DuPont', () => {
  const base = (anio: number, hasta: number) => {
    const sit = situacion(real, anio, hasta);
    const r = calcularRazones({
      er: estadoResultados(real, anio, 1, hasta), sit, factorAnual: D(12).div(hasta), acciones: 3812,
      arrendamientoAnual: D(0), principalAnual: D(0), tasaIsr: D('0.25')
    });
    return dupont(r, sit);
  };

  test('ROA y ROE por DuPont son iguales a la fórmula directa (anual y acumulado mensual)', () => {
    for (const [anio, hasta] of [[2009, 12], [2008, 12], [2009, 6], [2008, 3]]) {
      const a = base(anio, hasta);
      expect(a.roa!.toFixed(10)).toBe(a.roaDirecto!.toFixed(10));
      expect(a.roe!.toFixed(10)).toBe(a.roeDirecto!.toFixed(10));
    }
  });
});

describe('Fuentes y usos y capital de trabajo', () => {
  test('Total de fuentes = total de usos de diciembre 2008 a diciembre 2009', () => {
    const r = fuentesUsos(real, catalogo, { anio: 2008, mes: 12 }, { anio: 2009, mes: 12 });
    expect(r.fuentes.length).toBeGreaterThan(0);
    expect(r.usos.length).toBeGreaterThan(0);
    expect(r.diferencia.toFixed(2)).toBe(r.descuadreBalances.neg().toFixed(2));
    expect(r.diferencia.abs().lte(D('0.10'))).toBe(true);
  });

  test('Clasificación: baja de activo y alza de pasivo son fuentes', () => {
    const r = fuentesUsos(real, catalogo, { anio: 2008, mes: 12 }, { anio: 2009, mes: 12 });
    for (const c of [...r.fuentes, ...r.usos]) {
      const esActivo = c.codigo.startsWith('1');
      const sube = c.variacion.gt(0);
      expect(c.clasificacion).toBe(esActivo === sube ? 'uso' : 'fuente');
    }
  });

  test('Capital de trabajo neto 2009 = activo corriente − pasivo corriente', () => {
    const ct = capitalTrabajo(real, 2009, 12);
    cercano(ct.neto, '208347.73');
    expect(ct.financiadoCortoPlazo!.plus(ct.financiadoLargoPlazo!).toFixed(6)).toBe('1.000000');
  });
});

function cercano(valor: ReturnType<typeof D>, esperado: string) {
  expect(valor.minus(D(esperado)).abs().lte(D('0.05'))).toBe(true);
}

describe('Punto de equilibrio', () => {
  const clasificacion = { costoVentas: 'VARIABLE', gastosVenta: 'VARIABLE', gastosAdministracion: 'FIJO', gastosFinancieros: 'FIJO' } as const;

  test('Con ventas = PE la utilidad (ventas − costos variables − costos fijos) es 0', () => {
    for (const anio of [2008, 2009]) {
      const r = equilibrioEmpresa(estadoResultados(real, anio, 1, 12), clasificacion);
      expect(r.pe).not.toBeNull();
      expect(r.comprobacion!.utilidad.abs().lte(D('0.000001'))).toBe(true);
    }
  });

  test('PE = CF / (1 − CV / Ventas) y margen de seguridad = (Ventas − PE) / Ventas', () => {
    const r = puntoEquilibrio(D(1000), D(300), D(400));
    expect(r.pe!.toFixed(2)).toBe('500.00');
    expect(r.margenSeguridad!.toFixed(4)).toBe('0.5000');
  });

  test('Sin margen de contribución no hay punto de equilibrio', () => {
    expect(puntoEquilibrio(D(1000), D(300), D(1000)).pe).toBeNull();
    expect(puntoEquilibrio(D(0), D(300), D(0)).pe).toBeNull();
  });
});
