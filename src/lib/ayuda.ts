/**
 * Contenido del módulo de Ayuda.
 *
 * Las guías son **datos, no páginas**: así se buscan, se filtran por lo que
 * cada rol puede ver y se enlazan desde el encabezado de cada módulo sin
 * duplicar texto. El `slug` coincide a propósito con el slug del módulo en
 * `permissions.ts`, que es lo que permite esconder la guía de un módulo al
 * que el usuario no tiene acceso.
 *
 * Al agregar un módulo nuevo a la plataforma, se agrega su guía aquí.
 */

export interface PasoGuia {
  titulo: string;
  detalle: string;
}

export interface ProblemaGuia {
  problema: string;
  solucion: string;
}

export interface Guia {
  /** Coincide con el slug del módulo en permissions.ts. */
  slug: string;
  titulo: string;
  area: string;
  /** Una frase: para qué sirve el módulo. */
  resumen: string;
  /** Quién lo usa en el día a día. */
  paraQuien: string;
  /** Enlace al módulo, cuando tiene una ruta propia. */
  ruta?: string;
  /** Palabras por las que alguien podría buscarlo. */
  sinonimos?: string[];
  pasos: PasoGuia[];
  consejos?: string[];
  problemas?: ProblemaGuia[];
  /** Slugs de otras guías. */
  relacionados?: string[];
}

export const GUIAS: Guia[] = [
  // ── Operación diaria ──────────────────────────────────────
  {
    slug: 'dashboard',
    titulo: 'Dashboard',
    area: 'Operación diaria',
    resumen: 'La foto del día y del mes: ingresos, gastos, horas y lo que hay que mirar.',
    paraQuien: 'Administración y jefatura.',
    ruta: '/',
    sinonimos: ['inicio', 'panel', 'tablero', 'métricas', 'iva'],
    pasos: [
      {
        titulo: 'Elige el período',
        detalle:
          'Arriba se cambia el rango de fechas. Todo lo que ves debajo se recalcula: ingresos, gastos, ticket promedio y horas atendidas.',
      },
      {
        titulo: 'Lee primero la fila de cifras',
        detalle:
          'Ingresos del período, gastos, margen y IVA estimado. El IVA es una estimación para que sepas cuánto provisionar; no reemplaza la declaración.',
      },
      {
        titulo: 'Revisa lo que exige acción',
        detalle:
          'Más abajo aparecen las horas de hoy, los presupuestos por vencer, el stock bajo mínimo y los pacientes con saldo pendiente. Cada uno lleva directo al módulo correspondiente.',
      },
    ],
    consejos: [
      'El IVA se estima desglosando los precios, que se manejan con IVA incluido. Las prestaciones exentas se descuentan de la base.',
      'Si una cifra te parece rara, entra al módulo de origen: el dashboard nunca calcula nada que no puedas rastrear.',
    ],
    relacionados: ['reportes', 'ventas', 'gastos'],
  },
  {
    slug: 'agenda',
    titulo: 'Agenda',
    area: 'Operación diaria',
    resumen: 'Reservar horas comprobando que el profesional, el box y el horario estén libres.',
    paraQuien: 'Recepción y secretaría, principalmente.',
    ruta: '/agenda',
    sinonimos: ['citas', 'horas', 'reservar', 'calendario', 'agendar', 'box'],
    pasos: [
      {
        titulo: 'Antes de agendar, define el horario del profesional',
        detalle:
          'En la ficha del profesional se cargan sus bloques de disponibilidad: día de la semana, hora de inicio y término, duración del cupo y box preferente. Sin esto, el sistema no sabe cuándo ofrecer horas.',
      },
      {
        titulo: 'Crea la cita',
        detalle:
          'Pulsa «Nueva hora», elige paciente y profesional. Los desplegables se buscan escribiendo: no hace falta desplazarse por la lista.',
      },
      {
        titulo: 'Elige los servicios',
        detalle:
          'Una hora admite varios servicios. La duración se suma sola, así que no tienes que reservar dos bloques seguidos para una sesión larga.',
      },
      {
        titulo: 'Toma uno de los cupos propuestos',
        detalle:
          'Al elegir la fecha aparecen los horarios realmente disponibles como botones, ya descontados los choques y bloqueos. Se propone el primero libre, pero puedes tomar cualquiera.',
      },
      {
        titulo: 'Asigna el box',
        detalle:
          'Se listan los boxes libres para ese rango. El preferente del profesional viene marcado, y si algún servicio necesita rayos X se indica cuál tiene el equipo.',
      },
      {
        titulo: 'Confirma y registra la llegada',
        detalle:
          'La hora queda como reservada. Cuando el paciente llega se marca su estado, y al guardar la atención pasa sola a «atendida».',
      },
    ],
    consejos: [
      'La vista diaria se puede ver por profesional o por box. La segunda responde la pregunta de si queda alguna sala libre a una hora dada.',
      'Los bloqueos (vacaciones, licencias, mantención de un box, feriados) se cargan como excepciones y el sistema deja de ofrecer esos cupos.',
    ],
    problemas: [
      {
        problema: 'No aparece ningún horario disponible.',
        solucion:
          'Casi siempre es que el profesional no tiene bloques de disponibilidad cargados para ese día de la semana, o hay una excepción vigente que lo bloquea. Revísalo en su ficha.',
      },
      {
        problema: 'Necesito agendar fuera del horario habitual.',
        solucion:
          'Marca «sobrecupo». Salta sólo la validación del horario declarado; nunca te dejará pisar una hora ya tomada ni ocupar un box ocupado.',
      },
    ],
    relacionados: ['pacientes', 'profesionales', 'boxes', 'servicios'],
  },
  {
    slug: 'pacientes',
    titulo: 'Pacientes y ficha clínica',
    area: 'Operación diaria',
    resumen: 'Crear la ficha, registrar atenciones y consultar toda la historia del paciente.',
    paraQuien: 'Recepción crea la ficha; el profesional registra la atención.',
    ruta: '/pacientes',
    sinonimos: ['ficha', 'historia clínica', 'atención', 'rut', 'alergias'],
    pasos: [
      {
        titulo: 'Crea la ficha en la primera visita',
        detalle:
          'Pide RUT —se valida el dígito verificador— o pasaporte si es extranjero, dos teléfonos, correo opcional, fecha de nacimiento o edad, previsión y convenio. La ficha recibe un número correlativo.',
      },
      {
        titulo: 'Anota las alergias de inmediato',
        detalle:
          'Se destacan en rojo en la cabecera, en la pantalla de atención y en la receta impresa. Es el dato que más caro sale omitir.',
      },
      {
        titulo: 'Si viene derivado, registra la procedencia',
        detalle:
          'Centro de origen, profesional que deriva, motivo y fecha. Esto alimenta el reporte de captación, que te dice de dónde vienen tus pacientes.',
      },
      {
        titulo: 'Registra la atención',
        detalle:
          'El motivo de consulta es obligatorio siempre. Si la hora venía agendada, aparece precargado lo que anotó recepción, pero el campo sigue pidiendo confirmación para que el profesional lo valide con el paciente.',
      },
      {
        titulo: 'Recorre la ficha por pestañas',
        detalle:
          'Resumen, historia clínica, exámenes, archivos, odontograma, periodontograma, cuenta corriente y recetas. Todo el historial del paciente está en esa fila.',
      },
    ],
    consejos: [
      'Al guardar una atención ligada a una cita con servicio, el sistema marca la hora como atendida y descuenta del inventario los insumos configurados para ese servicio.',
      'Desde la ficha llegas a «Imprimir», donde eliges qué incluir y lo sacas a papel o PDF. Sirve para el paciente que pide su ficha o para derivar a un especialista externo.',
    ],
    problemas: [
      {
        problema: 'El RUT no me lo acepta.',
        solucion:
          'Se valida el dígito verificador con módulo 11. Si el paciente es extranjero y no tiene RUT, usa el campo de pasaporte.',
      },
    ],
    relacionados: ['agenda', 'odontograma', 'recetas', 'presupuestos'],
  },
  {
    slug: 'odontograma',
    titulo: 'Odontograma',
    area: 'Ficha dental',
    resumen: 'Registrar qué se encontró y qué se hizo en cada pieza y cara dental.',
    paraQuien: 'Odontólogos.',
    sinonimos: ['dental', 'diente', 'pieza', 'caries', 'fdi', 'caras'],
    pasos: [
      {
        titulo: 'Entra desde la ficha del paciente',
        detalle:
          'No está en el menú lateral: es una pestaña dentro de cada paciente, porque un odontograma pertenece a una persona concreta. Pacientes → abre el paciente → pestaña «Odontograma».',
      },
      {
        titulo: 'Elige la dentición',
        detalle: 'Permanente (1.1 a 4.8) o temporal (5.1 a 8.5), con la pestaña de arriba.',
      },
      {
        titulo: 'Toma una condición del catálogo',
        detalle:
          'Funciona como un pincel: eliges por ejemplo «Caries» y queda activa. El color de cada condición es el que verás marcado en el esquema.',
      },
      {
        titulo: 'Marca las caras afectadas',
        detalle:
          'Con la condición activa vas tocando las caras en todas las piezas que haga falta. Mesial siempre mira hacia la línea media, así que lo que marcas queda del lado correcto de la boca.',
      },
      {
        titulo: 'Confirma el lote',
        detalle:
          'Al terminar confirmas todo de una vez. No hay que abrir un formulario por diente, que en una revisión completa sería inviable.',
      },
      {
        titulo: 'Convierte lo pendiente en presupuesto',
        detalle:
          'Los procedimientos marcados como pendientes se convierten en presupuesto con un botón, con la pieza dental anotada en cada línea.',
      },
    ],
    consejos: [
      'Los registros no se borran al corregirlos: se anulan, y el historial queda completo debajo del esquema con fecha, profesional y observaciones.',
    ],
    problemas: [
      {
        problema: 'Un procedimiento dice «sin servicio asociado» y no puedo presupuestarlo.',
        solucion:
          'Falta enlazar esa condición con un servicio del tarifario, en Configuración → Condiciones dentales. Hasta entonces se registra igual en la ficha, pero no se puede cobrar.',
      },
      {
        problema: 'No veo la pestaña Odontograma.',
        solucion:
          'Tu rol necesita el permiso «ver» en el módulo Odontograma. Un administrador lo activa en Roles y permisos.',
      },
    ],
    relacionados: ['pacientes', 'periodontograma', 'presupuestos', 'configuracion'],
  },
  {
    slug: 'periodontograma',
    titulo: 'Periodontograma',
    area: 'Ficha dental',
    resumen: 'Examen periodontal completo, con seis sitios por pieza y cálculo automático del NIC.',
    paraQuien: 'Odontólogos y periodoncistas.',
    sinonimos: ['periodoncia', 'sondaje', 'bolsa', 'encía', 'nic', 'sangrado'],
    pasos: [
      {
        titulo: 'Crea un examen nuevo',
        detalle:
          'Desde la pestaña «Periodontograma» del paciente. Nace con todas las piezas en cero para que sólo corrijas lo que difiere, en vez de llenar una planilla vacía.',
      },
      {
        titulo: 'Registra sitio por sitio',
        detalle:
          'Seis por pieza: mesial, central y distal, por vestibular y por palatino o lingual. De cada uno se anota profundidad de sondaje, margen gingival, placa, sangrado y supuración.',
      },
      {
        titulo: 'Completa lo de la pieza entera',
        detalle: 'Movilidad, compromiso de furca, y si está ausente o es un implante.',
      },
      {
        titulo: 'Lee el gráfico y los índices',
        detalle:
          'La línea roja es el margen gingival y la azul el fondo de la bolsa; el área entre ambas se lee de un vistazo. Arriba tienes porcentaje de sangrado, índice de placa, profundidad media y sitios por severidad.',
      },
      {
        titulo: 'Guarda al terminar',
        detalle:
          'El examen se guarda completo de una vez. Son casi doscientos valores: si se guardaran uno a uno, un corte de conexión dejaría exámenes a medias.',
      },
    ],
    consejos: [
      'El nivel de inserción clínica no se pide: se calcula solo como profundidad menos margen. Es una resta que se hace mal a mano y de la que depende el diagnóstico.',
      'Al ser fechados, los exámenes sucesivos permiten comparar la evolución del paciente.',
    ],
    relacionados: ['pacientes', 'odontograma'],
  },
  {
    slug: 'interconsultas',
    titulo: 'Interconsultas',
    area: 'Operación diaria',
    resumen: 'Derivar un paciente a otro profesional del centro y seguir el caso.',
    paraQuien: 'Profesionales; recepción agenda la hora resultante.',
    ruta: '/interconsultas',
    sinonimos: ['derivar', 'derivación', 'especialista'],
    pasos: [
      {
        titulo: 'Crea la derivación',
        detalle: 'Elige paciente, profesional de destino, y escribe motivo, resumen clínico y prioridad.',
      },
      {
        titulo: 'El destinatario responde',
        detalle: 'La acepta, la rechaza o la marca como completada. Queda registrado quién y cuándo.',
      },
      {
        titulo: 'Agenda desde la propia interconsulta',
        detalle:
          'Recepción reserva la hora directamente desde ahí: la cita queda enlazada y marcada con canal «derivación», de modo que después se puede medir cuántas derivaciones terminan en atención.',
      },
    ],
    relacionados: ['agenda', 'pacientes'],
  },
  {
    slug: 'recetas',
    titulo: 'Recetas',
    area: 'Operación diaria',
    resumen: 'Emitir recetas con los datos del profesional y las alergias del paciente a la vista.',
    paraQuien: 'Profesionales.',
    ruta: '/recetas',
    sinonimos: ['medicamento', 'prescripción', 'receta médica'],
    pasos: [
      {
        titulo: 'Elige paciente y profesional',
        detalle: 'Si la receta nace de una atención, queda enlazada a ella.',
      },
      {
        titulo: 'Agrega los medicamentos',
        detalle: 'Cada uno con dosis, vía, frecuencia, duración e indicaciones.',
      },
      {
        titulo: 'Revisa el aviso de alergias',
        detalle: 'Las alergias del paciente aparecen destacadas en rojo antes de emitir, y también en el impreso.',
      },
      {
        titulo: 'Imprime o guarda como PDF',
        detalle:
          'Sale con los datos del profesional, su registro de la Superintendencia de Salud y los datos de la clínica.',
      },
    ],
    problemas: [
      {
        problema: 'La receta sale sin el registro del profesional.',
        solucion: 'Falta cargarlo en su ficha, en Profesionales → registro Superintendencia.',
      },
    ],
    relacionados: ['pacientes', 'profesionales'],
  },

  // ── Comercial ─────────────────────────────────────────────
  {
    slug: 'presupuestos',
    titulo: 'Presupuestos',
    area: 'Comercial',
    resumen: 'Cotizar un tratamiento y convertirlo en venta cuando el paciente acepta.',
    paraQuien: 'Recepción y profesionales.',
    ruta: '/presupuestos',
    sinonimos: ['cotización', 'presupuestar', 'tratamiento'],
    pasos: [
      {
        titulo: 'Arma las líneas',
        detalle:
          'Servicios e insumos, con cantidad, precio unitario, descuento por línea y pieza dental cuando corresponde. También puedes aplicar un descuento global.',
      },
      {
        titulo: 'Deja que aplique el convenio',
        detalle:
          'Si el paciente tiene convenio, al guardar se aplican las tarifas negociadas y se calcula qué parte cubre la aseguradora.',
      },
      {
        titulo: 'Envíalo y sigue su estado',
        detalle: 'Borrador → enviado → aceptado, rechazado o vencido → facturado.',
      },
      {
        titulo: 'Conviértelo en venta',
        detalle: 'Un presupuesto aceptado pasa a venta con un clic, arrastrando todas sus líneas.',
      },
    ],
    consejos: [
      'Desde el odontograma puedes generar el presupuesto directamente a partir de los procedimientos pendientes.',
      'El documento está pensado para imprimirse o guardarse como PDF con Ctrl/Cmd + P.',
    ],
    relacionados: ['ventas', 'convenios', 'odontograma'],
  },
  {
    slug: 'ventas',
    titulo: 'Ventas',
    area: 'Comercial',
    resumen: 'Registrar lo realizado, con quién lo ejecutó, que es la base de los honorarios.',
    paraQuien: 'Recepción y administración.',
    ruta: '/ventas',
    sinonimos: ['boleta', 'facturar', 'cobrar', 'iva'],
    pasos: [
      {
        titulo: 'Crea la venta',
        detalle: 'Desde cero o convirtiendo un presupuesto aceptado.',
      },
      {
        titulo: 'Indica quién ejecutó cada línea',
        detalle:
          'Es obligatorio y no es un detalle administrativo: de ahí sale el cálculo de honorarios de cada profesional.',
      },
      {
        titulo: 'Revisa los totales',
        detalle:
          'Los precios se manejan con IVA incluido, como es habitual en Chile, y el neto se obtiene desglosando hacia atrás. Las líneas exentas se tratan aparte.',
      },
      {
        titulo: 'Registra el pago',
        detalle: 'Desde la venta o desde el módulo de Pagos. Lo que quede impago se refleja en la cuenta del paciente.',
      },
    ],
    consejos: [
      'Los totales se recalculan siempre en el servidor: lo que ves mientras editas es una previsualización.',
      'Para anular una venta se genera un contra-asiento y se recalcula la cartola. No se borran registros, porque la trazabilidad clínica y contable lo impide.',
    ],
    relacionados: ['pagos', 'presupuestos', 'liquidaciones'],
  },
  {
    slug: 'pagos',
    titulo: 'Pagos y cuenta corriente',
    area: 'Comercial',
    resumen: 'Cobrar por distintos medios y llevar el saldo de cada paciente.',
    paraQuien: 'Recepción y administración.',
    ruta: '/pagos',
    sinonimos: ['abono', 'saldo', 'deuda', 'transferencia', 'comprobante', 'cartola'],
    pasos: [
      {
        titulo: 'Registra el pago',
        detalle: 'Elige la venta o el paciente, el monto y la forma de pago.',
      },
      {
        titulo: 'Adjunta el comprobante si se exige',
        detalle:
          'Cada forma de pago se configura para pedir comprobante (transferencias, bonos Isapre) o número de operación (tarjetas, cheques).',
      },
      {
        titulo: 'Consulta la cuenta del paciente',
        detalle:
          'En su ficha, pestaña «Cuenta corriente». Cada venta genera un cargo y cada pago un abono, y cada movimiento guarda el saldo acumulado.',
      },
    ],
    consejos: [
      'Saldo positivo significa que el paciente debe; negativo, que tiene saldo a favor.',
      'Las formas de pago se dan de alta en Configuración, incluyendo el costo de transacción del medio.',
    ],
    relacionados: ['ventas', 'configuracion'],
  },
  {
    slug: 'crm',
    titulo: 'CRM y seguimiento',
    area: 'Comercial',
    resumen: 'Seguir a quien todavía no es paciente, o dejó de venir.',
    paraQuien: 'Recepción y quien haga labor comercial.',
    ruta: '/crm',
    sinonimos: ['interesado', 'contacto', 'embudo', 'captación', 'recuperar'],
    pasos: [
      {
        titulo: 'Registra el contacto',
        detalle:
          'Con su origen (Instagram, recomendación, campaña, sitio web, llamada) y el servicio que le interesa. Un interesado no ensucia el registro clínico ni cuenta como paciente.',
      },
      {
        titulo: 'Anota cada interacción',
        detalle:
          'Llamadas, mensajes y correos con su fecha y resultado, para que cualquiera pueda retomar la conversación sabiendo qué se habló.',
      },
      {
        titulo: 'Programa el seguimiento',
        detalle: 'Con fecha comprometida. Aparece como pendiente cuando vence.',
      },
      {
        titulo: 'Conviértelo en paciente',
        detalle:
          'Se crea la ficha arrastrando los datos ya capturados, y el contacto queda enlazado para saber de dónde vino cada paciente nuevo.',
      },
    ],
    relacionados: ['pacientes', 'reportes'],
  },
  {
    slug: 'convenios',
    titulo: 'Convenios',
    area: 'Comercial',
    resumen: 'Isapres, seguros complementarios, empresas y mutuales con tarifas negociadas.',
    paraQuien: 'Administración.',
    ruta: '/convenios',
    sinonimos: ['isapre', 'seguro', 'cobertura', 'copago', 'empresa'],
    pasos: [
      {
        titulo: 'Crea el convenio',
        detalle: 'Con su descuento general, porcentaje de cobertura y, si lo hay, tope por prestación.',
      },
      {
        titulo: 'Carga las tarifas negociadas',
        detalle: 'Servicio por servicio, con su código de prestación.',
      },
      {
        titulo: 'Asígnalo al paciente',
        detalle: 'En su ficha. Desde ahí, cada venta calcula sola qué asume la aseguradora y cuánto es copago.',
      },
    ],
    consejos: [
      'La prioridad de precios es: tarifa del servicio en el convenio → descuento general del convenio → precio de lista.',
    ],
    relacionados: ['informes_beneficio', 'ventas', 'servicios'],
  },
  {
    slug: 'informes_beneficio',
    titulo: 'Informes de beneficio',
    area: 'Comercial',
    resumen: 'Certificado para que el paciente cobre su reembolso en la Isapre o el seguro.',
    paraQuien: 'Recepción y administración.',
    ruta: '/informes',
    sinonimos: ['reembolso', 'certificado', 'isapre', 'seguro complementario'],
    pasos: [
      { titulo: 'Elige paciente y período', detalle: 'El informe reúne lo atendido en ese rango de fechas.' },
      {
        titulo: 'Revisa lo que incluye',
        detalle:
          'Sólo entran las prestaciones efectivamente pagadas, con fecha, código de prestación, profesional, valor, cobertura y copago.',
      },
      { titulo: 'Imprime o guarda como PDF', detalle: 'Es lo que el paciente presenta a su aseguradora.' },
    ],
    problemas: [
      {
        problema: 'Falta una prestación en el informe.',
        solucion: 'Sólo se incluyen las canceladas. Si la venta tiene saldo pendiente, no aparece hasta que se pague.',
      },
    ],
    relacionados: ['convenios', 'pagos'],
  },

  // ── Operaciones ───────────────────────────────────────────
  {
    slug: 'inventario',
    titulo: 'Inventario',
    area: 'Operaciones',
    resumen: 'Insumos clínicos, con descuento automático al atender y aviso de stock bajo.',
    paraQuien: 'Asistentes clínicos y administración.',
    ruta: '/inventario',
    sinonimos: ['stock', 'insumo', 'productos', 'bodega', 'compra'],
    pasos: [
      {
        titulo: 'Da de alta los productos',
        detalle: 'Con unidad de medida, stock mínimo y costo. El mínimo es lo que dispara el aviso.',
      },
      {
        titulo: 'Enlaza los insumos a cada servicio',
        detalle:
          'En Servicios se declara qué consume cada prestación. Eso es lo que permite que el descuento sea automático.',
      },
      {
        titulo: 'Registra entradas y salidas',
        detalle: 'Compras, ajustes por inventario físico y mermas. Cada movimiento queda con su motivo.',
      },
      {
        titulo: 'Deja que se descuente solo',
        detalle: 'Al cerrar una atención con servicio, los insumos configurados salen del stock sin que nadie los anote.',
      },
      {
        titulo: 'Carga muchos productos de una vez',
        detalle:
          'En «Carga masiva» descargas la plantilla, la llenas y la subes. Antes de aplicar nada verás qué se va a crear, qué se va a actualizar y qué filas tienen error. El SKU es la llave.',
      },
      {
        titulo: 'Cuenta la bodega de verdad',
        detalle:
          'En «Conteos» abres un recuento, opcionalmente acotado a una categoría o ubicación. Puedes contar en pantalla o descargar la planilla, anotar en la bodega y subirla después.',
      },
      {
        titulo: 'Cierra el conteo para ajustar',
        detalle:
          'Al cerrarlo, el sistema iguala el stock a lo contado y deja un movimiento de ajuste por cada diferencia. Cerrar exige el permiso «aprobar», que puede tenerlo otra persona distinta de quien contó.',
      },
    ],
    consejos: [
      'La existencia del sistema va oculta mientras cuentas: ver la cifra esperada empuja a confirmarla en vez de contar. Se puede revelar con un botón para revisar antes de cerrar.',
      'El stock teórico se congela al abrir el conteo, así que lo que se consuma en atenciones mientras cuentas no aparece como diferencia de bodega.',
      'Una carga masiva nunca reescribe el stock de un producto que ya existe: las existencias se corrigen con un conteo, que deja registro de la diferencia.',
    ],
    problemas: [
      {
        problema: 'La planilla me dice que faltan columnas obligatorias.',
        solucion:
          'Se cambió el nombre de algún encabezado. Descarga la plantilla de nuevo y copia tus datos dentro; los encabezados se comparan sin tildes ni mayúsculas, pero el texto debe coincidir.',
      },
      {
        problema: 'Mi archivo es .xls y no lo acepta.',
        solucion: 'Ábrelo en Excel y guárdalo como .xlsx o .csv. El formato .xls antiguo no se lee.',
      },
      {
        problema: 'No puedo cerrar un conteo.',
        solucion:
          'Cerrar aplica ajustes de stock y exige el permiso «aprobar» del módulo Inventario. Un administrador puede activarlo en Roles y permisos.',
      },
    ],
    relacionados: ['servicios', 'gastos', 'proveedores'],
  },
  {
    slug: 'gastos',
    titulo: 'Gastos',
    area: 'Operaciones',
    resumen: 'Egresos del centro con su documento tributario adjunto.',
    paraQuien: 'Administración.',
    ruta: '/gastos',
    sinonimos: ['egreso', 'compra', 'factura', 'proveedor'],
    pasos: [
      { titulo: 'Registra el gasto', detalle: 'Categoría, proveedor, fecha, monto y si es afecto o exento.' },
      { titulo: 'Adjunta el documento', detalle: 'Factura o boleta. Queda guardado y accesible desde el propio gasto.' },
      {
        titulo: 'Míralo en el dashboard',
        detalle: 'Los gastos afectos alimentan la estimación de IVA y el margen del período.',
      },
    ],
    relacionados: ['proveedores', 'dashboard', 'inventario'],
  },
  {
    slug: 'liquidaciones',
    titulo: 'Liquidaciones de profesionales',
    area: 'Operaciones',
    resumen: 'Calcular honorarios por porcentaje o monto fijo, descontando arriendo de box.',
    paraQuien: 'Administración.',
    ruta: '/liquidaciones',
    sinonimos: ['honorarios', 'pagar profesional', 'arriendo box', 'comisión'],
    pasos: [
      {
        titulo: 'Define la regla del profesional',
        detalle:
          'En su ficha: porcentaje sobre lo realizado o monto fijo por prestación. Un servicio puede tener su propia regla cuando difiere de la general.',
      },
      {
        titulo: 'Genera la liquidación del período',
        detalle:
          'El sistema reúne todas las líneas de venta ejecutadas por ese profesional. Por eso importa indicar siempre quién ejecutó cada prestación.',
      },
      {
        titulo: 'Aplica los descuentos',
        detalle: 'Arriendo de box y otros descuentos acordados.',
      },
      { titulo: 'Revisa y cierra', detalle: 'Queda el detalle prestación por prestación, imprimible para el profesional.' },
    ],
    problemas: [
      {
        problema: 'A un profesional le sale menos de lo esperado.',
        solucion:
          'Revisa que todas las líneas de venta tengan indicado quién ejecutó. Una línea sin ejecutante no entra en ninguna liquidación.',
      },
    ],
    relacionados: ['ventas', 'profesionales', 'boxes'],
  },
  {
    slug: 'reportes',
    titulo: 'Reportes',
    area: 'Operaciones',
    resumen: 'Servicios más vendidos, ticket promedio, ranking de profesionales y captación.',
    paraQuien: 'Administración y jefatura.',
    ruta: '/reportes',
    sinonimos: ['estadística', 'ranking', 'ticket promedio', 'captación'],
    pasos: [
      { titulo: 'Elige el período', detalle: 'Todos los reportes se calculan sobre el rango que definas.' },
      {
        titulo: 'Cruza los que te interesen',
        detalle:
          'Top de servicios, ticket promedio, rendimiento por profesional, ocupación de boxes y de dónde vienen los pacientes.',
      },
    ],
    relacionados: ['dashboard', 'crm'],
  },

  // ── Maestros ──────────────────────────────────────────────
  {
    slug: 'profesionales',
    titulo: 'Profesionales',
    area: 'Maestros',
    resumen: 'Fichas del equipo clínico, su horario y su regla de honorarios.',
    paraQuien: 'Administración.',
    ruta: '/profesionales',
    sinonimos: ['médico', 'odontólogo', 'doctor', 'horario', 'disponibilidad'],
    pasos: [
      {
        titulo: 'Crea la ficha',
        detalle: 'Especialidad, RUT, registro de la Superintendencia de Salud y firma para las recetas.',
      },
      {
        titulo: 'Carga su disponibilidad',
        detalle:
          'Bloques recurrentes por día de la semana, con duración del cupo y box preferente. Sin esto la agenda no ofrece horas.',
      },
      {
        titulo: 'Define su regla de honorarios',
        detalle: 'Porcentaje o monto fijo por prestación, y el arriendo de box si se le cobra.',
      },
      {
        titulo: 'Vincúlalo con un usuario',
        detalle: 'Así el profesional entra con su cuenta y ve su propia agenda y sus pacientes.',
      },
    ],
    relacionados: ['agenda', 'liquidaciones', 'usuarios'],
  },
  {
    slug: 'servicios',
    titulo: 'Servicios',
    area: 'Maestros',
    resumen: 'El tarifario: qué se ofrece, cuánto dura, cuánto cuesta y qué consume.',
    paraQuien: 'Administración.',
    ruta: '/servicios',
    sinonimos: ['tarifario', 'precio', 'prestación', 'arancel'],
    pasos: [
      {
        titulo: 'Crea el servicio',
        detalle: 'Código, nombre, categoría, duración en minutos y precio con IVA incluido.',
      },
      {
        titulo: 'Marca las excepciones',
        detalle: 'Si es exento de IVA y si requiere sala de rayos X. Lo segundo hace que la agenda reserve el box adecuado.',
      },
      {
        titulo: 'Declara los insumos que consume',
        detalle: 'Es lo que permite que el inventario se descuente solo al cerrar la atención.',
      },
    ],
    consejos: [
      'La duración es lo que usa la agenda para calcular el bloque. Si una prestación se está agendando corta o larga, el ajuste va aquí.',
    ],
    relacionados: ['agenda', 'inventario', 'presupuestos', 'convenios'],
  },
  {
    slug: 'boxes',
    titulo: 'Boxes y salas',
    area: 'Maestros',
    resumen: 'Las salas de atención, su equipamiento y su arriendo.',
    paraQuien: 'Administración.',
    ruta: '/boxes',
    sinonimos: ['sala', 'sillón', 'rayos x', 'arriendo'],
    pasos: [
      { titulo: 'Da de alta cada box', detalle: 'Con su tipo y si tiene equipo de rayos X.' },
      { titulo: 'Define el arriendo', detalle: 'Si se le cobra al profesional, se descuenta en su liquidación.' },
    ],
    relacionados: ['agenda', 'liquidaciones'],
  },
  {
    slug: 'proveedores',
    titulo: 'Proveedores',
    area: 'Maestros',
    resumen: 'A quién se le compra, para gastos e inventario.',
    paraQuien: 'Administración.',
    ruta: '/proveedores',
    sinonimos: ['compra', 'insumo', 'distribuidor'],
    pasos: [{ titulo: 'Crea el proveedor', detalle: 'Razón social, RUT, contacto y condiciones de pago.' }],
    relacionados: ['gastos', 'inventario'],
  },

  // ── Administración ────────────────────────────────────────
  {
    slug: 'usuarios',
    titulo: 'Usuarios',
    area: 'Administración',
    resumen: 'Cuentas de acceso, su perfil de permisos y la vista previa como otro usuario.',
    paraQuien: 'Administradores.',
    ruta: '/usuarios',
    sinonimos: ['cuenta', 'acceso', 'contraseña', 'ver como', 'suplantar'],
    pasos: [
      {
        titulo: 'Crea la cuenta',
        detalle:
          'Nombre, correo, rol y contraseña inicial. El usuario deberá cambiarla. Si es un profesional, vincúlalo con su ficha clínica.',
      },
      {
        titulo: 'Comprueba qué ve con «Ver como»',
        detalle:
          'En cada fila hay un botón que te muestra la plataforma con los permisos de esa cuenta. Una banda abajo te recuerda de quién es la vista y te deja salir.',
      },
      {
        titulo: 'Desactiva en vez de eliminar',
        detalle:
          'Desactivar cierra sus sesiones y le impide entrar, pero conserva su rastro en la auditoría y en las fichas que firmó.',
      },
    ],
    consejos: [
      'La vista previa es de sólo lectura: escribir en nombre de otro rompería la autoría de la ficha clínica. Sirve para verificar permisos, no para trabajar.',
      'La vista previa caduca sola a la hora y se descarta al cerrar sesión.',
    ],
    relacionados: ['roles', 'profesionales'],
  },
  {
    slug: 'roles',
    titulo: 'Roles y permisos',
    area: 'Administración',
    resumen: 'Qué puede hacer cada perfil, casilla por casilla, sin tocar el código.',
    paraQuien: 'Administradores.',
    ruta: '/roles',
    sinonimos: ['permiso', 'perfil', 'matriz', 'acceso'],
    pasos: [
      {
        titulo: 'Parte de un rol existente',
        detalle:
          'Vienen cargados Administrador, Profesional, Secretaría y Asistente clínico. Puedes crear uno nuevo copiando los permisos de otro.',
      },
      {
        titulo: 'Ajusta la matriz',
        detalle:
          'Una casilla por módulo y acción: ver, crear, editar, eliminar, exportar, aprobar, anular y «ver como». Los cambios se aplican de inmediato.',
      },
      {
        titulo: 'Verifícalo con «Ver como»',
        detalle: 'Desde Usuarios, entra a la vista previa de alguien con ese rol y comprueba que ve lo que corresponde.',
      },
    ],
    consejos: [
      'Los cuatro roles base no se pueden eliminar, pero sí modificar y desactivar.',
      'Los permisos son datos, no código: nunca hace falta un despliegue para cambiarlos.',
    ],
    relacionados: ['usuarios'],
  },
  {
    slug: 'configuracion',
    titulo: 'Configuración',
    area: 'Administración',
    resumen: 'Datos de la clínica y los mantenedores que cambian con el tiempo.',
    paraQuien: 'Administradores.',
    ruta: '/configuracion',
    sinonimos: ['previsión', 'forma de pago', 'condiciones dentales', 'logo', 'clínica'],
    pasos: [
      {
        titulo: 'Completa los datos de la clínica',
        detalle: 'Razón social, RUT, dirección, teléfono y logo. Es lo que sale impreso en recetas, presupuestos e informes.',
      },
      {
        titulo: 'Revisa los mantenedores',
        detalle:
          'Previsiones (Fonasa y sus tramos, Isapres, particular), formas de pago, condiciones dentales y categorías de gasto.',
      },
      {
        titulo: 'Enlaza las condiciones dentales con servicios',
        detalle:
          'Es el paso que suele quedar pendiente. Sin enlace, el odontograma registra pero no puede generar presupuestos.',
      },
    ],
    relacionados: ['odontograma', 'pagos', 'pacientes'],
  },
];

export function guiaDe(slug: string): Guia | undefined {
  return GUIAS.find((g) => g.slug === slug);
}

/** Áreas en el orden en que conviene presentarlas. */
export const AREAS = [
  'Operación diaria',
  'Ficha dental',
  'Comercial',
  'Operaciones',
  'Maestros',
  'Administración',
] as const;

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Busca por título, resumen, sinónimos y el texto de los pasos, ignorando
 * tildes y aceptando varias palabras sueltas en cualquier orden.
 */
export function buscarGuias(consulta: string, guias: Guia[] = GUIAS): Guia[] {
  const terminos = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return guias;

  return guias.filter((g) => {
    const heno = normalizar(
      [
        g.titulo,
        g.area,
        g.resumen,
        g.paraQuien,
        ...(g.sinonimos ?? []),
        ...g.pasos.flatMap((p) => [p.titulo, p.detalle]),
        ...(g.problemas ?? []).flatMap((p) => [p.problema, p.solucion]),
      ].join(' '),
    );
    return terminos.every((t) => heno.includes(t));
  });
}
