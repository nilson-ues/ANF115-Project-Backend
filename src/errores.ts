import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const noEncontrado = (mensaje = 'Recurso no encontrado') => new AppError(404, 'NOT_FOUND', mensaje);

export function rutaNoEncontrada(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Ruta no encontrada'));
}

export function manejadorErrores(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof ZodError) {
    const detalle = error.issues.map((i) => `${i.path.join('.') || 'valor'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: detalle } });
  }
  const pgError = error as { code?: string };
  if (pgError.code === '23505') {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Ya existe un registro con esos datos' } });
  }
  if (pgError.code === '23503') {
    return res.status(409).json({ error: { code: 'IN_USE', message: 'El registro está relacionado con otros datos' } });
  }
  console.error(error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
}
