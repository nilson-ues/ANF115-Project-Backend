CREATE TABLE proyectos_inversion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  descripcion TEXT,
  inversion_inicial NUMERIC(14,2) NOT NULL CHECK (inversion_inicial > 0),
  flujos NUMERIC(14,2)[] NOT NULL CHECK (cardinality(flujos) BETWEEN 1 AND 30),
  costo_capital NUMERIC(7,4) NOT NULL CHECK (costo_capital >= 0 AND costo_capital < 1),
  periodo_maximo NUMERIC(5,2),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
