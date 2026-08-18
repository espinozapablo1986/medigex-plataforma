# Historial de cambios

Registro de lo que va cambiando en MEDIGEX, en lenguaje de negocio y no de
código. Lo más nuevo arriba.

Cada entrada anota el commit con el que llegó, para poder ir al detalle
técnico. La versión que está sirviendo el ambiente de desarrollo se consulta
en `https://medic.asdf123.cl/api/health`.

**Norma:** todo cambio funcional entra aquí y en `docs/modulos.md` en el mismo
commit que el código. Si un feature se modifica, se corrige su sección en la
documentación en vez de añadir una nota suelta.

---

## 17 de agosto de 2026

### Vista previa como otro usuario — `5c91b58`

Los administradores pueden comprobar qué ve y qué alcanza a hacer cada perfil
sin pedirle la contraseña a nadie, con el botón **«Ver como»** en cada fila de
Usuarios. Una banda fija recuerda de quién es la vista y permite salir.

Es **de sólo lectura** a propósito: escribir en nombre de otro rompería la
autoría de la ficha clínica y el registro de auditoría, y para verificar
permisos no hace falta. El bloqueo está en el servidor y cubre los 25 módulos.

Se agregó la acción **«Ver como»** a la matriz de Roles y permisos; por
defecto sólo la tiene Administrador.

→ `docs/modulos.md`, sección «Comprobar los permisos: Ver como»

### Corrección: el despliegue no recambiaba el contenedor — `d43a1ef`

Tres despliegues seguidos actualizaron el código y la base de datos pero
dejaron corriendo la versión anterior. La causa era que el contenedor de
migraciones consumía la entrada estándar y se comía el resto del script que
viajaba por SSH. Se corrigió con `run --rm -T … < /dev/null`.

### Corrección: faltaba el catálogo dental en producción — `e457dfb`

Las condiciones dentales estaban en la parte de datos de demostración de la
semilla, así que un ambiente real quedaba sin catálogo y el odontograma no se
podía usar. Pasaron a ser dato base.

### Ficha odontológica: odontograma y periodontograma — `0774bfa`

- **Odontograma** por pieza y cara en notación FDI, permanente y temporal,
  con pincel activo para marcar en lote, catálogo de condiciones configurable
  y paso directo a presupuesto.
- **Periodontograma** con seis sitios por pieza, cálculo automático del nivel
  de inserción clínica, gráfico de margen y bolsa, e índices de sangrado y
  placa.

→ `docs/modulos.md`, secciones «Odontograma» y «Periodontograma»

### Estudio de brechas y plan de implementación — `2ae3279`

Comparación con la oferta nacional e internacional (Dentalink, Reservo,
Medinet, Open Dental, Dentrix, Curve, NexHealth, Pabau) y plan por etapas.
Entregado también como PDF en `docs/`.

### Despliegue verificable — `7cdd45d`

El hash del commit se hornea en la imagen y se sirve desde `/api/health`; el
despliegue ahora **falla** si lo que quedó sirviendo no coincide con lo que se
desplegó. Antes un despliegue a medias pasaba por bueno.

### Norma gráfica MEDIGEX v1.0 — `4813c38`

Identidad aplicada a toda la plataforma: paleta de marca, tipografías,
esquinas rectas, sombras contenidas, símbolo y logotipo.

### Disponibilidad de boxes visible al agendar — `67e0c7d`

Al elegir profesional, fecha y servicios, se listan los **boxes libres** para
ese rango, marcando el preferente del profesional y cuál tiene rayos X. Antes
había que cruzarlo a ojo en la vista por box.

### Módulo de CRM — `c9c197a`

Contactos interesados que aún no son pacientes, con origen, embudo, bitácora
de interacciones, seguimientos con fecha y conversión a ficha clínica.

→ `docs/modulos.md`, sección «CRM»

### Cámara y compresión de imágenes — `87caff6`

Las fotos clínicas se pueden tomar con la cámara del teléfono y se comprimen
en el navegador antes de subir: de unos 4 MB a unos 300 KB sin pérdida
visible, respetando la orientación EXIF.

### Previsiones, buscadores, varios servicios por hora y ficha imprimible — `9d17226`

- **Previsión** dejó de estar escrita en el código: es un mantenedor con CRUD.
- **Todos los desplegables se buscan escribiendo**, ignorando tildes.
- Una cita admite **varios servicios**, y la duración se ajusta sola; además
  se muestran y proponen los **horarios realmente disponibles**.
- **Ficha del paciente imprimible** o exportable a PDF, eligiendo qué incluir.

### Base de la plataforma — `ebe467c` … `1247d74`

Puesta en marcha completa: esquema de datos de 53 tablas, autenticación,
permisos configurables por rol y acción, y los módulos clínicos, de agenda,
comerciales, de inventario, gastos, liquidaciones, convenios, recetas,
dashboard y reportes. Empaquetado en Docker y despliegue automático por
GitHub Actions al ambiente `medic.asdf123.cl`.

→ `docs/modulos.md` y `docs/despliegue.md`
