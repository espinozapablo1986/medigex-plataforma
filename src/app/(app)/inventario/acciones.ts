'use server';

import { revalidatePath } from 'next/cache';
import type { TipoMovimientoStock, UnidadMedida } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { moverStock } from '@/lib/inventario';
import {
  booleano,
  decimal,
  entero,
  fecha,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const UNIDADES: UnidadMedida[] = ['UNIDAD', 'CAJA', 'PAQUETE', 'ML', 'LITRO', 'GRAMO', 'KILO', 'METRO', 'PAR', 'SET'];
const TIPOS_MOVIMIENTO: TipoMovimientoStock[] = [
  'ENTRADA',
  'SALIDA',
  'AJUSTE',
  'MERMA',
  'DEVOLUCION',
  'INVENTARIO_INICIAL',
];

function datosProducto(fd: FormData) {
  const unidad = texto(fd, 'unidadMedida') as UnidadMedida;
  return {
    sku: requerido(fd, 'sku', 'SKU').toUpperCase(),
    nombre: requerido(fd, 'nombre', 'Nombre'),
    descripcion: textoOpcional(fd, 'descripcion'),
    categoriaId: textoOpcional(fd, 'categoriaId'),
    proveedorId: textoOpcional(fd, 'proveedorId'),
    unidadMedida: UNIDADES.includes(unidad) ? unidad : ('UNIDAD' as UnidadMedida),
    stockMinimo: decimal(fd, 'stockMinimo'),
    stockMaximo: decimal(fd, 'stockMaximo'),
    precioVenta: entero(fd, 'precioVenta'),
    esVendible: booleano(fd, 'esVendible'),
    esInsumo: booleano(fd, 'esInsumo'),
    afectoIva: booleano(fd, 'afectoIva'),
    controlaLote: booleano(fd, 'controlaLote'),
    ubicacion: textoOpcional(fd, 'ubicacion'),
  };
}

export async function crearProducto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('inventario', 'crear');
    const datos = datosProducto(fd);

    if (await prisma.producto.findUnique({ where: { sku: datos.sku } })) {
      throw new Error(`Ya existe un producto con el SKU ${datos.sku}.`);
    }

    const stockInicial = decimal(fd, 'stockInicial');
    const costoInicial = entero(fd, 'costoPromedio');

    const producto = await prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({ data: { ...datos, costoPromedio: costoInicial } });

      if (stockInicial > 0) {
        await moverStock(tx, {
          productoId: creado.id,
          tipo: 'INVENTARIO_INICIAL',
          cantidad: stockInicial,
          costoUnitario: costoInicial,
          motivo: 'Carga inicial de inventario',
          usuarioId: sesion.usuarioId,
        });
      }
      return creado;
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'inventario',
      entidad: 'Producto',
      entidadId: producto.id,
    });

    revalidatePath('/inventario');
    return { ok: true as const, mensaje: `Producto ${datos.nombre} creado.` };
  });
}

export async function editarProducto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('inventario', 'editar');
    const id = requerido(fd, 'id', 'Producto');
    const datos = datosProducto(fd);

    const existente = await prisma.producto.findUnique({ where: { sku: datos.sku } });
    if (existente && existente.id !== id) throw new Error(`El SKU ${datos.sku} ya está en uso.`);

    // El stock no se toca aquí: sólo cambia mediante movimientos.
    await prisma.producto.update({ where: { id }, data: datos });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'inventario',
      entidad: 'Producto',
      entidadId: id,
    });

    revalidatePath('/inventario');
    revalidatePath(`/inventario/${id}`);
    return { ok: true as const, mensaje: 'Producto actualizado.' };
  });
}

export async function alternarActivoProducto(fd: FormData): Promise<void> {
  await exigirPermiso('inventario', 'editar');
  const id = String(fd.get('id'));
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) return;
  await prisma.producto.update({ where: { id }, data: { activo: !producto.activo } });
  revalidatePath('/inventario');
}

export async function eliminarProducto(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('inventario', 'eliminar');
  const id = String(fd.get('id'));

  const movimientos = await prisma.movimientoStock.count({ where: { productoId: id } });
  if (movimientos > 1) {
    throw new Error('El producto tiene movimientos de stock registrados. Desactívalo en vez de eliminarlo.');
  }

  await prisma.producto.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'inventario',
    entidad: 'Producto',
    entidadId: id,
  });
  revalidatePath('/inventario');
}

// ─────────────────────────────────────────────────────────────
//  Movimientos de stock
// ─────────────────────────────────────────────────────────────

export async function registrarMovimiento(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('inventario', 'editar');

    const productoId = requerido(fd, 'productoId', 'Producto');
    const tipo = texto(fd, 'tipo') as TipoMovimientoStock;
    if (!TIPOS_MOVIMIENTO.includes(tipo)) throw new Error('Tipo de movimiento no válido.');

    const cantidad = decimal(fd, 'cantidad');
    if (tipo !== 'AJUSTE' && cantidad <= 0) throw new Error('La cantidad debe ser mayor que cero.');
    if (tipo === 'AJUSTE' && cantidad < 0) throw new Error('El stock ajustado no puede ser negativo.');

    await prisma.$transaction(async (tx) => {
      await moverStock(tx, {
        productoId,
        tipo,
        cantidad,
        costoUnitario: entero(fd, 'costoUnitario') || undefined,
        motivo: textoOpcional(fd, 'motivo'),
        lote: textoOpcional(fd, 'lote'),
        fechaVencimiento: fecha(fd, 'fechaVencimiento'),
        usuarioId: sesion.usuarioId,
      });
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: `stock_${tipo.toLowerCase()}`,
      modulo: 'inventario',
      entidad: 'Producto',
      entidadId: productoId,
      detalle: { cantidad },
    });

    revalidatePath('/inventario');
    revalidatePath(`/inventario/${productoId}`);
    return { ok: true as const, mensaje: 'Movimiento registrado.' };
  });
}

// ─────────────────────────────────────────────────────────────
//  Categorías de producto
// ─────────────────────────────────────────────────────────────

export async function crearCategoriaProducto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('inventario', 'crear');
    const nombre = requerido(fd, 'nombre', 'Nombre');
    if (await prisma.categoriaProducto.findUnique({ where: { nombre } })) {
      throw new Error('Ya existe una categoría con ese nombre.');
    }
    await prisma.categoriaProducto.create({ data: { nombre, descripcion: textoOpcional(fd, 'descripcion') } });
    revalidatePath('/inventario');
    return { ok: true as const, mensaje: 'Categoría creada.' };
  });
}

export async function eliminarCategoriaProducto(fd: FormData): Promise<void> {
  await exigirPermiso('inventario', 'eliminar');
  const id = String(fd.get('id'));
  await prisma.producto.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
  await prisma.categoriaProducto.delete({ where: { id } });
  revalidatePath('/inventario');
}
