CREATE TABLE categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  tipo VARCHAR(7) NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
  cuenta_codigo VARCHAR(10) REFERENCES cuentas(codigo),
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (nombre, tipo),
  UNIQUE (id, tipo)
);

CREATE TABLE movimientos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo VARCHAR(7) NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
  categoria_id INTEGER NOT NULL,
  concepto VARCHAR(200) NOT NULL,
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  forma_pago VARCHAR(15) NOT NULL DEFAULT 'EFECTIVO' CHECK (forma_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'CREDITO')),
  referencia VARCHAR(60),
  usuario_id INTEGER REFERENCES usuarios(id),
  anulado BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion VARCHAR(300),
  anulado_por INTEGER REFERENCES usuarios(id),
  anulado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- la categoría debe ser del mismo tipo que el movimiento
  FOREIGN KEY (categoria_id, tipo) REFERENCES categorias(id, tipo),
  CHECK (NOT anulado OR motivo_anulacion IS NOT NULL)
);

CREATE INDEX ix_movimientos_fecha ON movimientos(fecha);
CREATE INDEX ix_movimientos_categoria ON movimientos(categoria_id);
