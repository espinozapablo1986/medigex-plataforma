# MEDIGEX

Plataforma de gestión para centros dentales y consultas médicas.
**Medi** (medicina) + **Gex** (gestión).

Ambiente de desarrollo: <https://medic.asdf123.cl>

---

## Qué incluye

| Área | Módulos |
|---|---|
| **Clínico** | Agenda y disponibilidad · Pacientes y ficha clínica · Historia clínica · Exámenes · Recetas digitales · Interconsultas |
| **Comercial** | Presupuestos · Ventas · Pagos y comprobantes · Convenios · Informes de beneficio (Isapre / seguro complementario) |
| **Operaciones** | Inventario de insumos · Gastos y compras · Liquidaciones a profesionales · Reportes |
| **Maestros** | Profesionales · Servicios · Boxes y salas · Proveedores |
| **Administración** | Dashboard con IVA · Usuarios · Roles y permisos configurables · Configuración |

## Stack

- **Next.js 15** (App Router, Server Actions) + **TypeScript**
- **PostgreSQL 16** + **Prisma**
- **Tailwind CSS**
- Sesiones propias con JWT (`jose`) y contraseñas con `bcrypt`
- Despliegue con **Docker Compose** detrás de Nginx Proxy Manager

## Puesta en marcha local

```bash
cp .env.example .env      # ajusta DATABASE_URL y AUTH_SECRET
npm install
npx prisma migrate dev
npm run seed              # datos de demostración + usuario administrador
npm run dev
```

La aplicación queda en <http://localhost:3000>.

### Con Docker

```bash
docker compose up -d --build
```

## Convenciones del código

- **Montos en CLP** se guardan como `Int` (el peso chileno no usa decimales).
- **Porcentajes** se guardan como `Float` (`40.5` = 40,5 %).
- Toda operación de escritura pasa por una *server action* que valida permisos
  con `exigirPermiso(modulo, accion)` y deja registro en `registro_auditoria`.
- Los permisos son datos, no código: la matriz vive en la tabla `rol_permisos`
  y se edita desde **Configuración → Roles y permisos**.

## Documentación

- [`docs/despliegue.md`](docs/despliegue.md) — instalación en el VPS
- [`docs/modulos.md`](docs/modulos.md) — detalle funcional por módulo
