CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  rol VARCHAR(10) NOT NULL CHECK (rol IN ('ADMIN', 'VENTAS', 'FINANZAS')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE empresa (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  razon_social VARCHAR(200) NOT NULL,
  nombre_comercial VARCHAR(120) NOT NULL,
  giro TEXT NOT NULL,
  direccion TEXT NOT NULL,
  fecha_constitucion DATE NOT NULL,
  tipo_empresa VARCHAR(40) NOT NULL,
  tamano VARCHAR(40) NOT NULL,
  capital_social NUMERIC(14,2) NOT NULL,
  capital_minimo NUMERIC(14,2) NOT NULL,
  capital_variable NUMERIC(14,2) NOT NULL,
  numero_acciones INTEGER NOT NULL CHECK (numero_acciones > 0),
  valor_nominal_accion NUMERIC(14,2) NOT NULL,
  mision TEXT,
  vision TEXT
);

CREATE TABLE parametros (
  clave VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  grupo VARCHAR(40) NOT NULL,
  unidad VARCHAR(10) NOT NULL CHECK (unidad IN ('%', '$', 'dias', 'num')),
  valor NUMERIC(14,4),
  descripcion TEXT
);

CREATE TABLE razones_estandar (
  clave VARCHAR(40) PRIMARY KEY,
  valor NUMERIC(14,4),
  fuente VARCHAR(200)
);

CREATE TABLE bitacora (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion VARCHAR(20) NOT NULL,
  entidad VARCHAR(40) NOT NULL,
  entidad_id VARCHAR(40),
  detalle JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lineas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  linea_padre_id INTEGER REFERENCES lineas(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE proveedores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL UNIQUE,
  origen VARCHAR(10) NOT NULL CHECK (origen IN ('LOCAL', 'EXTERIOR')),
  pais VARCHAR(60) NOT NULL,
  nit VARCHAR(20),
  telefono VARCHAR(30),
  email VARCHAR(160),
  plazo_credito_dias INTEGER NOT NULL DEFAULT 30 CHECK (plazo_credito_dias >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL UNIQUE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('PUBLICO', 'PRIVADO')),
  nit VARCHAR(20),
  telefono VARCHAR(30),
  email VARCHAR(160),
  direccion TEXT,
  plazo_credito_dias INTEGER NOT NULL DEFAULT 30 CHECK (plazo_credito_dias >= 0),
  limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (limite_credito >= 0),
  descuento_pronto_pago NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (descuento_pronto_pago >= 0 AND descuento_pronto_pago < 1),
  dias_pronto_pago INTEGER NOT NULL DEFAULT 0 CHECK (dias_pronto_pago >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  linea_id INTEGER NOT NULL REFERENCES lineas(id),
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  unidad VARCHAR(20) NOT NULL,
  precio_venta NUMERIC(14,2) NOT NULL CHECK (precio_venta >= 0),
  costo_promedio NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (costo_promedio >= 0),
  existencia NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (existencia >= 0),
  existencia_minima NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (existencia_minima >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cuentas (
  codigo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO')),
  naturaleza VARCHAR(10) NOT NULL CHECK (naturaleza IN ('DEUDORA', 'ACREEDORA')),
  padre_codigo VARCHAR(10) REFERENCES cuentas(codigo),
  nivel SMALLINT NOT NULL,
  acepta_movimiento BOOLEAN NOT NULL
);

CREATE TABLE periodos (
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  estado VARCHAR(10) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  cerrado_en TIMESTAMPTZ,
  PRIMARY KEY (anio, mes)
);

CREATE TABLE saldos_periodo (
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  escenario VARCHAR(12) NOT NULL CHECK (escenario IN ('REAL', 'PRESUPUESTO')),
  cuenta_codigo VARCHAR(10) NOT NULL REFERENCES cuentas(codigo),
  monto NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (anio, mes, escenario, cuenta_codigo)
);

CREATE TABLE supuestos_mensuales (
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  inflacion NUMERIC(7,4) NOT NULL,
  compras_pct NUMERIC(7,4) NOT NULL CHECK (compras_pct >= 0),
  PRIMARY KEY (anio, mes)
);

CREATE INDEX ix_productos_linea ON productos(linea_id);
CREATE INDEX ix_bitacora_entidad ON bitacora(entidad, entidad_id);
