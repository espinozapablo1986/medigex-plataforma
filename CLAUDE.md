# MEDIGEX — notas para trabajar en este repositorio

## Documentar es parte del cambio, no un extra

Todo cambio funcional se documenta **en el mismo commit que el código**:

1. Entrada en [`CHANGELOG.md`](CHANGELOG.md), arriba, en lenguaje de negocio y
   con el hash del commit.
2. Sección correspondiente en [`docs/modulos.md`](docs/modulos.md). Si el
   feature ya estaba documentado y se modificó, **se corrige esa sección**; no
   se añade una nota suelta en otro lugar.
3. Si cambia el alcance de la plataforma, se actualiza la tabla de módulos del
   [`README.md`](README.md).

Un push que deja la documentación desfasada se considera incompleto.

## El despliegue se verifica, no se supone

Un push a `main` dispara GitHub Actions, que verifica y despliega en el VPS.
El hash del commit va horneado en la imagen y se sirve desde `/api/health`.

Antes de dar por terminado un cambio, comprobarlo:

```bash
curl -s https://medic.asdf123.cl/api/health
```

Si la versión que responde no es la del commit recién empujado, el despliegue
no terminó. Un `307` de cualquier ruta no prueba nada: el middleware redirige
al login cualquier path, exista o no.

## Convenciones que no se negocian

- **Montos en CLP como `Int`.** El peso no usa decimales; un `Float` produce
  diferencias de un peso al sumar. Los porcentajes sí son `Float`.
- **Toda escritura pasa por `exigirPermiso(modulo, accion)`** y deja registro
  en `registro_auditoria`. No hay atajos: es lo que sostiene la vista previa
  de sólo lectura y la trazabilidad clínica.
- **Los permisos son datos**, en `rol_permisos`. Añadir un módulo o una acción
  se hace en `src/lib/permissions.ts` y la semilla la propaga sin pisar los
  ajustes manuales del administrador.
- **Migraciones que preservan datos.** Cuando el generador de Prisma propone
  borrar y recrear columnas con datos vivos, se escribe la migración a mano
  en el orden correcto: crear → sembrar → rellenar → eliminar.
- La interfaz y el código están **en español**, incluidos nombres de funciones
  y variables. Mantenerlo.
