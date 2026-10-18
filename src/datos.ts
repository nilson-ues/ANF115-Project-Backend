import { z } from 'zod';
import { pool } from './db';
import { AppError } from './errores';
import { D, Decimal } from './finanzas/dinero';
import { CuentaCatalogo } from './finanzas/estados';
import { Libro } from './finanzas/libro';

export type Escenario = 'REAL' | 'PRESUPUESTO';

export const consultaPeriodo = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  escenario: z.enum(['REAL', 'PRESUPUESTO']).default('REAL'),
  mes: z.coerce.number().int().min(1).max(12).optional()
});

export async function cargarLibro(escenario: Escenario, anios: number[]): Promise<Libro> {
  const { rows } = await pool.query(
    `SELECT anio, mes, cuenta_codigo AS cuenta, monto FROM saldos_periodo
     WHERE escenario = $1 AND anio = ANY($2::smallint[])`,
    [escenario, anios]
  );
  if (escenario === 'PRESUPUESTO') {
    const previos = await pool.query(
      `SELECT anio, mes, cuenta_codigo AS cuenta, monto FROM saldos_periodo
       WHERE escenario = 'REAL' AND anio = ANY($1::smallint[])`,
      [anios.map((a) => a - 1)]
    );
    const presentes = new Set(rows.map((r) => `${r.anio}`));
    rows.push(...previos.rows.filter((r) => !presentes.has(`${r.anio}`)));
  }
  return new Libro(rows);
}

export async function cargarCatalogo(): Promise<CuentaCatalogo[]> {
  const { rows } = await pool.query('SELECT codigo, nombre, tipo, nivel, padre_codigo, acepta_movimiento FROM cuentas ORDER BY codigo');
  return rows;
}

export async function cargarParametros(): Promise<Record<string, Decimal | null>> {
  const { rows } = await pool.query('SELECT clave, valor FROM parametros');
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor === null ? null : D(r.valor)]));
}

export function requerido(parametros: Record<string, Decimal | null>, clave: string): Decimal {
  const valor = parametros[clave];
  if (valor === null || valor === undefined) {
    throw new AppError(422, 'PARAMETRO_FALTANTE', `Configure el parámetro "${clave}" antes de continuar`);
  }
  return valor;
}

export async function cargarEmpresa() {
  const { rows } = await pool.query('SELECT * FROM empresa WHERE id = 1');
  if (!rows[0]) throw new AppError(500, 'SIN_EMPRESA', 'No se han cargado los datos de la empresa');
  return rows[0];
}

export function mesesDisponibles(libro: Libro, anio: number, hasta?: number) {
  const meses = libro.meses(anio).filter((m) => !hasta || m <= hasta);
  if (meses.length === 0) throw new AppError(404, 'SIN_DATOS', `No hay saldos registrados para ${anio}`);
  return meses;
}
