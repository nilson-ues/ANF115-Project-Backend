type Tipo = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO';

const c = (codigo: string, nombre: string, tipo: Tipo, padre: string | null, acepta = true) => ({
  codigo, nombre, tipo, padre, acepta,
  naturaleza: ['ACTIVO', 'COSTO', 'GASTO'].includes(tipo) ? 'DEUDORA' : 'ACREEDORA',
  nivel: padre === null ? 1 : codigo.length <= 2 ? 2 : codigo.length <= 4 ? 3 : 4
});

export const CUENTAS = [
  c('1', 'ACTIVO', 'ACTIVO', null, false),
  c('11', 'ACTIVO CORRIENTE', 'ACTIVO', '1', false),
  c('1101', 'Efectivo y equivalentes', 'ACTIVO', '11'),
  c('1102', 'Cuentas y documentos por cobrar C.P.', 'ACTIVO', '11'),
  c('1103', 'Crédito fiscal IVA', 'ACTIVO', '11'),
  c('1104', 'Cuentas por cobrar por arrendamiento financiero', 'ACTIVO', '11'),
  c('1105', 'Inventarios comerciales', 'ACTIVO', '11'),
  c('1106', 'Inventario en tránsito', 'ACTIVO', '11'),
  c('1107', 'Compañías partes relacionadas', 'ACTIVO', '11'),
  c('1108', 'Gastos anticipados', 'ACTIVO', '11'),
  c('12', 'ACTIVO NO CORRIENTE', 'ACTIVO', '1', false),
  c('1201', 'Propiedad, planta y equipo (neto)', 'ACTIVO', '12'),
  c('1202', 'Activos intangibles', 'ACTIVO', '12'),
  c('1203', 'Inversiones permanentes', 'ACTIVO', '12'),
  c('1204', 'Depósitos en garantía L.P.', 'ACTIVO', '12'),
  c('1205', 'Partes relacionadas L.P.', 'ACTIVO', '12'),
  c('2', 'PASIVO', 'PASIVO', null, false),
  c('21', 'PASIVO CORRIENTE', 'PASIVO', '2', false),
  c('2101', 'Préstamos bancarios', 'PASIVO', '21'),
  c('2102', 'Cuentas y documentos por pagar', 'PASIVO', '21'),
  c('2103', 'Remuneraciones y prestaciones por pagar', 'PASIVO', '21'),
  c('2104', 'Acreedores varios y provisiones', 'PASIVO', '21'),
  c('2105', 'Retenciones y descuentos', 'PASIVO', '21'),
  c('2106', 'Dividendos por pagar', 'PASIVO', '21'),
  c('2107', 'Impuesto por pagar', 'PASIVO', '21'),
  c('22', 'PASIVO NO CORRIENTE', 'PASIVO', '2', false),
  c('2201', 'Préstamos bancarios a largo plazo', 'PASIVO', '22'),
  c('2202', 'Provisión para garantía a clientes', 'PASIVO', '22'),
  c('2203', 'Provisión para obligaciones laborales', 'PASIVO', '22'),
  c('3', 'PATRIMONIO', 'PATRIMONIO', null, false),
  c('3101', 'Capital social', 'PATRIMONIO', '3', false),
  c('310101', 'Capital mínimo', 'PATRIMONIO', '3101'),
  c('310102', 'Capital variable', 'PATRIMONIO', '3101'),
  c('3102', 'Reserva legal', 'PATRIMONIO', '3'),
  c('3103', 'Utilidades por distribuir', 'PATRIMONIO', '3'),
  c('3104', 'Utilidad del ejercicio', 'PATRIMONIO', '3'),
  c('4', 'INGRESOS', 'INGRESO', null, false),
  c('41', 'INGRESOS DE OPERACIÓN', 'INGRESO', '4', false),
  c('4101', 'Ventas', 'INGRESO', '41'),
  c('4102', 'Rebajas y devoluciones sobre ventas', 'INGRESO', '41'),
  c('42', 'INGRESOS DE NO OPERACIÓN', 'INGRESO', '4', false),
  c('4201', 'Ingresos de no operación', 'INGRESO', '42'),
  c('5', 'COSTOS', 'COSTO', null, false),
  c('51', 'COSTO DE VENTAS', 'COSTO', '5', false),
  c('5101', 'Costo de ventas', 'COSTO', '51'),
  c('52', 'COMPRAS', 'COSTO', '5', false),
  c('5201', 'Compras', 'COSTO', '52'),
  c('5202', 'Rebajas y devoluciones sobre compras', 'COSTO', '52'),
  c('6', 'GASTOS', 'GASTO', null, false),
  c('61', 'GASTOS DE OPERACIÓN', 'GASTO', '6', false),
  c('6101', 'Gastos de administración', 'GASTO', '61'),
  c('6102', 'Gastos de venta', 'GASTO', '61'),
  c('62', 'GASTOS DE NO OPERACIÓN', 'GASTO', '6', false),
  c('6201', 'Gastos financieros', 'GASTO', '62'),
  c('6202', 'Gastos no deducibles', 'GASTO', '62'),
  c('63', 'RESERVA E IMPUESTOS', 'GASTO', '6', false),
  c('6301', 'Reserva legal del ejercicio', 'GASTO', '63'),
  c('6302', 'Impuesto sobre la renta', 'GASTO', '63')
];

export const EMPRESA = {
  razon_social: 'Distribuidora Farmacéutica, S.A. de C.V.',
  nombre_comercial: 'DistriFarma',
  giro: 'Comercialización de insumos médicos, instrumental médico quirúrgico, productos vasculares mínimamente invasivos y farmacéuticos',
  direccion: 'Colonia Escalón, 79 Avenida Norte, San Salvador, El Salvador',
  fecha_constitucion: '1997-01-09',
  tipo_empresa: 'Comercial',
  tamano: 'Mediana empresa (clasificación BMI)',
  capital_social: '381200.00',
  capital_minimo: '50000.00',
  capital_variable: '331200.00',
  numero_acciones: 3812,
  valor_nominal_accion: '100.00',
  mision: 'Distribuir insumos y productos médicos de primera calidad y alta tecnología, con profesionales capacitados, buscando la satisfacción del cliente.',
  vision: null
};

type Unidad = '%' | '$' | 'dias' | 'num';
const p = (clave: string, nombre: string, grupo: string, unidad: Unidad, valor: string | null, descripcion: string) =>
  ({ clave, nombre, grupo, unidad, valor, descripcion });

export const PARAMETROS = [
  p('iva', 'IVA', 'Impuestos', '%', '0.13', 'Impuesto al valor agregado sobre ventas gravadas; crédito fiscal en compras.'),
  p('isr', 'Impuesto sobre la renta', 'Impuestos', '%', '0.25', 'Tasa aplicada a (utilidad antes de impuesto y reserva − reserva legal), según la tesis.'),
  p('reserva_legal', 'Reserva legal', 'Impuestos', '%', '0.07', 'Porcentaje de la utilidad antes de impuesto y reserva.'),
  p('reserva_legal_limite', 'Límite de reserva legal', 'Impuestos', '%', '0.20', 'La reserva se acumula hasta la quinta parte del capital social.'),
  p('tolerancia_presupuesto', 'Tolerancia de desviación', 'Análisis', '%', '0.05', 'Desviaciones mayores se marcan en el control presupuestario.'),
  p('umbral_variacion', 'Umbral de variación (análisis horizontal)', 'Análisis', '%', '0.10', 'Variaciones mayores a este porcentaje se resaltan en el análisis horizontal.'),
  p('plazo_credito_clientes', 'Plazo de crédito a clientes', 'Análisis', 'dias', '30', 'Referencia para interpretar el periodo promedio de cobro.'),
  p('costo_capital', 'Costo de capital', 'Análisis', '%', null, 'Tasa mínima que debe superar el ROA (condición de supervivencia). Pendiente de definir.'),
  p('arrendamiento_anual', 'Pagos de arrendamiento anuales', 'Análisis', '$', '0', 'Para el índice de cobertura de pagos fijos.'),
  p('pagos_principal_anual', 'Pagos de principal anuales', 'Análisis', '$', '0', 'Para el índice de cobertura de pagos fijos.'),
  p('crecimiento_ventas', 'Crecimiento de ventas', 'Presupuesto', '%', '0.05', 'Sobre las ventas netas del año anterior.'),
  p('inflacion_anual', 'Inflación anual proyectada', 'Presupuesto', '%', '0.0067', 'Referencia anual (Global Insight); la proyección usa la tasa de cada mes.'),
  p('rebajas_ventas_pct', 'Rebajas y devoluciones sobre ventas', 'Presupuesto', '%', '0', 'Porcentaje de las ventas totales.'),
  p('costo_ventas_pct', 'Costo de ventas', 'Presupuesto', '%', '0.45', 'Porcentaje de las ventas netas.'),
  p('gastos_venta_pct', 'Gastos de venta', 'Presupuesto', '%', '0.25', 'Porcentaje de las ventas netas.'),
  p('gastos_administracion_pct', 'Gastos de administración', 'Presupuesto', '%', '0.12', 'Porcentaje de las ventas netas.'),
  p('gastos_financieros_mes', 'Gastos financieros mensuales', 'Presupuesto', '$', '800', 'Monto fijo mensual.'),
  p('ventas_contado_pct', 'Ventas al contado', 'Presupuesto', '%', '0.60', 'El resto se vende al crédito.'),
  p('pago_proveedores_mes', 'Pago mensual a proveedores', 'Presupuesto', '$', '25000', 'Monto fijo mensual.'),
  p('depreciacion_mes', 'Depreciación mensual', 'Presupuesto', '$', '600', 'Monto fijo mensual.')
];

export const SUPUESTOS_2010 = [
  [-0.0034, 0.15], [-0.0038, 0.15], [-0.0055, 0.15], [-0.002, 0.15], [-0.0009, 0.15], [0.0043, 0.15],
  [0.0124, 0.15], [0.0145, 0.3], [0.0174, 0.3], [0.0165, 0.3], [0.0158, 0.3], [0.0152, 0.4]
];

export const USUARIOS = [
  { nombre: 'Administrador del sistema', email: 'admin@distrifarma.test', rol: 'ADMIN', password: 'Admin2026!' },
  { nombre: 'Ejecutivo de ventas', email: 'ventas@distrifarma.test', rol: 'VENTAS', password: 'Ventas2026!' },
  { nombre: 'Analista financiero', email: 'finanzas@distrifarma.test', rol: 'FINANZAS', password: 'Finanzas2026!' }
];

export const LINEAS: { nombre: string; padre?: string }[] = [
  { nombre: 'BIOTECH' }, { nombre: 'MEDCOMP' }, { nombre: 'SURGIWEAR' }, { nombre: 'LINDSAY ENZIMATICO' },
  { nombre: 'VNUS' }, { nombre: 'VNUS GENERADOR' }, { nombre: 'ANPRO Esterilizadores' }, { nombre: 'POFOL' },
  { nombre: 'TELEFLEX' }, { nombre: 'BOSTON SCIENTIFIC' },
  { nombre: 'Cardiología', padre: 'BOSTON SCIENTIFIC' }, { nombre: 'Endoscopía', padre: 'BOSTON SCIENTIFIC' },
  { nombre: 'Urología', padre: 'BOSTON SCIENTIFIC' }, { nombre: 'Neurología', padre: 'BOSTON SCIENTIFIC' },
  { nombre: 'Vascular Periférico', padre: 'BOSTON SCIENTIFIC' }
];

export const PROVEEDORES = [
  { nombre: 'Droguería Santa Lucía', origen: 'LOCAL', pais: 'El Salvador', plazo_credito_dias: 30 },
  { nombre: 'Droguería Americana', origen: 'LOCAL', pais: 'El Salvador', plazo_credito_dias: 30 },
  { nombre: 'Alcon Centroamericana', origen: 'LOCAL', pais: 'El Salvador', plazo_credito_dias: 30 },
  { nombre: 'Boston Scientific', origen: 'EXTERIOR', pais: 'Estados Unidos', plazo_credito_dias: 60 },
  { nombre: 'Medical Components (MEDCOMP)', origen: 'EXTERIOR', pais: 'Estados Unidos', plazo_credito_dias: 60 }
];

export const CLIENTES = [
  { nombre: 'Instituto Salvadoreño del Seguro Social (ISSS)', tipo: 'PUBLICO', plazo_credito_dias: 60, limite_credito: '250000.00', descuento_pronto_pago: '0', dias_pronto_pago: 0 },
  { nombre: 'Hospital Nacional Santa Rosa', tipo: 'PUBLICO', plazo_credito_dias: 60, limite_credito: '60000.00', descuento_pronto_pago: '0', dias_pronto_pago: 0 },
  { nombre: 'Hospital Nacional de la Mujer', tipo: 'PUBLICO', plazo_credito_dias: 60, limite_credito: '60000.00', descuento_pronto_pago: '0', dias_pronto_pago: 0 },
  { nombre: 'Hospital Nacional Rosales', tipo: 'PUBLICO', plazo_credito_dias: 60, limite_credito: '120000.00', descuento_pronto_pago: '0', dias_pronto_pago: 0 },
  { nombre: 'Hospital de Diagnóstico', tipo: 'PRIVADO', plazo_credito_dias: 30, limite_credito: '80000.00', descuento_pronto_pago: '0.02', dias_pronto_pago: 10 },
  { nombre: 'Clínica Médica Escalón', tipo: 'PRIVADO', plazo_credito_dias: 30, limite_credito: '15000.00', descuento_pronto_pago: '0.02', dias_pronto_pago: 10 },
  { nombre: 'Farmacia Moderna', tipo: 'PRIVADO', plazo_credito_dias: 30, limite_credito: '20000.00', descuento_pronto_pago: '0.02', dias_pronto_pago: 10 }
];

const SL = 'Droguería Santa Lucía';
const DA = 'Droguería Americana';
const BS = 'Boston Scientific';
const MC = 'Medical Components (MEDCOMP)';

export const PRODUCTOS: [string, string, string, string, string, string, number][] = [
  ['BIO-001', 'Apósito hidrocoloide 10 x 10 cm', 'BIOTECH', SL, 'Caja', '45.00', 20],
  ['BIO-002', 'Gel conductor 250 ml', 'BIOTECH', SL, 'Frasco', '6.50', 50],
  ['BIO-003', 'Jeringa 10 ml con aguja (caja 100)', 'BIOTECH', SL, 'Caja', '18.00', 40],
  ['MED-001', 'Catéter de hemodiálisis doble lumen 12 Fr', 'MEDCOMP', MC, 'Unidad', '85.00', 25],
  ['MED-002', 'Catéter venoso central triple lumen', 'MEDCOMP', MC, 'Unidad', '65.00', 30],
  ['MED-003', 'Puerto implantable de titanio', 'MEDCOMP', MC, 'Unidad', '320.00', 5],
  ['SUR-001', 'Bata quirúrgica estéril talla L (paquete 10)', 'SURGIWEAR', DA, 'Paquete', '38.00', 30],
  ['SUR-002', 'Campo quirúrgico desechable 90 x 90 cm', 'SURGIWEAR', DA, 'Paquete', '22.00', 30],
  ['SUR-003', 'Gorro quirúrgico desechable (caja 100)', 'SURGIWEAR', DA, 'Caja', '12.50', 40],
  ['LIN-001', 'Detergente enzimático 1 galón', 'LINDSAY ENZIMATICO', DA, 'Galón', '42.00', 15],
  ['LIN-002', 'Detergente enzimático 5 galones', 'LINDSAY ENZIMATICO', DA, 'Cubeta', '185.00', 5],
  ['VNU-001', 'Catéter de radiofrecuencia para ablación venosa', 'VNUS', SL, 'Unidad', '780.00', 4],
  ['VNU-002', 'Kit introductor 7 Fr', 'VNUS', SL, 'Kit', '95.00', 8],
  ['VNG-001', 'Generador de radiofrecuencia', 'VNUS GENERADOR', SL, 'Unidad', '18500.00', 0],
  ['VNG-002', 'Cable de conexión para generador', 'VNUS GENERADOR', SL, 'Unidad', '350.00', 2],
  ['ANP-001', 'Esterilizador de óxido de etileno 135 L', 'ANPRO Esterilizadores', DA, 'Unidad', '24000.00', 0],
  ['ANP-002', 'Indicador biológico (caja 50)', 'ANPRO Esterilizadores', DA, 'Caja', '160.00', 6],
  ['ANP-003', 'Cartucho de gas EO (caja 12)', 'ANPRO Esterilizadores', DA, 'Caja', '410.00', 4],
  ['POF-001', 'Propofol 1% ampolla 20 ml (caja 5)', 'POFOL', SL, 'Caja', '32.00', 30],
  ['POF-002', 'Propofol 1% vial 50 ml', 'POFOL', SL, 'Vial', '18.00', 40],
  ['TEL-001', 'Tubo endotraqueal con balón 7.5', 'TELEFLEX', DA, 'Unidad', '4.80', 100],
  ['TEL-002', 'Mascarilla laríngea #4', 'TELEFLEX', DA, 'Unidad', '28.00', 30],
  ['TEL-003', 'Kit de catéter epidural', 'TELEFLEX', DA, 'Kit', '36.00', 25],
  ['BSC-CAR-001', 'Stent coronario liberador de fármaco', 'Cardiología', BS, 'Unidad', '1150.00', 10],
  ['BSC-CAR-002', 'Catéter balón de angioplastia coronaria', 'Cardiología', BS, 'Unidad', '420.00', 10],
  ['BSC-CAR-003', 'Guía coronaria 0.014 x 190 cm', 'Cardiología', BS, 'Unidad', '135.00', 15],
  ['BSC-END-001', 'Pinza de biopsia desechable', 'Endoscopía', BS, 'Unidad', '85.00', 20],
  ['BSC-END-002', 'Asa de polipectomía', 'Endoscopía', BS, 'Unidad', '72.00', 15],
  ['BSC-END-003', 'Stent biliar plástico', 'Endoscopía', BS, 'Unidad', '210.00', 8],
  ['BSC-URO-001', 'Catéter ureteral doble J', 'Urología', BS, 'Unidad', '145.00', 15],
  ['BSC-URO-002', 'Canastilla de extracción de cálculos', 'Urología', BS, 'Unidad', '260.00', 8],
  ['BSC-URO-003', 'Guía hidrofílica 0.035', 'Urología', BS, 'Unidad', '95.00', 15],
  ['BSC-NEU-001', 'Microcatéter neurovascular', 'Neurología', BS, 'Unidad', '980.00', 4],
  ['BSC-NEU-002', 'Coil de embolización', 'Neurología', BS, 'Unidad', '690.00', 6],
  ['BSC-VAS-001', 'Stent periférico autoexpandible', 'Vascular Periférico', BS, 'Unidad', '1250.00', 6],
  ['BSC-VAS-002', 'Catéter balón periférico', 'Vascular Periférico', BS, 'Unidad', '380.00', 8],
  ['BSC-VAS-003', 'Filtro de vena cava', 'Vascular Periférico', BS, 'Unidad', '1400.00', 3]
];
