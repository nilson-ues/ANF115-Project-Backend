import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../errores';

export type Rol = 'ADMIN' | 'VENTAS' | 'FINANZAS';

export interface UsuarioToken {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

export function firmarToken(usuario: UsuarioToken) {
  return jwt.sign(usuario, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization ?? '';
  const [tipo, token] = encabezado.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Debe iniciar sesión'));
  }
  try {
    const datos = jwt.verify(token, config.JWT_SECRET) as UsuarioToken;
    req.usuario = { id: datos.id, nombre: datos.nombre, email: datos.email, rol: datos.rol };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Sesión inválida o expirada'));
  }
}

export function permitir(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return next(new AppError(403, 'FORBIDDEN', 'No tiene permiso para esta operación'));
    }
    next();
  };
}

export const TODOS: Rol[] = ['ADMIN', 'VENTAS', 'FINANZAS'];
