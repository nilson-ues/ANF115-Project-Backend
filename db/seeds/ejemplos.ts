// Movimientos de ejemplo del período en curso para mostrar los reportes diarios
export const MOVIMIENTOS_EJEMPLO = [
  { fecha: '2026-11-02', tipo: 'INGRESO', categoria: 'Ventas', concepto: 'Venta de catéteres al Hospital Rosales', monto: '4850.00', forma_pago: 'CREDITO', referencia: 'CCF-1021' },
  { fecha: '2026-11-03', tipo: 'GASTO', categoria: 'Alquiler', concepto: 'Alquiler de bodega noviembre', monto: '1200.00', forma_pago: 'TRANSFERENCIA', referencia: 'REC-0311' },
  { fecha: '2026-11-04', tipo: 'INGRESO', categoria: 'Ventas', concepto: 'Venta de contado Farmacia Moderna', monto: '1325.40', forma_pago: 'EFECTIVO', referencia: 'FAC-5540' },
  { fecha: '2026-11-05', tipo: 'GASTO', categoria: 'Servicios básicos', concepto: 'Energía eléctrica octubre', monto: '286.75', forma_pago: 'TRANSFERENCIA', referencia: 'NIC-88231' },
  { fecha: '2026-11-06', tipo: 'INGRESO', categoria: 'Servicios de anestesia y conexos', concepto: 'Servicio de anestesia Hospital de Diagnóstico', monto: '2100.00', forma_pago: 'CHEQUE', referencia: 'CCF-1022' },
  { fecha: '2026-11-09', tipo: 'GASTO', categoria: 'Transporte', concepto: 'Combustible para entregas', monto: '145.20', forma_pago: 'TARJETA', referencia: 'TK-7781' },
  { fecha: '2026-11-10', tipo: 'GASTO', categoria: 'Suministros', concepto: 'Papelería y tóner', monto: '98.60', forma_pago: 'EFECTIVO', referencia: 'FAC-3321' },
  { fecha: '2026-11-11', tipo: 'INGRESO', categoria: 'Ventas', concepto: 'Venta de stents ISSS', monto: '9875.00', forma_pago: 'CREDITO', referencia: 'CCF-1023' },
  { fecha: '2026-11-12', tipo: 'GASTO', categoria: 'Gastos de venta', concepto: 'Comisiones de vendedores', monto: '640.00', forma_pago: 'TRANSFERENCIA', referencia: 'PL-11' },
  { fecha: '2026-11-13', tipo: 'GASTO', categoria: 'Gastos de administración', concepto: 'Honorarios del auditor externo', monto: '750.00', forma_pago: 'CHEQUE', referencia: 'CH-2045' }
] as const;

// Ejemplos de la Unidad III para la evaluación de proyectos
export const PROYECTOS_EJEMPLO = [
  {
    nombre: 'Ejemplo VAN (Unidad III, video 6)',
    descripcion: 'Inversión de $1,000,000 con entradas crecientes durante cuatro años, descontadas al 3 % anual.',
    inversion_inicial: 1000000, flujos: [150000, 250000, 400000, 500000], costo_capital: 0.03, periodo_maximo: 4
  },
  {
    nombre: 'Ejemplo TIR con reinversión (Unidad III, video 7)',
    descripcion: 'Inversión de $200,000 que se renueva al tercer mes; retorno mensual de $135,000 durante 6 meses al 15 %.',
    inversion_inicial: 200000, flujos: [135000, 135000, -65000, 135000, 135000, 135000], costo_capital: 0.15, periodo_maximo: 3
  },
  {
    nombre: 'Ejemplo EVA (Unidad III, video 6)',
    descripcion: 'Costo inicial de $1,000,000 con entradas netas de $120,000 anuales; costo de capital del 10 %.',
    inversion_inicial: 1000000, flujos: Array(10).fill(120000), costo_capital: 0.1, periodo_maximo: 10
  }
];
