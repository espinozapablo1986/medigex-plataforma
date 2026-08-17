-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA');

-- CreateEnum
CREATE TYPE "TipoPrevision" AS ENUM ('FONASA', 'ISAPRE', 'PARTICULAR', 'SEGURO_COMPLEMENTARIO', 'OTRO');

-- CreateEnum
CREATE TYPE "ModeloPagoProfesional" AS ENUM ('COMISION', 'ARRIENDO', 'SUELDO', 'COMISION_Y_ARRIENDO');

-- CreateEnum
CREATE TYPE "TipoBox" AS ENUM ('BOX_DENTAL', 'BOX_MEDICO', 'SALA_RAYOS_X', 'SALA_PROCEDIMIENTOS', 'SALA_CIRUGIA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "TipoConvenio" AS ENUM ('ISAPRE', 'SEGURO_COMPLEMENTARIO', 'EMPRESA', 'MUTUAL', 'FONASA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoInformeBeneficio" AS ENUM ('EMITIDO', 'PRESENTADO', 'APROBADO', 'RECHAZADO', 'PAGADO');

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('BLOQUEO', 'VACACIONES', 'FERIADO', 'LICENCIA', 'DISPONIBILIDAD_EXTRA', 'MANTENCION');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('AGENDADA', 'CONFIRMADA', 'EN_SALA_ESPERA', 'EN_ATENCION', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA', 'REAGENDADA');

-- CreateEnum
CREATE TYPE "CanalAgendamiento" AS ENUM ('PRESENCIAL', 'TELEFONO', 'WHATSAPP', 'EMAIL', 'WEB', 'DERIVACION');

-- CreateEnum
CREATE TYPE "EstadoInterconsulta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'AGENDADA', 'COMPLETADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoExamen" AS ENUM ('RADIOGRAFIA', 'LABORATORIO', 'IMAGENOLOGIA', 'BIOPSIA', 'ELECTROCARDIOGRAMA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoExamen" AS ENUM ('SOLICITADO', 'TOMADO', 'CON_RESULTADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "CategoriaAdjunto" AS ENUM ('FOTOGRAFIA', 'RADIOGRAFIA', 'DOCUMENTO', 'EXAMEN', 'CONSENTIMIENTO', 'COMPROBANTE_PAGO', 'DOCUMENTO_TRIBUTARIO', 'PRESUPUESTO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoReceta" AS ENUM ('SIMPLE', 'RETENIDA', 'CHEQUE_MEDICO', 'MAGISTRAL');

-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'VENCIDO', 'FACTURADO');

-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('SERVICIO', 'PRODUCTO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('NINGUNO', 'BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'NOTA_CREDITO');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoFormaPago" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'CHEQUE', 'CONVENIO', 'ISAPRE', 'FONASA', 'GIFTCARD', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('CONFIRMADO', 'PENDIENTE', 'ANULADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoMovimientoCuenta" AS ENUM ('CARGO', 'ABONO', 'AJUSTE', 'NOTA_CREDITO');

-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('UNIDAD', 'CAJA', 'PAQUETE', 'ML', 'LITRO', 'GRAMO', 'KILO', 'METRO', 'PAR', 'SET');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA', 'DEVOLUCION', 'CONSUMO_SERVICIO', 'VENTA', 'INVENTARIO_INICIAL');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('OPERACIONAL', 'ADMINISTRATIVO', 'INSUMOS', 'ARRIENDO', 'SERVICIOS_BASICOS', 'REMUNERACIONES', 'MARKETING', 'EQUIPAMIENTO', 'MANTENCION', 'IMPUESTOS', 'HONORARIOS', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoGasto" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('UNICA', 'DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoItemLiquidacion" AS ENUM ('COMISION', 'ARRIENDO_BOX', 'DESCUENTO', 'BONO', 'AJUSTE');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esSistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "permitido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "rut" TEXT,
    "telefono" TEXT,
    "avatarRuta" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAccesoAt" TIMESTAMP(3),
    "rolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiraAt" TIMESTAMP(3) NOT NULL,
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "numeroFicha" SERIAL NOT NULL,
    "rut" TEXT,
    "pasaporte" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "edadRegistrada" INTEGER,
    "sexo" "Sexo" NOT NULL DEFAULT 'NO_ESPECIFICA',
    "telefonoPrincipal" TEXT NOT NULL,
    "telefonoSecundario" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "ciudad" TEXT,
    "ocupacion" TEXT,
    "prevision" "TipoPrevision" NOT NULL DEFAULT 'PARTICULAR',
    "previsionDetalle" TEXT,
    "convenioId" TEXT,
    "numeroAfiliado" TEXT,
    "vieneDeOtroCentro" BOOLEAN NOT NULL DEFAULT false,
    "centroOrigen" TEXT,
    "profesionalOrigen" TEXT,
    "motivoDerivacion" TEXT,
    "fechaDerivacion" TIMESTAMP(3),
    "alergias" TEXT,
    "antecedentesMedicos" TEXT,
    "medicamentosActuales" TEXT,
    "antecedentesQuirurgicos" TEXT,
    "observaciones" TEXT,
    "contactoEmergenciaNombre" TEXT,
    "contactoEmergenciaTelefono" TEXT,
    "contactoEmergenciaRelacion" TEXT,
    "comoNosConocio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profesionales" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "rut" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "especialidad" TEXT NOT NULL,
    "subespecialidad" TEXT,
    "registroSuperintendencia" TEXT,
    "colorAgenda" TEXT NOT NULL DEFAULT '#3384fb',
    "modeloPago" "ModeloPagoProfesional" NOT NULL DEFAULT 'COMISION',
    "comisionTipo" "TipoComision" NOT NULL DEFAULT 'PORCENTAJE',
    "comisionPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comisionMontoFijo" INTEGER NOT NULL DEFAULT 0,
    "sueldoBase" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profesionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boxes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoBox" NOT NULL DEFAULT 'BOX_MEDICO',
    "ubicacion" TEXT,
    "descripcion" TEXT,
    "equipamiento" TEXT,
    "valorArriendoHora" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_servicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT,
    "precio" INTEGER NOT NULL DEFAULT 0,
    "costoEstimado" INTEGER NOT NULL DEFAULT 0,
    "duracionMinutos" INTEGER NOT NULL DEFAULT 30,
    "requiereBox" BOOLEAN NOT NULL DEFAULT true,
    "tipoBoxRequerido" "TipoBox",
    "usaRayosX" BOOLEAN NOT NULL DEFAULT false,
    "afectoIva" BOOLEAN NOT NULL DEFAULT true,
    "comisionTipo" "TipoComision" NOT NULL DEFAULT 'PORCENTAJE',
    "comisionPorcentaje" DOUBLE PRECISION,
    "comisionMontoFijo" INTEGER NOT NULL DEFAULT 0,
    "requiereConsentimiento" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos_servicio" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "insumos_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones_servicio" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "tipo" "TipoComision" NOT NULL DEFAULT 'PORCENTAJE',
    "porcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoFijo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "comisiones_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenios" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoConvenio" NOT NULL DEFAULT 'ISAPRE',
    "rut" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coberturaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topePorPrestacion" INTEGER NOT NULL DEFAULT 0,
    "requiereAutorizacion" BOOLEAN NOT NULL DEFAULT false,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenio_servicios" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "precioConvenio" INTEGER NOT NULL DEFAULT 0,
    "coberturaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "codigoPrestacion" TEXT,

    CONSTRAINT "convenio_servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informes_beneficio" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "convenioId" TEXT,
    "profesionalId" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodoDesde" TIMESTAMP(3) NOT NULL,
    "periodoHasta" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoInformeBeneficio" NOT NULL DEFAULT 'EMITIDO',
    "diagnostico" TEXT,
    "cie10" TEXT,
    "totalPrestaciones" INTEGER NOT NULL DEFAULT 0,
    "totalCobertura" INTEGER NOT NULL DEFAULT 0,
    "totalPaciente" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "emitidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "informes_beneficio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informe_beneficio_items" (
    "id" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "ventaItemId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "codigoPrestacion" TEXT,
    "descripcion" TEXT NOT NULL,
    "profesional" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "montoTotal" INTEGER NOT NULL DEFAULT 0,
    "montoCobertura" INTEGER NOT NULL DEFAULT 0,
    "montoPaciente" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "informe_beneficio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidad" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "boxId" TEXT,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "duracionSlot" INTEGER NOT NULL DEFAULT 30,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excepciones_agenda" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT,
    "boxId" TEXT,
    "tipo" "TipoExcepcion" NOT NULL DEFAULT 'BLOQUEO',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "todoElDia" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excepciones_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "boxId" TEXT,
    "servicioId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'AGENDADA',
    "canal" "CanalAgendamiento" NOT NULL DEFAULT 'PRESENCIAL',
    "motivoConsulta" TEXT,
    "usaRayosX" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "motivoCancelacion" TEXT,
    "confirmadaAt" TIMESTAMP(3),
    "llegadaAt" TIMESTAMP(3),
    "atendidaAt" TIMESTAMP(3),
    "citaOrigenId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interconsultas" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profesionalOrigenId" TEXT NOT NULL,
    "profesionalDestinoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "resumenClinico" TEXT,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "estado" "EstadoInterconsulta" NOT NULL DEFAULT 'PENDIENTE',
    "citaId" TEXT,
    "respuesta" TEXT,
    "respondidaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interconsultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atenciones" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "citaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivoConsulta" TEXT NOT NULL,
    "anamnesis" TEXT,
    "examenFisico" TEXT,
    "diagnostico" TEXT,
    "cie10" TEXT,
    "tratamientoRealizado" TEXT,
    "indicaciones" TEXT,
    "observaciones" TEXT,
    "proximoControl" TIMESTAMP(3),
    "presionArterial" TEXT,
    "frecuenciaCardiaca" INTEGER,
    "temperatura" DOUBLE PRECISION,
    "pesoKg" DOUBLE PRECISION,
    "tallaCm" DOUBLE PRECISION,
    "saturacion" INTEGER,
    "odontograma" JSONB,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atenciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examenes" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "atencionId" TEXT,
    "solicitadoPorId" TEXT,
    "tipo" "TipoExamen" NOT NULL DEFAULT 'OTRO',
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoExamen" NOT NULL DEFAULT 'SOLICITADO',
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRealizacion" TIMESTAMP(3),
    "fechaResultado" TIMESTAMP(3),
    "resultado" TEXT,
    "interpretacion" TEXT,
    "laboratorio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaAdjunto" NOT NULL DEFAULT 'DOCUMENTO',
    "nombreArchivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "descripcion" TEXT,
    "pacienteId" TEXT,
    "atencionId" TEXT,
    "examenId" TEXT,
    "pagoId" TEXT,
    "gastoId" TEXT,
    "presupuestoId" TEXT,
    "subidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "atencionId" TEXT,
    "tipo" "TipoReceta" NOT NULL DEFAULT 'SIMPLE',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnostico" TEXT,
    "indicacionesGenerales" TEXT,
    "vigenteHasta" TIMESTAMP(3),
    "firmadaAt" TIMESTAMP(3),
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_items" (
    "id" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "medicamento" TEXT NOT NULL,
    "principioActivo" TEXT,
    "presentacion" TEXT,
    "dosis" TEXT,
    "via" TEXT,
    "frecuencia" TEXT,
    "duracion" TEXT,
    "cantidad" TEXT,
    "indicaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profesionalId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validoHasta" TIMESTAMP(3),
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'BORRADOR',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoMonto" INTEGER NOT NULL DEFAULT 0,
    "neto" INTEGER NOT NULL DEFAULT 0,
    "iva" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "aceptadoAt" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuesto_items" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "tipo" "TipoItem" NOT NULL DEFAULT 'SERVICIO',
    "servicioId" TEXT,
    "productoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "piezaDental" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioUnitario" INTEGER NOT NULL DEFAULT 0,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "afectoIva" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "presupuesto_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profesionalId" TEXT,
    "atencionId" TEXT,
    "presupuestoId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'BOLETA',
    "numeroDocumento" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "neto" INTEGER NOT NULL DEFAULT 0,
    "iva" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "pagado" INTEGER NOT NULL DEFAULT 0,
    "saldo" INTEGER NOT NULL DEFAULT 0,
    "convenioId" TEXT,
    "montoCobertura" INTEGER NOT NULL DEFAULT 0,
    "montoPaciente" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "anuladaMotivo" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "tipo" "TipoItem" NOT NULL DEFAULT 'SERVICIO',
    "servicioId" TEXT,
    "productoId" TEXT,
    "profesionalId" TEXT,
    "descripcion" TEXT NOT NULL,
    "piezaDental" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioUnitario" INTEGER NOT NULL DEFAULT 0,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "afectoIva" BOOLEAN NOT NULL DEFAULT true,
    "comisionTipo" "TipoComision" NOT NULL DEFAULT 'PORCENTAJE',
    "comisionPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comisionMonto" INTEGER NOT NULL DEFAULT 0,
    "liquidacionId" TEXT,
    "codigoPrestacion" TEXT,
    "montoCobertura" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formas_pago" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoFormaPago" NOT NULL DEFAULT 'EFECTIVO',
    "requiereComprobante" BOOLEAN NOT NULL DEFAULT false,
    "requiereReferencia" BOOLEAN NOT NULL DEFAULT false,
    "comisionPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cuentaContable" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "formas_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "ventaId" TEXT,
    "formaPagoId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoPago" NOT NULL DEFAULT 'CONFIRMADO',
    "referencia" TEXT,
    "banco" TEXT,
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "observaciones" TEXT,
    "anuladoMotivo" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_cuenta" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "tipo" "TipoMovimientoCuenta" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "saldoResultante" INTEGER NOT NULL,
    "ventaId" TEXT,
    "pagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "rut" TEXT,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "giro" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT,
    "proveedorId" TEXT,
    "unidadMedida" "UnidadMedida" NOT NULL DEFAULT 'UNIDAD',
    "stockActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMaximo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoPromedio" INTEGER NOT NULL DEFAULT 0,
    "precioVenta" INTEGER NOT NULL DEFAULT 0,
    "esVendible" BOOLEAN NOT NULL DEFAULT false,
    "esInsumo" BOOLEAN NOT NULL DEFAULT true,
    "afectoIva" BOOLEAN NOT NULL DEFAULT true,
    "controlaLote" BOOLEAN NOT NULL DEFAULT false,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" INTEGER NOT NULL DEFAULT 0,
    "stockAnterior" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockResultante" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "referenciaTipo" TEXT,
    "referenciaId" TEXT,
    "lote" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_gasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoGasto" NOT NULL DEFAULT 'OPERACIONAL',
    "deducible" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "categoriaId" TEXT,
    "proveedorId" TEXT,
    "formaPagoId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'NINGUNO',
    "numeroDocumento" TEXT,
    "neto" INTEGER NOT NULL DEFAULT 0,
    "iva" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "ivaRecuperable" BOOLEAN NOT NULL DEFAULT true,
    "estado" "EstadoGasto" NOT NULL DEFAULT 'PAGADO',
    "fechaPago" TIMESTAMP(3),
    "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'UNICA',
    "observaciones" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arriendos_box" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'MENSUAL',
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arriendos_box_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "periodoDesde" TIMESTAMP(3) NOT NULL,
    "periodoHasta" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'BORRADOR',
    "totalProducido" INTEGER NOT NULL DEFAULT 0,
    "totalComision" INTEGER NOT NULL DEFAULT 0,
    "totalArriendo" INTEGER NOT NULL DEFAULT 0,
    "totalOtrosDescuentos" INTEGER NOT NULL DEFAULT 0,
    "totalBonos" INTEGER NOT NULL DEFAULT 0,
    "totalAPagar" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "aprobadaAt" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "formaPagoId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_items" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "tipo" "TipoItemLiquidacion" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "referenciaId" TEXT,

    CONSTRAINT "liquidacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nombreClinica" TEXT NOT NULL DEFAULT 'Centro Clínico',
    "rut" TEXT,
    "giro" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "logoRuta" TEXT,
    "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Santiago',
    "horaApertura" TEXT NOT NULL DEFAULT '08:00',
    "horaCierre" TEXT NOT NULL DEFAULT '20:00',
    "diasHabiles" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "duracionSlotDefecto" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE INDEX "rol_permisos_rolId_idx" ON "rol_permisos"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "rol_permisos_rolId_modulo_accion_key" ON "rol_permisos"("rolId", "modulo", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_rut_key" ON "usuarios"("rut");

-- CreateIndex
CREATE INDEX "usuarios_rolId_idx" ON "usuarios"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_key" ON "sesiones"("token");

-- CreateIndex
CREATE INDEX "sesiones_usuarioId_idx" ON "sesiones"("usuarioId");

-- CreateIndex
CREATE INDEX "registro_auditoria_usuarioId_idx" ON "registro_auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "registro_auditoria_modulo_createdAt_idx" ON "registro_auditoria"("modulo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_numeroFicha_key" ON "pacientes"("numeroFicha");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_rut_key" ON "pacientes"("rut");

-- CreateIndex
CREATE INDEX "pacientes_rut_idx" ON "pacientes"("rut");

-- CreateIndex
CREATE INDEX "pacientes_apellidoPaterno_nombres_idx" ON "pacientes"("apellidoPaterno", "nombres");

-- CreateIndex
CREATE UNIQUE INDEX "profesionales_usuarioId_key" ON "profesionales"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "profesionales_rut_key" ON "profesionales"("rut");

-- CreateIndex
CREATE INDEX "profesionales_activo_idx" ON "profesionales"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "boxes_codigo_key" ON "boxes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_servicio_nombre_key" ON "categorias_servicio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_codigo_key" ON "servicios"("codigo");

-- CreateIndex
CREATE INDEX "servicios_categoriaId_idx" ON "servicios"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "insumos_servicio_servicioId_productoId_key" ON "insumos_servicio"("servicioId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "comisiones_servicio_profesionalId_servicioId_key" ON "comisiones_servicio"("profesionalId", "servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "convenios_codigo_key" ON "convenios"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "convenio_servicios_convenioId_servicioId_key" ON "convenio_servicios"("convenioId", "servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "informes_beneficio_folio_key" ON "informes_beneficio"("folio");

-- CreateIndex
CREATE INDEX "informes_beneficio_pacienteId_idx" ON "informes_beneficio"("pacienteId");

-- CreateIndex
CREATE INDEX "disponibilidad_profesionalId_diaSemana_idx" ON "disponibilidad"("profesionalId", "diaSemana");

-- CreateIndex
CREATE INDEX "excepciones_agenda_fechaInicio_fechaFin_idx" ON "excepciones_agenda"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "citas_inicio_idx" ON "citas"("inicio");

-- CreateIndex
CREATE INDEX "citas_profesionalId_inicio_idx" ON "citas"("profesionalId", "inicio");

-- CreateIndex
CREATE INDEX "citas_boxId_inicio_idx" ON "citas"("boxId", "inicio");

-- CreateIndex
CREATE INDEX "citas_pacienteId_idx" ON "citas"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "interconsultas_citaId_key" ON "interconsultas"("citaId");

-- CreateIndex
CREATE INDEX "interconsultas_estado_idx" ON "interconsultas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "atenciones_citaId_key" ON "atenciones"("citaId");

-- CreateIndex
CREATE INDEX "atenciones_pacienteId_fecha_idx" ON "atenciones"("pacienteId", "fecha");

-- CreateIndex
CREATE INDEX "examenes_pacienteId_idx" ON "examenes"("pacienteId");

-- CreateIndex
CREATE INDEX "adjuntos_pacienteId_idx" ON "adjuntos"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "recetas_folio_key" ON "recetas"("folio");

-- CreateIndex
CREATE INDEX "recetas_pacienteId_idx" ON "recetas"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_folio_key" ON "presupuestos"("folio");

-- CreateIndex
CREATE INDEX "presupuestos_pacienteId_idx" ON "presupuestos"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_folio_key" ON "ventas"("folio");

-- CreateIndex
CREATE INDEX "ventas_fecha_idx" ON "ventas"("fecha");

-- CreateIndex
CREATE INDEX "ventas_pacienteId_idx" ON "ventas"("pacienteId");

-- CreateIndex
CREATE INDEX "venta_items_ventaId_idx" ON "venta_items"("ventaId");

-- CreateIndex
CREATE INDEX "venta_items_liquidacionId_idx" ON "venta_items"("liquidacionId");

-- CreateIndex
CREATE UNIQUE INDEX "formas_pago_nombre_key" ON "formas_pago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_folio_key" ON "pagos"("folio");

-- CreateIndex
CREATE INDEX "pagos_fecha_idx" ON "pagos"("fecha");

-- CreateIndex
CREATE INDEX "pagos_pacienteId_idx" ON "pagos"("pacienteId");

-- CreateIndex
CREATE INDEX "movimientos_cuenta_pacienteId_fecha_idx" ON "movimientos_cuenta"("pacienteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_producto_nombre_key" ON "categorias_producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_rut_key" ON "proveedores"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE INDEX "productos_categoriaId_idx" ON "productos"("categoriaId");

-- CreateIndex
CREATE INDEX "movimientos_stock_productoId_fecha_idx" ON "movimientos_stock"("productoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_gasto_nombre_key" ON "categorias_gasto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_folio_key" ON "gastos"("folio");

-- CreateIndex
CREATE INDEX "gastos_fecha_idx" ON "gastos"("fecha");

-- CreateIndex
CREATE INDEX "arriendos_box_profesionalId_idx" ON "arriendos_box"("profesionalId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_folio_key" ON "liquidaciones"("folio");

-- CreateIndex
CREATE INDEX "liquidaciones_profesionalId_periodoDesde_idx" ON "liquidaciones"("profesionalId", "periodoDesde");

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos_servicio" ADD CONSTRAINT "insumos_servicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos_servicio" ADD CONSTRAINT "insumos_servicio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones_servicio" ADD CONSTRAINT "comisiones_servicio_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones_servicio" ADD CONSTRAINT "comisiones_servicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_servicios" ADD CONSTRAINT "convenio_servicios_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_servicios" ADD CONSTRAINT "convenio_servicios_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes_beneficio" ADD CONSTRAINT "informes_beneficio_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes_beneficio" ADD CONSTRAINT "informes_beneficio_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes_beneficio" ADD CONSTRAINT "informes_beneficio_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes_beneficio" ADD CONSTRAINT "informes_beneficio_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_beneficio_items" ADD CONSTRAINT "informe_beneficio_items_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "informes_beneficio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_beneficio_items" ADD CONSTRAINT "informe_beneficio_items_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "venta_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepciones_agenda" ADD CONSTRAINT "excepciones_agenda_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepciones_agenda" ADD CONSTRAINT "excepciones_agenda_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_citaOrigenId_fkey" FOREIGN KEY ("citaOrigenId") REFERENCES "citas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_profesionalOrigenId_fkey" FOREIGN KEY ("profesionalOrigenId") REFERENCES "profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_profesionalDestinoId_fkey" FOREIGN KEY ("profesionalDestinoId") REFERENCES "profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "citas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones" ADD CONSTRAINT "atenciones_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones" ADD CONSTRAINT "atenciones_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones" ADD CONSTRAINT "atenciones_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "citas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones" ADD CONSTRAINT "atenciones_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examenes" ADD CONSTRAINT "examenes_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examenes" ADD CONSTRAINT "examenes_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "atenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examenes" ADD CONSTRAINT "examenes_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "atenciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "examenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "gastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "atenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_items" ADD CONSTRAINT "presupuesto_items_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_items" ADD CONSTRAINT "presupuesto_items_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_items" ADD CONSTRAINT "presupuesto_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "atenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_gasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arriendos_box" ADD CONSTRAINT "arriendos_box_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arriendos_box" ADD CONSTRAINT "arriendos_box_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

