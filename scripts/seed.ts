import bcrypt from 'bcryptjs';
import historico from '../db/seeds/historico.json';
import { CLIENTES, CUENTAS, EMPRESA, LINEAS, PARAMETROS, PRODUCTOS, PROVEEDORES, SUPUESTOS_2010, USUARIOS } from '../db/seeds/base';
import { pool, transaccion } from '../src/db';

async function sembrar() {
  await transaccion(async (c) => {
    await c.query(`TRUNCATE bitacora, saldos_periodo, periodos, supuestos_mensuales, productos, clientes, proveedores, lineas,
      razones_estandar, parametros, empresa, usuarios, cuentas RESTART IDENTITY CASCADE`);

    for (const u of USUARIOS) {
      await c.query('INSERT INTO usuarios (nombre, email, rol, password_hash) VALUES ($1, $2, $3, $4)',
        [u.nombre, u.email, u.rol, await bcrypt.hash(u.password, 10)]);
    }

    const e = EMPRESA;
    await c.query(
      `INSERT INTO empresa (razon_social, nombre_comercial, giro, direccion, fecha_constitucion, tipo_empresa, tamano,
        capital_social, capital_minimo, capital_variable, numero_acciones, valor_nominal_accion, mision, vision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [e.razon_social, e.nombre_comercial, e.giro, e.direccion, e.fecha_constitucion, e.tipo_empresa, e.tamano,
       e.capital_social, e.capital_minimo, e.capital_variable, e.numero_acciones, e.valor_nominal_accion, e.mision, e.vision]
    );

    for (const p of PARAMETROS) {
      await c.query('INSERT INTO parametros (clave, nombre, grupo, unidad, valor, descripcion) VALUES ($1, $2, $3, $4, $5, $6)',
        [p.clave, p.nombre, p.grupo, p.unidad, p.valor, p.descripcion]);
    }

    for (const cta of CUENTAS) {
      await c.query(
        'INSERT INTO cuentas (codigo, nombre, tipo, naturaleza, padre_codigo, nivel, acepta_movimiento) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [cta.codigo, cta.nombre, cta.tipo, cta.naturaleza, cta.padre, cta.nivel, cta.acepta]
      );
    }

    const lineas = new Map<string, number>();
    for (const l of LINEAS) {
      const { rows } = await c.query('INSERT INTO lineas (nombre, linea_padre_id) VALUES ($1, $2) RETURNING id',
        [l.nombre, l.padre ? lineas.get(l.padre) : null]);
      lineas.set(l.nombre, rows[0].id);
    }

    const proveedores = new Map<string, number>();
    for (const p of PROVEEDORES) {
      const { rows } = await c.query('INSERT INTO proveedores (nombre, origen, pais, plazo_credito_dias) VALUES ($1, $2, $3, $4) RETURNING id',
        [p.nombre, p.origen, p.pais, p.plazo_credito_dias]);
      proveedores.set(p.nombre, rows[0].id);
    }

    for (const cl of CLIENTES) {
      await c.query(
        `INSERT INTO clientes (nombre, tipo, plazo_credito_dias, limite_credito, descuento_pronto_pago, dias_pronto_pago)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [cl.nombre, cl.tipo, cl.plazo_credito_dias, cl.limite_credito, cl.descuento_pronto_pago, cl.dias_pronto_pago]
      );
    }

    for (const [codigo, nombre, linea, proveedor, unidad, precio, minimo] of PRODUCTOS) {
      await c.query(
        `INSERT INTO productos (codigo, nombre, linea_id, proveedor_id, unidad, precio_venta, existencia_minima)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [codigo, nombre, lineas.get(linea), proveedores.get(proveedor), unidad, precio, minimo]
      );
    }

    const filas = historico as { anio: number; mes: number; escenario: string; cuenta: string; monto: string }[];
    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500);
      const valores = lote.map((_, j) => `($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5})`).join(', ');
      await c.query(
        `INSERT INTO saldos_periodo (anio, mes, escenario, cuenta_codigo, monto) VALUES ${valores}`,
        lote.flatMap((f) => [f.anio, f.mes, f.escenario, f.cuenta, f.monto])
      );
    }

    await c.query(`INSERT INTO periodos (anio, mes, estado, cerrado_en)
      SELECT DISTINCT anio, mes, 'CERRADO', now() FROM saldos_periodo WHERE escenario = 'REAL'`);

    for (const [i, [inflacion, compras]] of SUPUESTOS_2010.entries()) {
      await c.query('INSERT INTO supuestos_mensuales (anio, mes, inflacion, compras_pct) VALUES (2010, $1, $2, $3)', [i + 1, inflacion, compras]);
    }
  });
  console.log('Datos iniciales cargados');
  await pool.end();
}

sembrar().catch(async (error) => {
  console.error(error.message);
  await pool.end();
  process.exit(1);
});
