import { CERO, D, Decimal, dividir } from './dinero';
import { Libro } from './libro';

export type TipoMovimiento = 'INGRESO' | 'GASTO';

export interface CategoriaBase {
  nombre: string;
  tipo: TipoMovimiento;
  cuenta: string | null;
  descripcion: string;
}

export const AJUSTES = 'Reversiones y ajustes de gastos';

export const CATEGORIAS_BASE: CategoriaBase[] = [
  { nombre: 'Ventas', tipo: 'INGRESO', cuenta: '4101', descripcion: 'Ventas netas de insumos médicos y farmacéuticos.' },
  { nombre: 'Servicios de anestesia y conexos', tipo: 'INGRESO', cuenta: '4101', descripcion: 'Servicios que presta la empresa además de la venta de productos.' },
  { nombre: 'Otros ingresos', tipo: 'INGRESO', cuenta: '4201', descripcion: 'Ingresos que no provienen de la operación principal.' },
  { nombre: AJUSTES, tipo: 'INGRESO', cuenta: null, descripcion: 'Saldos negativos de costos o gastos del mes (reversiones registradas en la contabilidad).' },
  { nombre: 'Costo de ventas', tipo: 'GASTO', cuenta: '5101', descripcion: 'Costo de la mercadería vendida.' },
  { nombre: 'Gastos de administración', tipo: 'GASTO', cuenta: '6101', descripcion: 'Sueldos administrativos, honorarios, servicios y otros gastos de oficina.' },
  { nombre: 'Gastos de venta', tipo: 'GASTO', cuenta: '6102', descripcion: 'Comisiones, publicidad, distribución y otros gastos para vender.' },
  { nombre: 'Gastos financieros', tipo: 'GASTO', cuenta: '6201', descripcion: 'Intereses y comisiones bancarias.' },
  { nombre: 'Gastos no deducibles', tipo: 'GASTO', cuenta: '6202', descripcion: 'Gastos que la ley no permite deducir del impuesto sobre la renta.' },
  { nombre: 'Alquiler', tipo: 'GASTO', cuenta: '6101', descripcion: 'Arrendamiento de oficinas y bodegas.' },
  { nombre: 'Servicios básicos', tipo: 'GASTO', cuenta: '6101', descripcion: 'Energía eléctrica, agua, teléfono e internet.' },
  { nombre: 'Transporte', tipo: 'GASTO', cuenta: '6102', descripcion: 'Combustible, fletes y entrega de pedidos.' },
  { nombre: 'Suministros', tipo: 'GASTO', cuenta: '6101', descripcion: 'Papelería, limpieza y materiales de oficina.' }
];

// Categorías que se cargan con el histórico de la tesis y la cuenta de donde salen
const HISTORICO: { categoria: string; monto: (l: Libro, a: number, m: number) => Decimal }[] = [
  { categoria: 'Ventas', monto: (l, a, m) => l.saldo('4101', a, m).minus(l.saldo('4102', a, m)) },
  { categoria: 'Otros ingresos', monto: (l, a, m) => l.saldo('4201', a, m) },
  { categoria: 'Costo de ventas', monto: (l, a, m) => l.saldo('5101', a, m) },
  { categoria: 'Gastos de administración', monto: (l, a, m) => l.saldo('6101', a, m) },
  { categoria: 'Gastos de venta', monto: (l, a, m) => l.saldo('6102', a, m) },
  { categoria: 'Gastos financieros', monto: (l, a, m) => l.saldo('6201', a, m) },
  { categoria: 'Gastos no deducibles', monto: (l, a, m) => l.saldo('6202', a, m) }
];

export interface MovimientoHistorico {
  fecha: string;
  tipo: TipoMovimiento;
  categoria: string;
  concepto: string;
  monto: Decimal;
}

const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);

export function historicoDesdeLibro(libro: Libro, anio: number): MovimientoHistorico[] {
  const lista: MovimientoHistorico[] = [];
  for (const mes of libro.meses(anio)) {
    for (const h of HISTORICO) {
      const monto = h.monto(libro, anio, mes);
      if (monto.isZero()) continue;
      const base = CATEGORIAS_BASE.find((c) => c.nombre === h.categoria)!;
      const fecha = ultimoDia(anio, mes);
      if (monto.gt(0)) {
        lista.push({ fecha, tipo: base.tipo, categoria: base.nombre, concepto: `${base.nombre} del mes (Pérez Tejada et al., 2009)`, monto });
      } else if (base.tipo === 'GASTO') {
        // un gasto negativo es una reversión; se registra como ingreso para no usar montos negativos
        lista.push({ fecha, tipo: 'INGRESO', categoria: AJUSTES, concepto: `Reversión de ${base.nombre.toLowerCase()} del mes`, monto: monto.abs() });
      } else {
        throw new Error(`Ingreso negativo en ${anio}-${mes}: ${base.nombre}`);
      }
    }
  }
  return lista;
}

export interface Indicadores {
  ingresos: Decimal;
  gastos: Decimal;
  resultado: Decimal;
  porcentajeGastos: Decimal | null;
}

export function indicadores(ingresos: Decimal.Value, gastos: Decimal.Value): Indicadores {
  const i = D(ingresos);
  const g = D(gastos);
  return {
    ingresos: i,
    gastos: g,
    resultado: i.minus(g),
    porcentajeGastos: i.gt(CERO) ? dividir(g, i)!.times(100) : null
  };
}

export type Agrupacion = 'dia' | 'mes' | 'anio';

export function clavePeriodo(fecha: string, agrupar: Agrupacion) {
  if (agrupar === 'anio') return fecha.slice(0, 4);
  if (agrupar === 'mes') return fecha.slice(0, 7);
  return fecha.slice(0, 10);
}
