# MEDIGEX

Plataforma de gestión para centros dentales y consultas médicas.
**Medi** (medicina) + **Gex** (gestión).

Ambiente de desarrollo: <https://medic.asdf123.cl>

---

## Qué incluye

| Área | Módulos |
|---|---|
| **Clínico** | Agenda y disponibilidad · Pacientes y ficha clínica · Historia clínica · Exámenes · Recetas digitales · Interconsultas |
| **Dental** | Odontograma por pieza y cara (FDI) · Periodontograma de seis sitios |
| **Comercial** | Presupuestos · Ventas · Pagos y comprobantes · Convenios · Informes de beneficio (Isapre / seguro complementario) · CRM de interesados |
| **Operaciones** | Inventario de insumos · Gastos y compras · Liquidaciones a profesionales · Reportes |
| **Maestros** | Profesionales · Servicios · Boxes y salas · Proveedores |
| **Administración** | Dashboard con IVA · Usuarios · Roles y permisos configurables · Vista previa como otro usuario · Configuración |

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

- [`CHANGELOG.md`](CHANGELOG.md) — qué cambió y cuándo
- [`docs/modulos.md`](docs/modulos.md) — detalle funcional por módulo
- [`docs/despliegue.md`](docs/despliegue.md) — instalación en el VPS
- [`docs/plan-implementacion.md`](docs/plan-implementacion.md) — lo que falta, por etapas
- [`docs/MEDIGEX - Estudio de brechas y plan.pdf`](docs/) — comparación con el mercado

**La documentación se actualiza en el mismo commit que el código.** Un cambio
funcional que no toque `CHANGELOG.md` y la sección correspondiente de
`docs/modulos.md` está incompleto.
