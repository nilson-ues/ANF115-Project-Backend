export type Categoria = 'Liquidez' | 'Actividad' | 'Endeudamiento' | 'Rentabilidad' | 'Mercado' | 'Capital de trabajo';
export type Decision = 'Administración de bienes' | 'Financiamiento' | 'Inversión';
export type Unidad = 'veces' | 'dias' | 'porcentaje' | 'dinero';

export interface DefinicionRazon {
  clave: string;
  nombre: string;
  categoria: Categoria;
  decision: Decision;
  unidad: Unidad;
  mayorEsMejor: boolean | null;
  formula: string;
  definicion: string;
  interpretacion: string;
  fuente: string;
}

const U2 = 'Unidad II - Herramientas de análisis financiero (Gitman)';
const U4 = 'Unidad IV - Administración de los activos circulantes (Gitman)';

export const RAZONES: DefinicionRazon[] = [
  {
    clave: 'liquidez_corriente', nombre: 'Liquidez corriente', categoria: 'Liquidez', decision: 'Administración de bienes',
    unidad: 'veces', mayorEsMejor: true, fuente: U2,
    formula: 'Activos corrientes / Pasivos corrientes',
    definicion: 'Mide la capacidad de la empresa para cumplir con sus obligaciones de corto plazo a medida que vencen.',
    interpretacion: 'Indica cuántos dólares de activo corriente respaldan cada dólar de deuda de corto plazo. Mientras más alta, más liquidez; el nivel adecuado depende de la industria.'
  },
  {
    clave: 'razon_rapida', nombre: 'Razón rápida (prueba ácida)', categoria: 'Liquidez', decision: 'Administración de bienes',
    unidad: 'veces', mayorEsMejor: true, fuente: U2,
    formula: '(Activos corrientes − Inventario) / Pasivos corrientes',
    definicion: 'Igual que la liquidez corriente pero sin el inventario, que suele ser el activo corriente menos líquido. Se restan los inventarios comerciales y en tránsito.',
    interpretacion: 'Muestra cuánto puede pagar la empresa de su deuda de corto plazo sin depender de vender inventario.'
  },
  {
    clave: 'capital_trabajo_neto', nombre: 'Capital de trabajo neto', categoria: 'Capital de trabajo', decision: 'Administración de bienes',
    unidad: 'dinero', mayorEsMejor: true, fuente: U2,
    formula: 'Activos corrientes − Pasivos corrientes',
    definicion: 'Cantidad de recursos de corto plazo que quedan después de cubrir las deudas de corto plazo; lo que la empresa necesita para mantener el giro habitual del negocio.',
    interpretacion: 'Un valor positivo indica holgura para operar; uno bajo o negativo aumenta el riesgo de no poder pagar a tiempo.'
  },
  {
    clave: 'rotacion_inventarios', nombre: 'Rotación de inventarios', categoria: 'Actividad', decision: 'Administración de bienes',
    unidad: 'veces', mayorEsMejor: true, fuente: U2,
    formula: 'Costo de ventas / Inventario',
    definicion: 'Mide la actividad o liquidez del inventario: cuántas veces se vende y se repone en el período.',
    interpretacion: 'Alta: los productos se venden rápido. Baja: exceso de inventario o inventario muerto (sin movimiento).'
  },
  {
    clave: 'edad_inventario', nombre: 'Edad promedio del inventario', categoria: 'Actividad', decision: 'Administración de bienes',
    unidad: 'dias', mayorEsMejor: false, fuente: U2,
    formula: '365 / Rotación de inventarios',
    definicion: 'Número promedio de días que se requieren para vender el inventario.',
    interpretacion: 'Mientras menos días, más rápido se convierte el inventario en ventas.'
  },
  {
    clave: 'periodo_cobro', nombre: 'Periodo promedio de cobro', categoria: 'Actividad', decision: 'Administración de bienes',
    unidad: 'dias', mayorEsMejor: false, fuente: U2,
    formula: 'Cuentas por cobrar / (Ventas anuales / 365)',
    definicion: 'Tiempo promedio que se tarda en cobrar las cuentas a los clientes.',
    interpretacion: 'Solo tiene sentido comparado con el plazo de crédito que se da a los clientes. Si se cobra en 60 días con plazo de 30, hay problemas de crédito o de cobro.'
  },
  {
    clave: 'periodo_pago', nombre: 'Periodo promedio de pago', categoria: 'Actividad', decision: 'Administración de bienes',
    unidad: 'dias', mayorEsMejor: null, fuente: U2,
    formula: 'Cuentas por pagar / (Compras anuales / 365)',
    definicion: 'Tiempo promedio que tarda la empresa en pagar a sus proveedores.',
    interpretacion: 'Se evalúa contra el plazo que dan los proveedores; pagar muy tarde baja la calificación de crédito de la empresa.'
  },
  {
    clave: 'rotacion_activos', nombre: 'Rotación de activos totales', categoria: 'Actividad', decision: 'Administración de bienes',
    unidad: 'veces', mayorEsMejor: true, fuente: U2,
    formula: 'Ventas / Total de activos',
    definicion: 'Indica la eficiencia con la que la empresa usa todos sus activos para generar ventas.',
    interpretacion: 'Mientras mayor, más ventas genera cada dólar invertido en activos.'
  },
  {
    clave: 'ciclo_conversion', nombre: 'Ciclo de conversión del efectivo', categoria: 'Capital de trabajo', decision: 'Administración de bienes',
    unidad: 'dias', mayorEsMejor: false, fuente: U4,
    formula: 'Edad promedio del inventario + Periodo promedio de cobro − Periodo promedio de pago',
    definicion: 'Días que pasan desde que la empresa paga su inventario hasta que cobra el efectivo de la venta.',
    interpretacion: 'Un ciclo más corto significa que la empresa necesita menos financiamiento para operar.'
  },
  {
    clave: 'endeudamiento', nombre: 'Índice de endeudamiento', categoria: 'Endeudamiento', decision: 'Financiamiento',
    unidad: 'porcentaje', mayorEsMejor: false, fuente: U2,
    formula: 'Total de pasivos / Total de activos',
    definicion: 'Proporción de los activos totales que financian los acreedores.',
    interpretacion: 'Mientras más alto, más dinero de terceros se usa para generar utilidades y mayor es el apalancamiento financiero y el riesgo.'
  },
  {
    clave: 'cargos_interes_fijo', nombre: 'Razón de cargos de interés fijo', categoria: 'Endeudamiento', decision: 'Financiamiento',
    unidad: 'veces', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad antes de intereses e impuestos / Intereses',
    definicion: 'Mide la capacidad de pagar los intereses contractuales. La UAII es la utilidad de operación.',
    interpretacion: 'Se sugiere al menos 3.0 y de preferencia cerca de 5.0.'
  },
  {
    clave: 'cobertura_pagos_fijos', nombre: 'Índice de cobertura de pagos fijos', categoria: 'Endeudamiento', decision: 'Financiamiento',
    unidad: 'veces', mayorEsMejor: true, fuente: U2,
    formula: '(UAII + Arrendamiento) / {Intereses + Arrendamiento + [(Principal + Div. preferentes) × 1/(1 − T)]}',
    definicion: 'Mide la capacidad de cumplir todas las obligaciones de pagos fijos: intereses, principal, arrendamientos y dividendos preferentes.',
    interpretacion: 'Mientras más alto, menor riesgo para prestamistas y dueños. Arrendamiento y principal se configuran en Parámetros.'
  },
  {
    clave: 'margen_bruto', nombre: 'Margen de utilidad bruta', categoria: 'Rentabilidad', decision: 'Inversión',
    unidad: 'porcentaje', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad bruta / Ventas',
    definicion: 'Porcentaje que queda de cada dólar de ventas después de pagar la mercadería vendida.',
    interpretacion: 'Más alto es mejor: implica un menor costo relativo de la mercadería.'
  },
  {
    clave: 'margen_operativo', nombre: 'Margen de utilidad operativa', categoria: 'Rentabilidad', decision: 'Inversión',
    unidad: 'porcentaje', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad operativa / Ventas',
    definicion: 'Utilidad "pura" ganada por cada dólar de ventas, sin considerar intereses ni impuestos.',
    interpretacion: 'Más alto es mejor: mide la eficiencia de la operación del negocio.'
  },
  {
    clave: 'margen_neto', nombre: 'Margen de utilidad neta', categoria: 'Rentabilidad', decision: 'Inversión',
    unidad: 'porcentaje', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad neta / Ventas',
    definicion: 'Porcentaje que queda de cada dólar de ventas después de todos los costos, gastos, intereses e impuestos.',
    interpretacion: 'Indica el éxito de la empresa en cuanto a las ganancias obtenidas de las ventas.'
  },
  {
    clave: 'roa', nombre: 'Rendimiento sobre los activos (ROA)', categoria: 'Rentabilidad', decision: 'Inversión',
    unidad: 'porcentaje', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad neta / Total de activos',
    definicion: 'Eficacia integral de la administración para generar utilidades con los activos disponibles.',
    interpretacion: 'Centavos que gana la empresa por cada dólar invertido en activos. Debe superar al costo de capital (condición de supervivencia).'
  },
  {
    clave: 'roe', nombre: 'Rendimiento sobre el patrimonio (ROE)', categoria: 'Rentabilidad', decision: 'Inversión',
    unidad: 'porcentaje', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad neta / Patrimonio',
    definicion: 'Rendimiento ganado sobre la inversión de los accionistas.',
    interpretacion: 'Centavos que gana la empresa por cada dólar aportado por los accionistas.'
  },
  {
    clave: 'utilidad_por_accion', nombre: 'Utilidad por acción', categoria: 'Mercado', decision: 'Inversión',
    unidad: 'dinero', mayorEsMejor: true, fuente: U2,
    formula: 'Utilidad neta / Número de acciones',
    definicion: 'Monto de utilidad que corresponde a cada acción en circulación. La empresa no cotiza en bolsa: es informativa.',
    interpretacion: 'Mientras más alta, más ganancia genera cada acción para su dueño.'
  },
  {
    clave: 'valor_libros_accion', nombre: 'Valor en libros por acción', categoria: 'Mercado', decision: 'Inversión',
    unidad: 'dinero', mayorEsMejor: true, fuente: U2,
    formula: 'Patrimonio / Número de acciones',
    definicion: 'Valor contable que respalda cada acción. Sin precio de mercado no se calculan P/G ni M/L.',
    interpretacion: 'Si la empresa cotizara, se compararía con el precio de mercado (razón mercado/libro).'
  }
];

export const TEMAS = {
  supervivencia: {
    titulo: 'Condición de supervivencia',
    formula: 'Rendimiento sobre los activos (ROA) > Costo de capital',
    texto: 'La rentabilidad de la inversión debe ser mayor que lo que cuesta financiarla. Si el ROA es menor que el costo de capital, la empresa destruye valor.',
    fuente: 'Unidad III - Planeación financiera'
  },
  tamanoComun: {
    titulo: 'Estado de tamaño común (análisis vertical)',
    formula: 'Rubro / Ventas netas × 100   ·   Cuenta de balance / Activo total × 100',
    texto: 'Cada rubro se expresa como porcentaje de una base. Permite ver si un costo o gasto crece o baja en relación con las ventas.',
    fuente: 'Unidad II - Herramientas de análisis financiero'
  },
  horizontal: {
    titulo: 'Análisis horizontal',
    formula: 'Variación = Período actual − Período anterior   ·   Variación % = Variación / Período anterior',
    texto: 'Compara la misma cuenta entre períodos para identificar tendencias (análisis de series temporales).',
    fuente: 'Unidad II - Herramientas de análisis financiero'
  },
  comparativo: {
    titulo: 'Control presupuestario',
    formula: 'Variación = Real − Presupuesto   ·   Variación % = Variación / Presupuesto',
    texto: 'Se compara lo ejecutado contra lo presupuestado y se marcan las desviaciones mayores a la tolerancia para asignar responsables y acciones correctivas.',
    fuente: 'Unidad III - Planeación financiera'
  },
  variacionUtilidadBruta: {
    titulo: 'Descomposición de la variación de la utilidad bruta',
    formula: 'Por venta no lograda = (Ventas reales − Ventas ppto) × Margen % ppto   ·   Por margen no logrado = (Margen % real − Margen % ppto) × Ventas reales',
    texto: 'Separa cuánto de la diferencia en utilidad bruta se debe a vender menos de lo previsto y cuánto a vender con menor margen.',
    fuente: 'Unidad III - Planeación financiera (método de la tesis)'
  },
  pronosticoVentas: {
    titulo: 'Pronóstico de ventas',
    formula: 'Ventas del mes = (Ventas netas año anterior / 12) × (1 + crecimiento + inflación del mes)',
    texto: 'Es el insumo principal de la planeación de corto plazo: de él salen las compras, el inventario, los gastos, el presupuesto de caja y los estados pro forma.',
    fuente: 'Unidad III - Planeación financiera (método de la tesis)'
  },
  flujoIndirecto: {
    titulo: 'Estado de flujos de efectivo (método indirecto)',
    formula: 'Utilidad + partidas sin efectivo ± variaciones de capital de trabajo = Flujo de operación',
    texto: 'Muestra de dónde viene y a dónde va el efectivo, separado en actividades de operación, inversión y financiamiento: las tres decisiones de la administración financiera.',
    fuente: 'Unidad I - Estados financieros'
  }
};
