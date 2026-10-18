import { Pool, PoolClient } from 'pg';
import { pool } from './db';

export async function registrarBitacora(
  usuarioId: number | undefined,
  accion: 'CREAR' | 'EDITAR' | 'ANULAR' | 'ELIMINAR',
  entidad: string,
  entidadId: string | number,
  detalle: unknown,
  cliente: Pool | PoolClient = pool
) {
  await cliente.query(
    'INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle) VALUES ($1, $2, $3, $4, $5)',
    [usuarioId ?? null, accion, entidad, String(entidadId), JSON.stringify(detalle)]
  );
}
