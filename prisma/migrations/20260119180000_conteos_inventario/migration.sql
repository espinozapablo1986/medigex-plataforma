-- Conteos fisicos de inventario.
--
-- Puramente aditiva: crea tablas nuevas y no toca nada existente. El stock
-- teorico se guarda por item porque se congela al abrir el conteo; comparar
-- contra el stock vivo daria diferencias falsas, ya que el consumo de las
-- atenciones sigue ocurriendo mientras se cuenta.

-- CreateEnum
CREATE TYPE "EstadoConteo" AS ENUM ('ABIERTO', 'CERRADO', 'ANULADO');
-- CreateTable
CREATE TABLE "conteos_inventario" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoConteo" NOT NULL DEFAULT 'ABIERTO',
    "ubicacion" TEXT,
    "categoriaId" TEXT,
    "observaciones" TEXT,
    "abiertoPorId" TEXT,
    "cerradoPorId" TEXT,
    "abiertoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoAt" TIMESTAMP(3),
    CONSTRAINT "conteos_inventario_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "conteo_inventario_items" (
    "id" TEXT NOT NULL,
    "conteoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "stockTeorico" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockContado" DOUBLE PRECISION,
    "observaciones" TEXT,
    "contadoAt" TIMESTAMP(3),
    CONSTRAINT "conteo_inventario_items_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "conteos_inventario_folio_key" ON "conteos_inventario"("folio");
-- CreateIndex
CREATE INDEX "conteos_inventario_estado_abiertoAt_idx" ON "conteos_inventario"("estado", "abiertoAt");
-- CreateIndex
CREATE INDEX "conteo_inventario_items_conteoId_idx" ON "conteo_inventario_items"("conteoId");
-- CreateIndex
CREATE UNIQUE INDEX "conteo_inventario_items_conteoId_productoId_key" ON "conteo_inventario_items"("conteoId", "productoId");
-- AddForeignKey
ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_abiertoPorId_fkey" FOREIGN KEY ("abiertoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "conteo_inventario_items" ADD CONSTRAINT "conteo_inventario_items_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "conteos_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "conteo_inventario_items" ADD CONSTRAINT "conteo_inventario_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
