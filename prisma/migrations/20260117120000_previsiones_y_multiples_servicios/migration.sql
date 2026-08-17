-- Previsión pasa de enum fijo a mantenedor editable, y una cita puede tener
-- varios servicios.
--
-- El orden importa: primero se crean las tablas nuevas y se traspasan los
-- datos, y sólo entonces se eliminan las columnas viejas. La migración
-- generada automáticamente hacía lo contrario y habría perdido información.

-- ═══════════════════════════════════════════════════════════════
--  1. Previsiones
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "previsiones" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPrevision" NOT NULL DEFAULT 'OTRO',
    "requiereDetalle" BOOLEAN NOT NULL DEFAULT false,
    "etiquetaDetalle" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "previsiones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "previsiones_codigo_key" ON "previsiones"("codigo");
CREATE INDEX "previsiones_activo_orden_idx" ON "previsiones"("activo", "orden");

-- Juego inicial. Los códigos FONASA, ISAPRE, PARTICULAR,
-- SEGURO_COMPLEMENTARIO y OTRO coinciden con los valores del enum anterior,
-- lo que permite traspasar los pacientes existentes con un simple JOIN.
INSERT INTO "previsiones" ("id", "codigo", "nombre", "tipo", "requiereDetalle", "etiquetaDetalle", "orden", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'PARTICULAR',            'Particular',                'PARTICULAR',            false, NULL,              1,  NOW()),
  (gen_random_uuid()::text, 'FONASA',                'Fonasa',                    'FONASA',                true,  'Tramo (A, B, C o D)', 2,  NOW()),
  (gen_random_uuid()::text, 'ISAPRE_BANMEDICA',      'Isapre Banmédica',          'ISAPRE',                true,  'Nº de plan',      10, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_COLMENA',        'Isapre Colmena',            'ISAPRE',                true,  'Nº de plan',      11, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_CONSALUD',       'Isapre Consalud',           'ISAPRE',                true,  'Nº de plan',      12, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_CRUZ_BLANCA',    'Isapre Cruz Blanca',        'ISAPRE',                true,  'Nº de plan',      13, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_NUEVA_MASVIDA',  'Isapre Nueva Masvida',      'ISAPRE',                true,  'Nº de plan',      14, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_VIDA_TRES',      'Isapre Vida Tres',          'ISAPRE',                true,  'Nº de plan',      15, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_ESENCIAL',       'Isapre Esencial',           'ISAPRE',                true,  'Nº de plan',      16, NOW()),
  (gen_random_uuid()::text, 'ISAPRE_FUNDACION',      'Isapre Fundación',          'ISAPRE',                true,  'Nº de plan',      17, NOW()),
  (gen_random_uuid()::text, 'ISAPRE',                'Isapre (sin especificar)',  'ISAPRE',                true,  'Nombre de la Isapre', 18, NOW()),
  (gen_random_uuid()::text, 'SEGURO_COMPLEMENTARIO', 'Seguro complementario',     'SEGURO_COMPLEMENTARIO', true,  'Compañía y póliza', 30, NOW()),
  (gen_random_uuid()::text, 'OTRO',                  'Otra previsión',            'OTRO',                  true,  'Detalle',         90, NOW());

ALTER TABLE "pacientes" ADD COLUMN "previsionId" TEXT;

-- Traspaso de los pacientes ya cargados.
UPDATE "pacientes" p
SET "previsionId" = pr."id"
FROM "previsiones" pr
WHERE pr."codigo" = p."prevision"::text;

-- Cualquier paciente sin correspondencia queda como particular.
UPDATE "pacientes"
SET "previsionId" = (SELECT "id" FROM "previsiones" WHERE "codigo" = 'PARTICULAR')
WHERE "previsionId" IS NULL;

ALTER TABLE "pacientes" DROP COLUMN "prevision";

ALTER TABLE "pacientes"
  ADD CONSTRAINT "pacientes_previsionId_fkey"
  FOREIGN KEY ("previsionId") REFERENCES "previsiones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
--  2. Varios servicios por cita
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE "cita_servicios" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cita_servicios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cita_servicios_citaId_idx" ON "cita_servicios"("citaId");
CREATE UNIQUE INDEX "cita_servicios_citaId_servicioId_key" ON "cita_servicios"("citaId", "servicioId");

-- Cada cita que ya tenía un servicio pasa a tener esa única línea.
INSERT INTO "cita_servicios" ("id", "citaId", "servicioId", "cantidad", "orden")
SELECT gen_random_uuid()::text, "id", "servicioId", 1, 0
FROM "citas"
WHERE "servicioId" IS NOT NULL;

ALTER TABLE "citas" DROP CONSTRAINT IF EXISTS "citas_servicioId_fkey";
ALTER TABLE "citas" DROP COLUMN "servicioId";

ALTER TABLE "cita_servicios"
  ADD CONSTRAINT "cita_servicios_citaId_fkey"
  FOREIGN KEY ("citaId") REFERENCES "citas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cita_servicios"
  ADD CONSTRAINT "cita_servicios_servicioId_fkey"
  FOREIGN KEY ("servicioId") REFERENCES "servicios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
