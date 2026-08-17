'use server';

import { revalidatePath } from 'next/cache';
import type { EstadoGasto, Periodicidad, TipoDocumento, TipoGasto } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { tasaIva } from '@/lib/comercial';
import { guardarAdjunto } from '@/lib/uploads';
import {
  booleano,
  entero,
  fecha,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const TIPOS_GASTO: TipoGasto[] = [
  'OPERACIONAL',
  'ADMINISTRATIVO',
  'INSUMOS',
  'ARRIENDO',
  'SERVICIOS_BASICOS',
  'REMUNERACIONES',
  'MARKETING',
  'EQUIPAMIENTO',
  'MANTENCION',
  'IMPUESTOS',
  'HONORARIOS',
  'OTRO',
];

const DOCUMENTOS: TipoDocumento[] = ['NINGUNO', 'BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'NOTA_CREDITO'];
const PERIODICIDADES: Periodicidad[] = [
  'UNICA',
  'DIARIA',
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL',
  'BIMESTRAL',
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
];

/**
 * Calcula neto/IVA/total del gasto.
 *
 * El usuario ingresa el total del documento; si es factura afecta, el IVA se
 * desglosa hacia atrás. Se puede sobrescribir el IVA a mano para casos con
 * ítems exentos mezclados.
 */
async function montosGasto(fd: FormData) {
  const total = entero(fd, 'total');
  if (total <= 0) throw new Error('El total del gasto debe ser mayor que cero.');

  const ivaManual = texto(fd, 'iva');
  const tipoDocumento = texto(fd, 'tipoDocumento') as TipoDocumento;
  const recuperable = booleano(fd, 'ivaRecuperable');

  if (ivaManual !== '') {
    const iva = entero(fd, 'iva');
    if (iva > total) throw new Error('El IVA no puede ser mayor que el total.');
    return { neto: total - iva, iva, total };
  }

  // Sólo las facturas dan derecho a crédito fiscal.
  const daCredito = tipoDocumento === 'FACTURA' && recuperable;
  if (!daCredito) return { neto: total, iva: 0, total };

  const tasa = await tasaIva();
  const neto = Math.round(total / (1 + tasa));
  return { neto, iva: total - neto, total };
}

function datosGasto(fd: FormData) {
  const tipoDocumento = texto(fd, 'tipoDocumento') as TipoDocumento;
  const estado = texto(fd, 'estado') as EstadoGasto;
  const periodicidad = texto(fd, 'periodicidad') as Periodicidad;

  return {
    categoriaId: textoOpcional(fd, 'categoriaId'),
    proveedorId: textoOpcional(fd, 'proveedorId'),
    formaPagoId: textoOpcional(fd, 'formaPagoId'),
    fecha: fecha(fd, 'fecha') ?? new Date(),
    descripcion: requerido(fd, 'descripcion', 'Descripción'),
    tipoDocumento: DOCUMENTOS.includes(tipoDocumento) ? tipoDocumento : ('NINGUNO' as TipoDocumento),
    numeroDocumento: textoOpcional(fd, 'numeroDocumento'),
    ivaRecuperable: booleano(fd, 'ivaRecuperable'),
    estado: (['PENDIENTE', 'PAGADO', 'ANULADO'] as EstadoGasto[]).includes(estado) ? estado : ('PAGADO' as EstadoGasto),
    fechaPago: fecha(fd, 'fechaPago'),
    esRecurrente: booleano(fd, 'esRecurrente'),
    periodicidad: PERIODICIDADES.includes(periodicidad) ? periodicidad : ('UNICA' as Periodicidad),
    observaciones: textoOpcional(fd, 'observaciones'),
  };
}

export async function crearGasto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('gastos', 'crear');
    const montos = await montosGasto(fd);

    const gasto = await prisma.gasto.create({
      data: { ...datosGasto(fd), ...montos, registradoPorId: sesion.usuarioId },
    });

    const documento = fd.get('documento');
    if (documento instanceof File && documento.size > 0) {
      await guardarAdjunto({
        archivo: documento,
        categoria: 'DOCUMENTO_TRIBUTARIO',
        descripcion: `Respaldo del gasto Nº ${gasto.folio}`,
        subidoPorId: sesion.usuarioId,
        vinculo: { gastoId: gasto.id },
      });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'gastos',
      entidad: 'Gasto',
      entidadId: gasto.id,
      detalle: { folio: gasto.folio, total: montos.total },
    });

    revalidatePath('/gastos');
    return { ok: true as const, mensaje: `Gasto Nº ${gasto.folio} registrado.` };
  });
}

export async function editarGasto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('gastos', 'editar');
    const id = requerido(fd, 'id', 'Gasto');
    const montos = await montosGasto(fd);

    await prisma.gasto.update({ where: { id }, data: { ...datosGasto(fd), ...montos } });

    const documento = fd.get('documento');
    if (documento instanceof File && documento.size > 0) {
      await guardarAdjunto({
        archivo: documento,
        categoria: 'DOCUMENTO_TRIBUTARIO',
        subidoPorId: sesion.usuarioId,
        vinculo: { gastoId: id },
      });
    }

    await auditar({ usuarioId: sesion.usuarioId, accion: 'editar', modulo: 'gastos', entidad: 'Gasto', entidadId: id });

    revalidatePath('/gastos');
    return { ok: true as const, mensaje: 'Gasto actualizado.' };
  });
}

export async function marcarGastoPagado(fd: FormData): Promise<void> {
  await exigirPermiso('gastos', 'editar');
  const id = String(fd.get('id'));
  await prisma.gasto.update({ where: { id }, data: { estado: 'PAGADO', fechaPago: new Date() } });
  revalidatePath('/gastos');
}

export async function eliminarGasto(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('gastos', 'eliminar');
  const id = String(fd.get('id'));
  await prisma.gasto.delete({ where: { id } });
  await auditar({ usuarioId: sesion.usuarioId, accion: 'eliminar', modulo: 'gastos', entidad: 'Gasto', entidadId: id });
  revalidatePath('/gastos');
}

// ─────────────────────────────────────────────────────────────
//  Categorías de gasto
// ─────────────────────────────────────────────────────────────

export async function crearCategoriaGasto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('gastos', 'crear');
    const nombre = requerido(fd, 'nombre', 'Nombre');
    const tipo = texto(fd, 'tipo') as TipoGasto;

    if (await prisma.categoriaGasto.findUnique({ where: { nombre } })) {
      throw new Error('Ya existe una categoría de gasto con ese nombre.');
    }

    await prisma.categoriaGasto.create({
      data: {
        nombre,
        tipo: TIPOS_GASTO.includes(tipo) ? tipo : ('OTRO' as TipoGasto),
        deducible: booleano(fd, 'deducible'),
      },
    });

    revalidatePath('/gastos');
    return { ok: true as const, mensaje: 'Categoría creada.' };
  });
}

export async function eliminarCategoriaGasto(fd: FormData): Promise<void> {
  await exigirPermiso('gastos', 'eliminar');
  const id = String(fd.get('id'));
  await prisma.gasto.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
  await prisma.categoriaGasto.delete({ where: { id } });
  revalidatePath('/gastos');
}
