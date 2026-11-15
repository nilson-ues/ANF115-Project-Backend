import request from 'supertest';
import { crearApp } from '../src/app';
import { pool } from '../src/db';
import { firmarToken } from '../src/middleware/auth';

// Requiere una base sembrada: DB_TESTS=1 npm test
const describeDb = process.env.DB_TESTS ? describe : describe.skip;
const app = crearApp();
const token = (rol: 'ADMIN' | 'VENTAS' | 'FINANZAS') => `Bearer ${firmarToken({ id: 1, nombre: 'Prueba', email: 'p@distrifarma.test', rol })}`;

afterAll(() => pool.end());

describeDb('Ingresos y gastos contra la base de datos', () => {
  let ingreso: number;
  let gasto: number;
  let creado: number;

  beforeAll(async () => {
    const { body } = await request(app).get('/api/categorias').set('Authorization', token('ADMIN'));
    ingreso = body.find((c: { nombre: string }) => c.nombre === 'Ventas').id;
    gasto = body.find((c: { nombre: string }) => c.nombre === 'Alquiler').id;
  });

  const nuevo = (extra = {}) => ({ fecha: '2026-11-14', tipo: 'GASTO', categoria_id: gasto, concepto: 'Prueba de alquiler', monto: '150.25', ...extra });

  test('Registra un gasto y lo deja en la bitácora', async () => {
    const res = await request(app).post('/api/movimientos').set('Authorization', token('FINANZAS')).send(nuevo());
    expect(res.status).toBe(201);
    expect(res.body.monto).toBe('150.25');
    creado = res.body.id;
    const bit = await pool.query(`SELECT 1 FROM bitacora WHERE entidad = 'movimiento' AND entidad_id = $1`, [String(creado)]);
    expect(bit.rowCount).toBe(1);
  });

  test('Rechaza montos negativos o con más de dos decimales', async () => {
    for (const monto of ['-5', '0', '10.123']) {
      const res = await request(app).post('/api/movimientos').set('Authorization', token('ADMIN')).send(nuevo({ monto }));
      expect(res.status).toBe(400);
    }
  });

  test('La categoría debe corresponder al tipo de movimiento', async () => {
    const res = await request(app).post('/api/movimientos').set('Authorization', token('ADMIN')).send(nuevo({ categoria_id: ingreso }));
    expect(res.status).toBe(422);
  });

  test('El rol VENTAS registra ingresos pero no gastos', async () => {
    expect((await request(app).post('/api/movimientos').set('Authorization', token('VENTAS')).send(nuevo())).status).toBe(403);
    const ok = await request(app).post('/api/movimientos').set('Authorization', token('VENTAS'))
      .send(nuevo({ tipo: 'INGRESO', categoria_id: ingreso, concepto: 'Venta de prueba' }));
    expect(ok.status).toBe(201);
  });

  test('Un período cerrado no admite movimientos', async () => {
    const res = await request(app).post('/api/movimientos').set('Authorization', token('ADMIN')).send(nuevo({ fecha: '2009-05-10' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PERIODO_CERRADO');
  });

  test('Anula con motivo y no permite editar lo anulado', async () => {
    const res = await request(app).patch(`/api/movimientos/${creado}/anular`).set('Authorization', token('ADMIN')).send({ motivo: 'Registro duplicado' });
    expect(res.status).toBe(200);
    const editar = await request(app).put(`/api/movimientos/${creado}`).set('Authorization', token('ADMIN')).send(nuevo());
    expect(editar.status).toBe(409);
  });

  test('Filtra por fecha y categoría', async () => {
    const res = await request(app).get(`/api/movimientos?desde=2009-01-01&hasta=2009-12-31&categoria_id=${ingreso}`).set('Authorization', token('VENTAS'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.indicadores.ingresos).toBe('866126.16');
  });

  test('Panel: ingresos, gastos, resultado y porcentaje de gastos de 2009', async () => {
    const res = await request(app).get('/api/movimientos/resumen?desde=2009-01-01&hasta=2009-12-31').set('Authorization', token('ADMIN'));
    expect(res.body.indicadores.resultado).toBe('32248.61');
    expect(res.body.porMes).toHaveLength(12);
  });

  test('Reporte anual concilia con la utilidad antes de impuesto del estado de resultados', async () => {
    const res = await request(app).get('/api/movimientos/reporte?desde=2008-01-01&hasta=2009-12-31&agrupar=anio').set('Authorization', token('ADMIN'));
    expect(res.body.filas).toHaveLength(2);
    for (const c of res.body.conciliacion) expect(Math.abs(Number(c.diferencia))).toBeLessThanOrEqual(0.05);
  });

  test('Reporte diario del período en curso', async () => {
    const res = await request(app).get('/api/movimientos/reporte?desde=2026-11-01&hasta=2026-11-30&agrupar=dia').set('Authorization', token('ADMIN'));
    expect(res.body.filas.length).toBeGreaterThan(5);
  });

  test('Unidad III y IV: proyectos, caja y ciclo de efectivo', async () => {
    const proyectos = await request(app).get('/api/planeacion/proyectos').set('Authorization', token('FINANZAS'));
    expect(proyectos.body.proyectos).toHaveLength(3);
    const base = await request(app).get('/api/planeacion/caja/base/2009').set('Authorization', token('FINANZAS'));
    expect(base.body.ventas).toHaveLength(12);
    const efectivo = await request(app).get('/api/circulante/efectivo?anio=2009').set('Authorization', token('FINANZAS'));
    expect(efectivo.status).toBe(200);
    expect(efectivo.body.cicloConversion).toBeCloseTo(efectivo.body.edadInventario + efectivo.body.periodoCobro - efectivo.body.periodoPago, 1);
    const caja = await request(app).post('/api/planeacion/caja').set('Authorization', token('FINANZAS')).send({
      ventasBase: base.body.ventas, saldoInicial: base.body.saldoInicial, costoPct: base.body.costoPct, gastosVentaPct: base.body.gastosVentaPct,
      gastosAdministracionPct: base.body.gastosAdministracionPct, gastosFinancierosMes: base.body.gastosFinancierosMes, impuestosMes: base.body.impuestosMes
    });
    expect(caja.status).toBe(200);
    expect(caja.body.metodos).toHaveLength(2);
    const credito = await request(app).post('/api/circulante/credito').set('Authorization', token('FINANZAS')).send({
      ventasCredito: 60000000, periodoCobroActual: 45, periodoCobroNuevo: 75, incrementoVentas: 0.15, costoVariable: 0.8, rendimientoRequerido: 0.2
    });
    expect(credito.body.conviene).toBe(true);
    expect((await request(app).get('/api/planeacion/proyectos').set('Authorization', token('VENTAS'))).status).toBe(403);
  });
});
