# DistriFarma ERP · API

Backend del mini-ERP financiero de ANF115 (Administración Financiera, UES). Node + Express + TypeScript, PostgreSQL con SQL parametrizado y `decimal.js` para todo cálculo monetario.

## Requisitos

- Node 24
- PostgreSQL 16 accesible en la red (servidor Ubuntu `192.168.0.17`)

## Puesta en marcha

```bash
cp .env.example .env      # completar DB_PASSWORD y JWT_SECRET
npm install
npm run db:reset          # crea el esquema y carga los datos de la tesis
npm run dev               # http://localhost:3000/api
```

| Script | Uso |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm run migrate` | Aplica migraciones pendientes de `db/migrations` |
| `npm run seed` | Borra y vuelve a cargar los datos iniciales |
| `npm run db:reset` | Recrea el esquema completo y carga datos |
| `npm test` | Pruebas Jest contra los valores de verificación de la tesis |
| `npm run build && npm start` | Compilado de producción |

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| ADMIN | admin@distrifarma.test | Admin2026! |
| FINANZAS | finanzas@distrifarma.test | Finanzas2026! |
| VENTAS | ventas@distrifarma.test | Ventas2026! |

## Endpoints

| Ruta | Roles | Descripción |
|---|---|---|
| `POST /api/auth/login` | público | JWT (límite 10 intentos / 15 min) |
| `GET /api/dashboard?anio=` | todos | KPIs, gráficos, razones por decisión, condición de supervivencia |
| `GET /api/estados/resultados·balance·flujo·patrimonio?anio=&escenario=&mes=` | ADMIN, FINANZAS | Estados financieros mensuales |
| `GET /api/analisis/razones·horizontal·comparativo?anio=&mes=` | ADMIN, FINANZAS | Razones con semáforo, análisis horizontal, real vs. presupuesto |
| `GET /api/presupuesto/proyeccion/:anio` · `PUT /supuestos/:anio` | ADMIN, FINANZAS | Estado de resultados pro forma |
| `/api/catalogos/{lineas,proveedores,clientes,productos}` | lectura todos | CRUD |
| `/api/configuracion/{empresa,parametros,estandares,bitacora}` | según recurso | Parámetros configurables |
| `/api/usuarios` | ADMIN | Gestión de usuarios |

Errores uniformes: `{ "error": { "code": "...", "message": "..." } }`.

## Datos

`db/seeds/historico.json` contiene los saldos mensuales de la tesis (real 2008, presupuesto 2009 y real 2009). Las cuentas de resultados guardan el movimiento del mes y las de balance el saldo al cierre.

## Respaldo y restauración

Requiere `pg_dump` y `pg_restore` (cliente de PostgreSQL). Usa las variables `DB_*` del `.env`.

```bash
./scripts/respaldo.sh                        # crea respaldos/<base>_<fecha>.dump y conserva los 30 más recientes
./scripts/restaurar.sh respaldos/archivo.dump
```

En producción, Azure Database for PostgreSQL guarda además respaldos automáticos con 7 días de retención y restauración a un punto en el tiempo.
