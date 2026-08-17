# Módulos de MEDIGEX

Guía funcional de lo que hace cada parte del sistema y de las decisiones que
hay detrás.

---

## Perfiles y permisos

Los permisos **son datos, no código**. La tabla `rol_permisos` guarda una fila
por combinación de rol, módulo y acción, de modo que un administrador puede
activar o desactivar cualquier casilla desde **Roles y permisos** sin tocar el
código ni volver a desplegar.

**Acciones disponibles:** ver, crear, editar, eliminar, exportar, aprobar y
anular. No todos los módulos usan todas: la matriz sólo muestra las que
aplican a cada uno.

### Roles que vienen cargados

| Rol | Alcance |
|---|---|
| **Administrador** | Todo, incluida la configuración y los reportes financieros. |
| **Profesional** | Su agenda, historia clínica, recetas, interconsultas y presupuestos. Ve ventas y pagos pero no los crea. |
| **Secretaria / Recepción** | Agenda, fichas de pacientes, presupuestos, ventas y cobros. La historia clínica sólo de lectura. |
| **Asistente clínico** | Apoyo: lectura clínica e inventario con permiso de escritura. |

Se pueden crear roles nuevos copiando los permisos de uno existente y
ajustando desde ahí. Los cuatro roles base están marcados como «de sistema» y
no se pueden eliminar, pero sí desactivar y modificar.

---

## Agenda

Cada profesional define **bloques de disponibilidad recurrentes** por día de la
semana, con hora de inicio, hora de término, duración del cupo y box
preferente. Los bloques pueden tener vigencia acotada, para contratos
temporales.

Sobre esa base se aplican **excepciones**: bloqueos puntuales, vacaciones,
licencias, feriados, mantención de un box o disponibilidad extra fuera del
horario habitual.

Al agendar, el sistema comprueba cuatro cosas y las informa por separado:

1. Que el profesional no tenga otra hora que se solape.
2. Que el box esté libre en ese rango.
3. Que no haya un bloqueo vigente sobre el profesional o el box.
4. Que la hora caiga dentro del horario declarado del profesional.

La casilla **sobrecupo** salta sólo la cuarta validación. Nunca permite pisar
una hora ya reservada ni ocupar un box tomado.

La vista diaria se puede ver **por profesional** o **por box**, lo que responde
la pregunta de administración de si hay boxes libres a una hora dada. Los
servicios marcados con `usaRayosX` marcan la cita automáticamente para que
recepción sepa que necesita la sala de rayos.

---

## Pacientes e historia clínica

La ficha se crea al ingresar al paciente por primera vez y recibe un número
correlativo. Pide RUT —validado con el dígito verificador— o pasaporte para
extranjeros, dos teléfonos de contacto, correo opcional, fecha de nacimiento o
edad, previsión y convenio.

**Procedencia:** si el paciente viene derivado de otro centro clínico se
registra el centro de origen, el profesional que deriva, el motivo y la fecha.
Esto alimenta el reporte de captación.

Las **alergias** se destacan en rojo en la cabecera de la ficha, en la pantalla
de atención y en la receta impresa.

La ficha se organiza en pestañas: resumen, historia clínica, exámenes,
archivos, cuenta corriente y recetas.

### El motivo de consulta

Toda atención exige el motivo de consulta. Cuando la atención nace de una cita
agendada, el motivo que anotó recepción viene precargado, pero el campo sigue
siendo obligatorio para que el profesional lo confirme con el paciente.

Al guardar una atención asociada a una cita con servicio, el sistema marca la
hora como atendida y **descuenta del inventario los insumos** configurados para
ese servicio.

### Archivos

Fotografías clínicas, radiografías, exámenes, consentimientos y documentos, con
categoría y descripción. Se pueden asociar a una atención o a un examen
concreto. Los archivos **no se sirven como estáticos**: pasan por
`/api/adjuntos/[id]`, que valida la sesión y el permiso del módulo al que
pertenece el adjunto.

---

## Interconsultas

Derivación de un paciente entre profesionales del centro, con motivo, resumen
clínico y prioridad. El profesional de destino la acepta, rechaza o marca como
completada, y recepción puede agendar la hora directamente desde la
interconsulta: la cita queda enlazada y marcada con canal «derivación».

---

## Presupuestos

Se arman con servicios e insumos, con cantidad, precio unitario, descuento por
línea, descuento global y pieza dental cuando corresponde. Si el paciente tiene
convenio, al guardar se aplican las tarifas negociadas.

Estados: borrador → enviado → aceptado / rechazado / vencido → facturado. Un
presupuesto aceptado se convierte en venta con un clic, arrastrando todas sus
líneas.

El documento está pensado para imprimirse o guardarse como PDF con
`Ctrl/Cmd + P`.

---

## Ventas, pagos y cuenta corriente

Cada línea de venta guarda **quién ejecutó la prestación**, que es la base del
cálculo de honorarios. Los totales se recalculan siempre en el servidor: lo que
muestra el navegador mientras se edita es sólo una previsualización.

Los precios de lista se manejan **con IVA incluido**, como es habitual en
Chile, y el neto se obtiene desglosando hacia atrás. Las líneas exentas se
tratan por separado al calcular la proporción afecta.

### Cuenta corriente

Cada paciente tiene un libro mayor (`movimientos_cuenta`) donde cada venta
genera un cargo y cada pago un abono. Cada movimiento guarda el saldo
acumulado, así que la cartola se lee sin recalcular la historia completa.
Saldo positivo significa que el paciente debe; negativo, que tiene saldo a
favor.

Al anular una venta o un pago se genera un contra-asiento y se recalcula la
cartola completa, en lugar de borrar registros.

### Formas de pago

Configurables desde **Configuración**. Cada una puede exigir comprobante
adjunto —transferencias, bonos Isapre— o número de operación —tarjetas,
cheques—, y registrar el costo de transacción del medio de pago.

---

## Convenios e informes de beneficio

Un convenio (Isapre, seguro complementario, empresa o mutual) define un
descuento general, un porcentaje de cobertura y, opcionalmente, un tope por
prestación. Además admite **tarifas negociadas servicio por servicio**, con su
código de prestación.

Al vender a un paciente con convenio, cada línea calcula qué parte asume la
aseguradora y cuánto es copago. La prioridad es: tarifa del servicio en el
convenio → descuento general del convenio → precio de lista.

El **informe de beneficio** reúne las prestaciones ya pagadas de un paciente en
un período y genera un certificado imprimible con fecha, código de prestación,
profesional, valor, cobertura y copago, para que el paciente lo presente a su
Isapre o seguro. Sólo incluye prestaciones efectivamente canceladas.

---

## Liquidaciones de profesionales

El honorario de cada prestación se resuelve con esta prioridad:

1. Comisión pactada para **ese profesional en ese servicio**.
2. Comisión definida en **el servicio**.
3. Comisión general **del profesional**.

Cada regla puede ser un **porcentaje sobre lo cobrado** o un **monto fijo por
prestación**, multiplicado por la cantidad realizada. Un profesional a sueldo o
que sólo arrienda box no genera comisión.

Al generar una liquidación se toman todas las prestaciones del período que aún
no hayan sido liquidadas, se calcula el honorario de cada una, se descuenta el
**arriendo de box** prorrateado según la periodicidad del contrato, y se
agregan bonos o descuentos manuales.

Las prestaciones quedan marcadas para no liquidarse dos veces. Si se elimina
una liquidación en borrador, vuelven a quedar disponibles.

Estados: borrador → aprobada → pagada. El documento incluye espacio para firma
del profesional y de administración.

---

## Inventario

Productos con SKU, categoría, proveedor, unidad de medida, stock mínimo y
máximo, y ubicación en bodega. Distingue **insumos clínicos** de productos
**vendibles** al paciente.

El costo se lleva con **promedio ponderado**: cada entrada con costo informado
recalcula el costo promedio del producto.

Movimientos: entrada, salida, ajuste, merma, devolución, consumo por servicio,
venta e inventario inicial. Cada movimiento guarda el stock antes y después,
de modo que la cartola es auditable.

El consumo automático por servicio **no bloquea la atención clínica** si falta
stock: deja el saldo en negativo y lo destaca en las alertas de inventario para
que se regularice con un ajuste. Es preferible eso a impedir que se registre
una atención que ya ocurrió.

---

## Gastos

Compras y egresos con categoría, proveedor, documento tributario y respaldo
adjunto. El IVA se desglosa automáticamente desde el total cuando el documento
es una factura con derecho a crédito fiscal, y se puede sobrescribir a mano
para documentos con ítems exentos mezclados.

Admite gastos recurrentes con su periodicidad y gastos pendientes de pago.

---

## Recetas

Prescripción digital con uno o varios medicamentos, cada uno con principio
activo, presentación, dosis, vía, frecuencia, duración, cantidad a dispensar e
indicaciones específicas. Las recetas retenidas y los cheques médicos exigen
diagnóstico.

Al emitirla queda firmada con fecha, registrada en la historia del paciente e
imprimible con los datos del profesional, su RUT y su número de registro en la
Superintendencia. Las alergias del paciente aparecen destacadas en el
documento.

Una receta anulada no se borra: queda marcada, por trazabilidad.

---

## Dashboard y reportes

El **dashboard** muestra la agenda del día, ingresos, gastos, resultado
operacional, saldos por cobrar, alertas de stock y la evolución de los últimos
seis meses.

La **estimación de IVA** calcula el débito fiscal de las ventas menos el
crédito fiscal de las compras con factura, como referencia para el F29. Es una
estimación de gestión: no reemplaza la declaración formal ante el SII.

Los **reportes** cubren servicios más vendidos, ticket medio, ranking de
profesionales con su producción y honorarios, margen del centro por
profesional, ventas por categoría, ocupación de boxes, recaudación por forma de
pago, tasa de inasistencia y pacientes nuevos con cuántos vienen derivados.

---

## Auditoría

Toda operación de escritura queda registrada en `registro_auditoria` con
usuario, módulo, acción, entidad afectada, detalle e IP. Las últimas acciones
se ven en **Configuración**. La auditoría nunca interrumpe la operación
principal: si falla el registro, la operación igual se completa.

---

## Convenciones del código

- **Montos en CLP como `Int`.** El peso chileno no usa decimales y así se
  evitan los problemas de serialización de `Decimal` entre servidor y cliente.
- **Porcentajes como `Float`** (`40.5` = 40,5 %).
- **Todo el dominio en español**, incluidos los nombres de modelos y campos,
  para que el código se lea igual que las conversaciones con la clínica.
- **Server actions** para toda escritura, cada una validando permisos con
  `exigirPermiso(modulo, accion)` antes de tocar la base de datos.
- Los totales de documentos comerciales **se recalculan siempre en el
  servidor**; nunca se confía en lo que envía el navegador.
