CREATE TABLE clasificacion_costos (
  rubro VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  comportamiento VARCHAR(10) NOT NULL CHECK (comportamiento IN ('FIJO', 'VARIABLE')),
  orden INT NOT NULL
);

INSERT INTO clasificacion_costos (rubro, nombre, comportamiento, orden) VALUES
  ('costoVentas', 'Costo de ventas', 'VARIABLE', 1),
  ('gastosVenta', 'Gastos de venta', 'VARIABLE', 2),
  ('gastosAdministracion', 'Gastos de administración', 'FIJO', 3),
  ('gastosFinancieros', 'Gastos financieros', 'FIJO', 4);
