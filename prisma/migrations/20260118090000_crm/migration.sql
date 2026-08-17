-- CreateEnum
CREATE TYPE "OrigenContacto" AS ENUM ('RECOMENDACION', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE', 'SITIO_WEB', 'WHATSAPP', 'PASABA_POR_FUERA', 'CONVENIO_EMPRESA', 'DERIVACION', 'CAMPANA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoContacto" AS ENUM ('NUEVO', 'CONTACTADO', 'INTERESADO', 'AGENDADO', 'CONVERTIDO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "CanalInteraccion" AS ENUM ('LLAMADA', 'WHATSAPP', 'EMAIL', 'SMS', 'PRESENCIAL', 'INSTAGRAM', 'OTRO');

-- CreateEnum
CREATE TYPE "SentidoInteraccion" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "TipoSeguimiento" AS ENUM ('RECALL', 'CONTROL', 'PRESUPUESTO', 'COBRANZA', 'POST_ATENCION', 'PROSPECTO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoSeguimiento" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "contactos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "rut" TEXT,
    "origen" "OrigenContacto" NOT NULL DEFAULT 'OTRO',
    "estado" "EstadoContacto" NOT NULL DEFAULT 'NUEVO',
    "interes" TEXT,
    "observaciones" TEXT,
    "pacienteId" TEXT,
    "asignadoAId" TEXT,
    "motivoPerdida" TEXT,
    "convertidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacciones" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT,
    "pacienteId" TEXT,
    "canal" "CanalInteraccion" NOT NULL DEFAULT 'LLAMADA',
    "sentido" "SentidoInteraccion" NOT NULL DEFAULT 'SALIENTE',
    "asunto" TEXT NOT NULL,
    "detalle" TEXT,
    "resultado" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguimientos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoSeguimiento" NOT NULL DEFAULT 'OTRO',
    "estado" "EstadoSeguimiento" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "contactoId" TEXT,
    "pacienteId" TEXT,
    "presupuestoId" TEXT,
    "asignadoAId" TEXT,
    "resultado" TEXT,
    "completadoAt" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seguimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactos_estado_idx" ON "contactos"("estado");

-- CreateIndex
CREATE INDEX "contactos_createdAt_idx" ON "contactos"("createdAt");

-- CreateIndex
CREATE INDEX "interacciones_contactoId_idx" ON "interacciones"("contactoId");

-- CreateIndex
CREATE INDEX "interacciones_pacienteId_fecha_idx" ON "interacciones"("pacienteId", "fecha");

-- CreateIndex
CREATE INDEX "seguimientos_estado_fechaVencimiento_idx" ON "seguimientos"("estado", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "seguimientos_asignadoAId_estado_idx" ON "seguimientos"("asignadoAId", "estado");

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

