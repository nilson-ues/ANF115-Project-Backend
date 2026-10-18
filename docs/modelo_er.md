# Modelo entidad-relación

```mermaid
erDiagram
  usuarios ||--o{ bitacora : registra
  lineas ||--o{ lineas : sublinea
  lineas ||--o{ productos : agrupa
  proveedores ||--o{ productos : suministra
  cuentas ||--o{ cuentas : padre
  cuentas ||--o{ saldos_periodo : tiene
  periodos ||--o{ saldos_periodo : "anio, mes"
  empresa { int id PK }
  parametros { text clave PK }
  razones_estandar { text clave PK }
  supuestos_mensuales { int anio PK; int mes PK }
  clientes { int id PK; text tipo; int plazo_credito_dias }
  saldos_periodo { int anio; int mes; text escenario; text cuenta_codigo; numeric monto }
```
