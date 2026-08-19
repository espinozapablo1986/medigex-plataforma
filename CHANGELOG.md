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

## 19 de agosto de 2026

### Batería de pruebas, y dos defectos que sacó a la luz — `PENDIENTE`

Se agregan pruebas automatizadas de la lógica pura (`npm run probar`, 90
comprobaciones) y se enchufan al despliegue: si fallan, no se despliega. Es la
brecha que el estudio señalaba como más barata y la que más disgustos evita.

Al ejecutarlas y recorrer las 59 rutas de la plataforma aparecieron dos
defectos reales:

- **El nivel de inserción clínica se calculaba al revés.** El periodontograma
  usaba `sondaje + margen`, pero el esquema y el propio gráfico definen el
  margen como distancia al límite amelocementario, positiva cuando la encía lo
  cubre. Con sondaje 5 mm y margen +2 el gráfico mostraba 3 mm de pérdida y la
  cifra decía 7: periodontitis leve frente a severa. La fórmula correcta es
  `sondaje − margen`. El NIC no se guarda en la base, así que la corrección
  arregla también todos los exámenes ya registrados.
- **El buscador global devolvía error 500.** Un byte NUL se había colado en el
  código fuente, en el valor centinela que se usaba cuando la búsqueda no traía
  dígitos; PostgreSQL rechaza de plano el texto que lo contiene. Se reemplazó
  por una condición explícita, y una prueba nueva vigila que no vuelva a
  colarse un NUL en ningún archivo.

### Conteos de inventario y carga masiva desde Excel — `b67b9b0`

**Conteos físicos.** Se abre un recuento —de todo, o acotado a una categoría o
ubicación—, se cuenta en pantalla o en una planilla descargable, y al cerrarlo
el sistema iguala el stock a lo contado dejando un movimiento de ajuste por
cada diferencia. La existencia teórica se congela al abrir, para que lo
consumido en atenciones durante el recuento no se confunda con un descuadre de
bodega, y va oculta mientras se cuenta para no sesgar el recuento. Cerrar exige
el nuevo permiso **aprobar**, de modo que contar y aprobar el ajuste puedan ser
personas distintas.

**Carga masiva de productos.** Plantilla `.xlsx` descargable, con una hoja de
instrucciones que incluye las unidades admitidas y las categorías existentes.
El SKU es la llave: crea o actualiza. La importación muestra primero qué va a
pasar —altas, actualizaciones y filas descartadas con su motivo— y sólo aplica
al confirmar. El stock de un producto que ya existe nunca se reescribe desde
una planilla.

De paso se corrigió un fallo en el motor de stock: un ajuste a cero unidades se
rechazaba por «cantidad cero», cuando dejar un producto sin existencias es
justamente el resultado más común de un conteo.

### Corrección: poner el repositorio en privado rompía el despliegue — `6491945`

Tres despliegues seguidos fallaron sin causa aparente. El VPS traía el código
desde GitHub **por HTTPS de forma anónima**, así que al pasar el repositorio a
privado `git fetch` se quedaba sin credenciales y el paso moría en su primera
línea.

Ahora el workflow le pasa al servidor el `GITHUB_TOKEN` efímero —de sólo
lectura y válido únicamente durante la ejecución—, con lo que funciona tanto
en público como en privado. Además se despliega **el commit exacto que disparó
el workflow** y no «lo último que haya en main», y un fetch fallido se anuncia
con un mensaje claro en vez de un error críptico.

### Buscador global, vista móvil y contacto por WhatsApp — `5652639`

**Buscar en todo.** Desde cualquier pantalla, con **Ctrl/⌘ + K**: pacientes por
nombre, RUT, ficha o teléfono; profesionales, servicios, contactos del CRM,
folios de presupuesto y venta, y guías de ayuda. Ignora tildes —«jose perez»
encuentra a «José Pérez»— y sólo muestra lo que el rol puede abrir.

**Las tablas se vuelven tarjetas en el teléfono.** Bajo los 768 px cada fila se
apila con la etiqueta de su columna junto al dato, en lugar de desplazarse de
lado. Las etiquetas se toman del propio encabezado de cada tabla, así que
sirve para las veinte tablas existentes y para las que vengan.

**Contactar por WhatsApp**, manual y sin proveedor: un botón abre la
conversación con el mensaje ya escrito, distinto según el caso (recordatorio de
hora, saldo pendiente, seguimiento de presupuesto, invitar a volver). Si el
teléfono registrado no sirve, el botón no aparece. El envío automático queda
aplazado por decisión del cliente.

### Corrección: las listas de recuperación del CRM fallaban al abrirse — `186182d`

Las cuatro listas inteligentes del CRM (sin volver, controles, saldos e
inasistencias) recibían el texto del mensaje de WhatsApp como una **función**
generada en el servidor. React no puede serializar una función al pasarla a un
componente de cliente, así que la página fallaba al renderizar.

Ahora la plantilla viaja como texto con marcadores `{nombre}` y `{monto}`, que
el navegador reemplaza. El error sólo aparecía en el registro del servidor, no
en la verificación de tipos ni en el build, y se detectó revisando los logs de
producción.

### Módulo de Ayuda con guías paso a paso — `1a15cdf`

La plataforma ya no llega sin instrucciones. Se agrega un módulo de **Ayuda**
en el pie del menú lateral, sin permiso que lo restrinja, con:

- **24 guías**, una por módulo, con paso a paso numerado, lo que conviene
  saber, los problemas frecuentes con su solución, y enlaces a lo relacionado.
- **Buscador** por título, sinónimos y contenido de los pasos, ignorando
  tildes: «marcar caries» lleva al odontograma.
- **Ayuda contextual**: un «?» junto al título de cada módulo abre su guía,
  que es donde de verdad surge la duda.
- **Lista de puesta en marcha** para administradores, que comprueba el estado
  real de la instalación —profesionales, servicios, boxes, formas de pago,
  datos de la clínica, condiciones dentales enlazadas— y desaparece sola al
  completarse.

El índice sólo ofrece guías de módulos que la persona puede abrir.

→ `docs/modulos.md`, sección «Ayuda»

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
