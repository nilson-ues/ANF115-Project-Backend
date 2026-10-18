import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db';
import { AppError } from '../errores';
import { autenticar, firmarToken } from '../middleware/auth';

export const authRouter = Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Intente de nuevo en 15 minutos' } });
  }
});

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(100)
});

authRouter.post('/login', limiteLogin, async (req, res) => {
  const { email, password } = esquemaLogin.parse(req.body);
  const { rows } = await pool.query('SELECT id, nombre, email, rol, password_hash, activo FROM usuarios WHERE email = $1', [email]);
  const usuario = rows[0];
  const valido = usuario && usuario.activo && (await bcrypt.compare(password, usuario.password_hash));
  if (!valido) throw new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
  const datos = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
  res.json({ token: firmarToken(datos), usuario: datos });
});

authRouter.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});
