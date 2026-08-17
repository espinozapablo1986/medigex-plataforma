# Despliegue de MEDIGEX

## El servidor

| | |
|---|---|
| **Proveedor** | Netcup |
| **IP** | `159.195.7.134` |
| **Sistema** | Debian 12 (bookworm) |
| **Recursos** | 4 vCPU · 7,8 GB RAM · 251 GB disco |
| **Docker** | 28.4.0 con Compose v2.39.2 |
| **Dominio** | `medic.asdf123.cl` |

> La IP `159.195.4.1` que aparecía en las notas iniciales **no** corresponde a
> este servidor. Todos los registros DNS de `asdf123.cl` en Cloudflare apuntan a
> `159.195.7.134`, y es ahí donde está instalado MEDIGEX.

### Qué más corre en el VPS

Estos servicios ya existían y **no se tocaron**:

| Contenedor | Servicio | Acceso |
|---|---|---|
| `nginx-app-1` | Nginx Proxy Manager | puertos 80, 443 y 81 (admin) |
| `uptime-kuma` | Monitoreo | `kuma.asdf123.cl` |
| `glpi` + `glpi-mariadb` | GLPI | `glpi.asdf123.cl`, puerto 8400 |
| `portainer` | Portainer CE | puerto 9443 |

MEDIGEX se suma como un stack independiente y se conecta a la red
`nginx_default` para que el proxy pueda alcanzarlo. No publica puertos al host.

---

## Estructura en el servidor

```
/opt/stacks/medigex/          ← repositorio clonado (propietario: deploy)
├── .env                      ← claves de producción, permisos 600, fuera de git
├── docker-compose.yml
└── respaldos/                ← respaldos automáticos de la base de datos
```

### Contenedores del stack

| Contenedor | Rol |
|---|---|
| `medigex-app` | Aplicación Next.js, puerto interno 3000 |
| `medigex-db` | PostgreSQL 16 (volumen `medigex-db`) |
| `medigex-backup` | Respaldo diario con rotación a 14 días |
| `migrator` | Efímero: migraciones y semilla (perfil `tools`) |

Los adjuntos de pacientes viven en el volumen `medigex-uploads`, montado en
`/app/storage/uploads`.

---

## Puesta en marcha desde cero

```bash
ssh deploy@159.195.7.134
sudo mkdir -p /opt/stacks && cd /opt/stacks
git clone https://github.com/espinozapablo1986/medigex-plataforma.git medigex
cd medigex
```

Crear el archivo `.env` con claves generadas al azar:

```bash
cat > .env <<EOF
POSTGRES_USER=medigex
POSTGRES_DB=medigex
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
SESSION_MAX_AGE_HOURS=12
MAX_UPLOAD_MB=20
APP_URL=https://medic.asdf123.cl
EOF
chmod 600 .env
```

Levantar el stack, migrar y sembrar:

```bash
docker compose up -d --build
docker compose --profile tools run --rm migrator
```

La semilla crea el usuario `admin@medigex.cl` con la contraseña
`Medigex2026!` (o la que se indique en `SEED_ADMIN_PASSWORD`).
**Cámbiala en el primer ingreso.**

Para instalar sin datos de demostración:

```bash
SEED_DEMO=0 docker compose --profile tools run --rm migrator
```

---

## DNS

En Cloudflare, sobre la zona `asdf123.cl`:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| A | `medic` | `159.195.7.134` | DNS only |

Se usa **DNS only** (nube gris) igual que los demás registros de la zona, para
que Nginx Proxy Manager pueda emitir el certificado Let's Encrypt por
validación HTTP-01.

---

## Publicar el sitio en Nginx Proxy Manager

Entrar al panel en `http://159.195.7.134:81` y crear un *Proxy Host*:

**Pestaña Details**

| Campo | Valor |
|---|---|
| Domain Names | `medic.asdf123.cl` |
| Scheme | `http` |
| Forward Hostname / IP | `medigex-app` |
| Forward Port | `3000` |
| Cache Assets | desactivado |
| Block Common Exploits | activado |
| Websockets Support | activado |

**Pestaña SSL**

| Campo | Valor |
|---|---|
| SSL Certificate | *Request a new SSL Certificate* |
| Force SSL | activado |
| HTTP/2 Support | activado |
| HSTS Enabled | activado |

**Pestaña Advanced** — la subida de exámenes y fotografías necesita un cuerpo
de petición más grande que el que trae Nginx por defecto:

```nginx
client_max_body_size 25m;
```

`medigex-app` se resuelve por nombre porque el contenedor está en la red
`nginx_default`, la misma del proxy.

---

## Despliegue automático

Cada `push` a `main` dispara el workflow `.github/workflows/desplegar.yml`,
que primero verifica tipos y build y luego actualiza el servidor por SSH.

### Secretos que hay que cargar en GitHub

En **Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Valor |
|---|---|
| `VPS_HOST` | `159.195.7.134` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | contenido completo de la llave privada `~/.ssh/medigex_deploy` |

Para copiar la llave privada al portapapeles en macOS:

```bash
pbcopy < ~/.ssh/medigex_deploy
```

La llave pública ya quedó instalada en `/home/deploy/.ssh/authorized_keys` del
servidor. El usuario `deploy` pertenece al grupo `docker` y es dueño de
`/opt/stacks/medigex`, así que no necesita `sudo` ni la contraseña de root.

### Qué hace el workflow

1. `npm ci`, `prisma generate`, `tsc --noEmit` y `npm run build`.
2. Por SSH: `git reset --hard origin/main`, reconstruye la imagen.
3. Aplica migraciones pendientes (sin volver a sembrar datos).
4. `docker compose up -d` y espera a que el healthcheck quede en `healthy`.
5. Limpia imágenes de más de 7 días.

Si el healthcheck falla, el workflow imprime los últimos registros del
contenedor y termina en error, dejando la versión anterior corriendo.

### Volver a sembrar datos de demostración

Desde la pestaña **Actions → Desplegar en el VPS → Run workflow**, marcando
la casilla *Volver a ejecutar la semilla*. La semilla es idempotente: no
duplica registros existentes.

---

## Despliegue manual

```bash
ssh deploy@159.195.7.134
cd /opt/stacks/medigex
./deploy/desplegar.sh            # sólo migraciones
./deploy/desplegar.sh --sembrar  # migraciones + semilla
```

---

## Operación diaria

```bash
# Estado del stack
docker compose ps

# Registros de la aplicación
docker compose logs -f app

# Consola de la base de datos
docker compose exec db psql -U medigex -d medigex

# Respaldo inmediato
docker compose exec db pg_dump -U medigex medigex | gzip > respaldos/manual-$(date +%F).sql.gz

# Restaurar un respaldo
gunzip -c respaldos/medigex-20260101-0300.sql.gz | docker compose exec -T db psql -U medigex -d medigex
```

Los respaldos automáticos quedan en `/opt/stacks/medigex/respaldos/`, uno por
día, y se borran los de más de 14 días.

---

## Monitoreo con Uptime Kuma

En `kuma.asdf123.cl`, agregar un monitor:

| Campo | Valor |
|---|---|
| Tipo | HTTP(s) - Keyword |
| URL | `https://medic.asdf123.cl/api/health` |
| Palabra clave | `ok` |
| Intervalo | 60 segundos |

El endpoint `/api/health` es público (no exige sesión) y comprueba también la
conexión con PostgreSQL, así que detecta tanto una caída de la aplicación como
una de la base de datos.

---

## Pendientes de seguridad antes de producción

Este es un ambiente de desarrollo y quedaron cosas abiertas a propósito. Antes
de pasar a producción conviene cerrar al menos esto:

1. **Cambiar la contraseña de root del VPS.** La actual se compartió por chat.
2. **Desactivar el acceso SSH por contraseña** una vez confirmado que la llave
   del usuario `deploy` funciona:
   ```
   # /etc/ssh/sshd_config
   PasswordAuthentication no
   PermitRootLogin prohibit-password
   ```
3. **Instalar un firewall.** Hoy el servidor no tiene `ufw` ni reglas de
   `iptables`, y quedan expuestos a internet el panel de Nginx Proxy Manager
   (puerto 81), Portainer (9443) y GLPI (8400). Lo razonable es dejar abiertos
   sólo 22, 80 y 443:
   ```bash
   apt install ufw
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
   ufw enable
   ```
   Los paneles de administración quedan accesibles por túnel SSH:
   `ssh -L 8181:localhost:81 deploy@159.195.7.134`
4. **Cambiar la contraseña del usuario `admin@medigex.cl`** y de las cuentas de
   demostración, o eliminarlas con `SEED_DEMO=0` en una instalación limpia.
5. **Rotar `AUTH_SECRET`** al pasar a producción (invalida todas las sesiones).
6. **Sacar los respaldos del servidor**: hoy quedan en el mismo disco que la
   base de datos.
