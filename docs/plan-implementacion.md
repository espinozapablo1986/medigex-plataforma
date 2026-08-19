# Plan de implementación

Cierre de las brechas detectadas en el estudio comparativo con el mercado.
El PDF con el estudio completo está en
[`MEDIGEX - Estudio de brechas y plan.pdf`](./MEDIGEX%20-%20Estudio%20de%20brechas%20y%20plan.pdf).

Cinco etapas secuenciales. Cada una se apoya en la anterior y deja la
plataforma utilizable al terminar. Las duraciones suponen una persona
dedicada y **no incluyen trámites con terceros**.

---

## Etapa 0 · Endurecer antes de datos reales

**Objetivo:** que la plataforma pueda recibir datos clínicos sin riesgos
evitables. Es la única etapa que conviene no postergar.

| Tarea | Esfuerzo | Depende de |
|---|---|---|
| Cortafuegos `ufw` (22/80/443) y paneles sólo por túnel SSH | ½ día | — |
| Cambiar contraseña de root y desactivar login SSH por contraseña | ½ día | — |
| Límite de intentos de login por IP y por cuenta | 1 día | — |
| Recuperación de contraseña por correo con enlace que vence | 1½ días | Servidor SMTP |
| Respaldos cifrados fuera del servidor + prueba de restauración | 1 día | Cuenta de almacenamiento |
| Exportación a Excel/CSV respetando el permiso `exportar` | 1½ días | — |

**Al terminar:** apta para cargar pacientes reales, y el permiso `exportar`
deja de ser una casilla que no hace nada.

---

## Etapa 1 · Recordatorios y sala de espera

**Objetivo:** recuperar las horas que hoy se pierden por inasistencia. Es la
etapa con retorno más directo.

| Tarea | Esfuerzo | Depende de |
|---|---|---|
| Evaluar proveedor de mensajería, dar de alta el número y las plantillas | 2 días | **Trámite externo** |
| Motor de envíos con cola, reintentos y registro de entregas | 3 días | Proveedor |
| Proceso diario que barre las citas del día siguiente | 1 día | Motor |
| Enlace de confirmación que actualiza el estado de la cita | 2 días | Motor |
| Pantalla de sala de espera (llegadas, espera, quién está en box) | 2 días | — |

**Al terminar:** medir la tasa de inasistencia antes y después.

> **Riesgo:** el alta de WhatsApp Business y la aprobación de plantillas
> dependen de un tercero y pueden tardar más que el desarrollo. Conviene
> iniciar el trámite durante la etapa 0, en paralelo.

Aprovecha el campo `recordatorioEnviado`, que hoy existe en la tabla de citas
y nunca se usa.

---

## Etapa 2 · Odontograma y planes de tratamiento — *parcialmente hecha*

**Objetivo:** que un odontólogo pueda trabajar el día entero sin salir de
MEDIGEX. Sin esto, un centro dental no adopta la plataforma.

| Tarea | Esfuerzo | Depende de |
|---|---|---|
| ~~Modelo de piezas y hallazgos (adulta y temporal, estado por cara, historial)~~ **hecho** | 3 días | — |
| ~~Odontograma interactivo~~ **hecho** (falta la comparación entre fechas) | 5 días | Modelo |
| ~~Generar presupuesto desde los hallazgos marcados~~ **hecho** | 2 días | Odontograma |
| ~~Periodontograma de seis sitios con NIC e índices~~ **hecho** (no estaba en el plan) | — | — |
| Plan de tratamiento por fases, con avance por sesión | 4 días | Presupuesto |
| Consentimiento informado firmado en pantalla | 2 días | — |

Aprovecha la columna `odontograma` que ya existe en cada atención y hoy está
vacía por falta de interfaz.

---

## Etapa 3 · Circuito tributario

**Objetivo:** que cobrar y documentar sean un solo acto.

| Tarea | Esfuerzo | Depende de |
|---|---|---|
| Elegir emisor autorizado de documentos tributarios electrónicos | 2 días | Decisión comercial |
| Emisión de boleta y factura al cerrar la venta, con reintento | 5 días | Emisor |
| Notas de crédito para anular una venta ya documentada | 2 días | Emisión |
| Cierre de caja: apertura, arqueo por forma de pago, diferencias | 3 días | — |
| Libros de ventas y compras exportables | 2 días | Exportación de la etapa 0 |

**Al terminar:** se acaba la doble digitación y el descuadre entre lo cobrado
y lo declarado.

---

## Etapa 4 · Cara pública

**Objetivo:** que el paciente resuelva solo lo que hoy exige llamar por
teléfono.

| Tarea | Esfuerzo | Depende de |
|---|---|---|
| Reserva de horas online sobre el motor de cupos existente | 5 días | API ya construida |
| Portal del paciente (horas, presupuestos, recetas, cuenta) | 6 días | Autenticación separada |
| Pagos en línea con conciliación automática | 5 días | **Trámite con la pasarela** |
| Encuesta de satisfacción tras la atención | 2 días | Motor de mensajería |

---

## Mejoras de interfaz

No tienen etapa propia: conviene repartirlas entre las anteriores, tomando
una o dos por etapa.

| Mejora | Qué resuelve |
|---|---|
| Buscador global con atajo de teclado | Hoy hay que navegar al módulo antes de buscar |
| Agenda semanal y reagendar arrastrando | La vista diaria sirve para operar, no para planificar |
| Tablas ordenables y exportables | El permiso existe; falta el botón |
| Vista móvil con tarjetas | Las tablas se desplazan de lado en el teléfono |
| ~~Puesta en marcha guiada~~ **hecha** en el módulo de Ayuda | Una instalación limpia arranca vacía y sin rumbo |

---

## Resumen

| Etapa | Duración | Qué desbloquea |
|---|---|---|
| 0 · Endurecer | 1 semana | Poder cargar datos reales |
| 1 · Recordatorios | 2 semanas | Menos inasistencias |
| 2 · Odontograma | 3 semanas | Adopción por parte del odontólogo |
| 3 · Tributario | 3 semanas | Fin de la doble digitación |
| 4 · Cara pública | 4 semanas | Competir con las suites comerciales |

Total aproximado: **13 semanas** de desarrollo, más los trámites externos que
conviene iniciar con una etapa de anticipación.
