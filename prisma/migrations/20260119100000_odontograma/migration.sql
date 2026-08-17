-- CreateEnum
CREATE TYPE "TipoDenticion" AS ENUM ('PERMANENTE', 'TEMPORAL');

-- CreateEnum
CREATE TYPE "CaraDental" AS ENUM ('VESTIBULAR', 'PALATINO_LINGUAL', 'MESIAL', 'DISTAL', 'OCLUSAL_INCISAL', 'CERVICAL', 'RAIZ', 'PIEZA_COMPLETA');

-- CreateEnum
CREATE TYPE "CategoriaCondicion" AS ENUM ('DIAGNOSTICO', 'PROCEDIMIENTO');

-- CreateEnum
CREATE TYPE "EstadoRegistroDental" AS ENUM ('PENDIENTE', 'REALIZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "CaraPeriodontal" AS ENUM ('VESTIBULAR', 'PALATINO_LINGUAL');

-- CreateEnum
CREATE TYPE "SitioPeriodontal" AS ENUM ('MESIAL', 'CENTRAL', 'DISTAL');

-- CreateTable
CREATE TABLE "condiciones_dentales" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaCondicion" NOT NULL DEFAULT 'DIAGNOSTICO',
    "color" TEXT NOT NULL DEFAULT '#B94642',
    "porCara" BOOLEAN NOT NULL DEFAULT true,
    "servicioId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condiciones_dentales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_odontograma" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "atencionId" TEXT,
    "profesionalId" TEXT,
    "condicionId" TEXT NOT NULL,
    "denticion" "TipoDenticion" NOT NULL DEFAULT 'PERMANENTE',
    "pieza" TEXT NOT NULL,
    "caras" "CaraDental"[],
    "estado" "EstadoRegistroDental" NOT NULL DEFAULT 'REALIZADO',
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realizadoPorRegistroId" TEXT,
    "presupuestoItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_odontograma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodontogramas" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "atencionId" TEXT,
    "profesionalId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "denticion" "TipoDenticion" NOT NULL DEFAULT 'PERMANENTE',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodontogramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodontograma_piezas" (
    "id" TEXT NOT NULL,
    "periodontogramaId" TEXT NOT NULL,
    "pieza" TEXT NOT NULL,
    "ausente" BOOLEAN NOT NULL DEFAULT false,
    "movilidad" INTEGER,
    "furcaVestibular" INTEGER,
    "furcaPalatina" INTEGER,
    "implante" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,

    CONSTRAINT "periodontograma_piezas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodontograma_sitios" (
    "id" TEXT NOT NULL,
    "piezaId" TEXT NOT NULL,
    "cara" "CaraPeriodontal" NOT NULL,
    "posicion" "SitioPeriodontal" NOT NULL,
    "profundidad" INTEGER NOT NULL DEFAULT 0,
    "margen" INTEGER NOT NULL DEFAULT 0,
    "placa" BOOLEAN NOT NULL DEFAULT false,
    "sangrado" BOOLEAN NOT NULL DEFAULT false,
    "supuracion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "periodontograma_sitios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "condiciones_dentales_codigo_key" ON "condiciones_dentales"("codigo");

-- CreateIndex
CREATE INDEX "condiciones_dentales_categoria_orden_idx" ON "condiciones_dentales"("categoria", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "registros_odontograma_realizadoPorRegistroId_key" ON "registros_odontograma"("realizadoPorRegistroId");

-- CreateIndex
CREATE INDEX "registros_odontograma_pacienteId_pieza_idx" ON "registros_odontograma"("pacienteId", "pieza");

-- CreateIndex
CREATE INDEX "registros_odontograma_pacienteId_estado_idx" ON "registros_odontograma"("pacienteId", "estado");

-- CreateIndex
CREATE INDEX "periodontogramas_pacienteId_fecha_idx" ON "periodontogramas"("pacienteId", "fecha");

-- CreateIndex
CREATE INDEX "periodontograma_piezas_periodontogramaId_idx" ON "periodontograma_piezas"("periodontogramaId");

-- CreateIndex
CREATE UNIQUE INDEX "periodontograma_piezas_periodontogramaId_pieza_key" ON "periodontograma_piezas"("periodontogramaId", "pieza");

-- CreateIndex
CREATE INDEX "periodontograma_sitios_piezaId_idx" ON "periodontograma_sitios"("piezaId");

-- CreateIndex
CREATE UNIQUE INDEX "periodontograma_sitios_piezaId_cara_posicion_key" ON "periodontograma_sitios"("piezaId", "cara", "posicion");

-- AddForeignKey
ALTER TABLE "condiciones_dentales" ADD CONSTRAINT "condiciones_dentales_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_odontograma" ADD CONSTRAINT "registros_odontograma_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_odontograma" ADD CONSTRAINT "registros_odontograma_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "atenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_odontograma" ADD CONSTRAINT "registros_odontograma_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_odontograma" ADD CONSTRAINT "registros_odontograma_condicionId_fkey" FOREIGN KEY ("condicionId") REFERENCES "condiciones_dentales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_odontograma" ADD CONSTRAINT "registros_odontograma_realizadoPorRegistroId_fkey" FOREIGN KEY ("realizadoPorRegistroId") REFERENCES "registros_odontograma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontogramas" ADD CONSTRAINT "periodontogramas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontogramas" ADD CONSTRAINT "periodontogramas_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "atenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontogramas" ADD CONSTRAINT "periodontogramas_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontograma_piezas" ADD CONSTRAINT "periodontograma_piezas_periodontogramaId_fkey" FOREIGN KEY ("periodontogramaId") REFERENCES "periodontogramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontograma_sitios" ADD CONSTRAINT "periodontograma_sitios_piezaId_fkey" FOREIGN KEY ("piezaId") REFERENCES "periodontograma_piezas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

