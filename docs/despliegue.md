# Despliegue en Azure (rama `deploy`)

Cada push a la rama `deploy` corre las pruebas, compila y publica la API en Azure App Service con `.github/workflows/deploy.yml`.

Recursos usados (grupo `igf115-project`, West US 3):

- App Service Plan B1 Linux existente (la API es una Web App más dentro del plan).
- PostgreSQL Flexible Server `igf115-db` (se crea una base y un usuario propios).

## 1. Base de datos

Desde la Mac, con la IP agregada en *Redes* del servidor:

```bash
psql "host=igf115-db.postgres.database.azure.com port=5432 dbname=postgres user=igf115 sslmode=require"
```

```sql
CREATE ROLE distrifarma LOGIN PASSWORD '<contraseña segura>';
GRANT distrifarma TO igf115;
CREATE DATABASE distrifarma OWNER distrifarma;
```

En *Redes* activar "Permitir el acceso público desde cualquier servicio de Azure" para que la Web App se conecte.

Cargar esquema y datos una vez, con un `.env` apuntando a Azure (`DB_HOST=igf115-db.postgres.database.azure.com`, `DB_SSL=true`):

```bash
npm run db:reset
```

## 2. Web App

```bash
az webapp create -g igf115-project -p <nombre-del-plan> -n <nombre-api> --runtime "NODE:22-lts"
az webapp config set -g igf115-project -n <nombre-api> --startup-file "node dist/src/server.js" --always-on true
az webapp config appsettings set -g igf115-project -n <nombre-api> --settings \
  DB_HOST=igf115-db.postgres.database.azure.com DB_PORT=5432 DB_NAME=distrifarma DB_USER=distrifarma \
  DB_PASSWORD='<contraseña>' DB_SSL=true TRUST_PROXY=true \
  JWT_SECRET='<64 caracteres aleatorios>' JWT_EXPIRES_IN=8h \
  CORS_ORIGIN=https://<frontend>.azurestaticapps.net \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

El paquete ya incluye `node_modules`, por eso no se compila en Azure y el arranque es directo con `node` (sin `npm start`).

## 3. GitHub

Habilitar las credenciales de publicación básicas de la Web App (*Configuración → General → SCM Basic Auth*) y descargar el perfil:

```bash
az webapp deployment list-publishing-profiles -g igf115-project -n <nombre-api> --xml
```

En el repositorio (*Settings → Secrets and variables → Actions*):

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `AZURE_WEBAPP_PUBLISH_PROFILE` | XML del perfil de publicación |
| Variable | `AZURE_WEBAPP_NAME` | `<nombre-api>` |

Sin estos valores el workflow corre las pruebas y omite el despliegue con un aviso.

## 4. Migraciones posteriores

Desde la Mac con el `.env` de Azure (`npm run migrate`) o por SSH en la Web App:

```bash
node dist/scripts/migrate.js
```

Comprobar: `https://<nombre-api>.azurewebsites.net/api/salud` debe responder `{"estado":"ok"}`.
