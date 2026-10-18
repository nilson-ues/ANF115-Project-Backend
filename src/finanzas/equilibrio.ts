import { Decimal, dividir, sumar } from './dinero';
import { EstadoResultados } from './estados';

export type Comportamiento = 'FIJO' | 'VARIABLE';
export type RubroCosto = 'costoVentas' | 'gastosVenta' | 'gastosAdministracion' | 'gastosFinancieros';

// Fórmula del punto de equilibrio en ventas ($) para empresa comercial; ajustar aquí si cambia
export function puntoEquilibrio(ventas: Decimal, costosFijos: Decimal, costosVariables: Decimal) {
  const razonVariable = dividir(costosVariables, ventas);
  const margenContribucion = razonVariable === null ? null : new Decimal(1).minus(razonVariable);
  const pe = margenContribucion && margenContribucion.gt(0) ? costosFijos.div(margenContribucion) : null;
  return {
    razonVariable,
    margenContribucion,
    pe,
    margenSeguridad: pe === null ? null : dividir(ventas.minus(pe), ventas)
  };
}

export function equilibrioEmpresa(er: EstadoResultados, clasificacion: Record<RubroCosto, Comportamiento>) {
  const rubros = (Object.keys(clasificacion) as RubroCosto[]).map((r) => ({ rubro: r, comportamiento: clasificacion[r], monto: er[r] }));
  const fijos = sumar(rubros.filter((r) => r.comportamiento === 'FIJO').map((r) => r.monto));
  const variables = sumar(rubros.filter((r) => r.comportamiento === 'VARIABLE').map((r) => r.monto));
  const resultado = puntoEquilibrio(er.ventasNetas, fijos, variables);
  // Estado de resultados con ventas = PE: los costos variables se mantienen en la misma proporción
  const comprobacion = resultado.pe && resultado.razonVariable
    ? {
        ventas: resultado.pe,
        costosVariables: resultado.pe.times(resultado.razonVariable),
        costosFijos: fijos,
        utilidad: resultado.pe.minus(resultado.pe.times(resultado.razonVariable)).minus(fijos)
      }
    : null;
  return { ventas: er.ventasNetas, rubros, fijos, variables, ...resultado, utilidadActual: er.ventasNetas.minus(variables).minus(fijos), comprobacion };
}

