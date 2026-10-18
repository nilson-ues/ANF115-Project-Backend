import request from 'supertest';
import { crearApp } from '../src/app';
import { pool } from '../src/db';
import { firmarToken } from '../src/middleware/auth';

const app = crearApp();
const token = (rol: 'ADMIN' | 'VENTAS' | 'FINANZAS') => `Bearer ${firmarToken({ id: 1, nombre: 'Prueba', email: 'p@distrifarma.test', rol })}`;

afterAll(() => pool.end());

describe('Seguridad de la API', () => {
  test('Salud responde sin autenticación', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.status).toBe(200);
  });

  test('Rechaza peticiones sin token con el formato de error uniforme', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('Rechaza un token inválido', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  test('Valida el cuerpo del login con zod', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-es-correo', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('El rol VENTAS no puede ver estados financieros ni usuarios', async () => {
    expect((await request(app).get('/api/estados/resultados?anio=2009').set('Authorization', token('VENTAS'))).status).toBe(403);
    expect((await request(app).get('/api/usuarios').set('Authorization', token('VENTAS'))).status).toBe(403);
  });

  test('El rol FINANZAS no puede administrar usuarios', async () => {
    const res = await request(app).post('/api/usuarios').set('Authorization', token('FINANZAS')).send({});
    expect(res.status).toBe(403);
  });

  test('Valida parámetros de consulta', async () => {
    const res = await request(app).get('/api/estados/resultados?anio=abc').set('Authorization', token('FINANZAS'));
    expect(res.status).toBe(400);
  });

  test('Ruta inexistente devuelve 404 uniforme', async () => {
    const res = await request(app).get('/api/no-existe').set('Authorization', token('ADMIN'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
