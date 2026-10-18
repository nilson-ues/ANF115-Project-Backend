INSERT INTO parametros (clave, nombre, grupo, unidad, valor, descripcion)
VALUES ('umbral_variacion', 'Umbral de variación (análisis horizontal)', 'Análisis', '%', 0.10,
        'Variaciones mayores a este porcentaje se resaltan en el análisis horizontal.')
ON CONFLICT (clave) DO NOTHING;
