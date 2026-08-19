'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { moverStock } from '@/lib/inventario';
import { LIMITE_FILAS, leerPlanilla } from '@/lib/excel';
import {
  COLUMNAS_CONTEO,
  COLUMNAS_PRODUCTOS,
  UNIDADES,
  comoBooleano,
  comoNumero,
} from '@/lib/inventario-importacion';
import { requerido, texto } from '@/lib/resultado';

/**
 * Importación en dos pasos: primero se muestra qué va a pasar, y sólo después
 * se aplica.
 *
 * Una carga masiva que escribe de inmediato es la forma más rápida de
 * arruinar un inventario: basta una columna corrida para reescribir cientos
 * de productos. Aquí la planilla se lee, se valida fila por fila y se
 * devuelve un informe; recién al confirmar se toca la base de datos.
 *
 * El resultado de la vista previa viaja de vuelta al formulario como JSON,
 * de modo que confirmar no obliga a subir el archivo otra vez ni exige
 * guardarlo en el servidor.
 */

export interface FilaProducto {
  fila: number;
  sku: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  stockMinimo: number;
  stockMaximo: number;
  costo: number;
  precioVenta: number;
  esInsumo: boolean;
  esVendible: boolean;
  ubicacion: string | null;
  stockInicial: number | null;
  accion: 'crear' | 'actualizar';
}

export interface FilaConteoLeida {
  fila: number;
  sku: string;
  nombre: string;
  contado: number;
  observaciones: string | null;
  stockTeorico: number;
  diferencia: number;
  itemId: string;
}

export interface ErrorFila {
  fila: number;
  detalle: string;
}

export type Previsualizacion<T> =
  | { ok: false; error: string }
  | {
      ok: true;
      validas: T[];
      errores: ErrorFila[];
      truncado: boolean;
      /** JSON con las filas válidas, para el paso de confirmación. */
      carga: string;
      /** Presente sólo cuando la carga ya se aplicó. */
      resumen?: { creados?: number; actualizados?: number; lineas?: number };
    };

function archivoDe(fd: FormData): File {
  const archivo = fd.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) {
    throw new Error('Elige una planilla para subir.');
  }
  const nombre = archivo.name.toLowerCase();
  if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.csv')) {
    throw new Error('El archivo debe ser .xlsx o .csv. Los .xls antiguos hay que volver a guardarlos como .xlsx.');
  }
  return archivo;
}

function mensajeDeError(error: unknown): string {
  if (error && typeof error === 'object' && 'digest' in error) throw error;
  return error instanceof Error ? error.message : 'No se pudo leer la planilla.';
}

// ─────────────────────────────────────────────────────────────
//  Productos
// ─────────────────────────────────────────────────────────────

export async function previsualizarProductos(
  _previo: Previsualizacion<FilaProducto> | null,
  fd: FormData,
): Promise<Previsualizacion<FilaProducto>> {
  try {
    await exigirPermiso('inventario', 'crear');
    const { filas, faltantes, truncado } = await leerPlanilla(archivoDe(fd), COLUMNAS_PRODUCTOS);

    if (faltantes.length > 0) {
      return {
        ok: false,
        error: `A la planilla le faltan columnas obligatorias: ${faltantes.join(', ')}. Descarga la plantilla y vuelve a intentarlo.`,
      };
    }
    if (filas.length === 0) return { ok: false, error: 'La planilla no tiene ninguna fila con datos.' };

    const skus = filas.map((f) => f.valores.sku!).filter(Boolean);
    const existentes = new Set(
      (
        await prisma.producto.findMany({ where: { sku: { in: skus } }, select: { sku: true } })
      ).map((p) => p.sku),
    );

    const validas: FilaProducto[] = [];
    const errores: ErrorFila[] = [];
    const vistos = new Set<string>();

    for (const { fila, valores } of filas) {
      const problemas: string[] = [];

      const sku = valores.sku?.trim() ?? '';
      const nombre = valores.nombre?.trim() ?? '';
      if (!sku) problemas.push('falta el SKU');
      if (!nombre) problemas.push('falta el nombre');

      // Un SKU repetido dentro del mismo archivo dejaría el resultado a
      // merced del orden de las filas.
      if (sku && vistos.has(sku.toLowerCase())) problemas.push(`el SKU "${sku}" está repetido en la planilla`);

      const unidadCruda = (valores.unidad ?? '').trim().toUpperCase();
      const unidad = unidadCruda === '' ? 'UNIDAD' : unidadCruda;
      if (!UNIDADES.includes(unidad as (typeof UNIDADES)[number])) {
        problemas.push(`unidad "${valores.unidad}" no válida`);
      }

      const numeros: Record<string, number> = {};
      for (const campo of ['stockMinimo', 'stockMaximo', 'costo', 'precioVenta'] as const) {
        const crudo = valores[campo] ?? '';
        if (crudo === '') {
          numeros[campo] = 0;
          continue;
        }
        const n = comoNumero(crudo);
        if (n === null) problemas.push(`"${crudo}" no es un número válido en ${campo}`);
        else if (n < 0) problemas.push(`${campo} no puede ser negativo`);
        else numeros[campo] = n;
      }

      let stockInicial: number | null = null;
      const crudoStock = valores.stockInicial ?? '';
      if (crudoStock !== '') {
        const n = comoNumero(crudoStock);
        if (n === null || n < 0) problemas.push(`stock inicial "${crudoStock}" no válido`);
        else stockInicial = n;
      }

      if (problemas.length > 0) {
        errores.push({ fila, detalle: problemas.join('; ') });
        continue;
      }

      vistos.add(sku.toLowerCase());
      validas.push({
        fila,
        sku,
        nombre,
        categoria: valores.categoria?.trim() || null,
        unidad,
        stockMinimo: numeros.stockMinimo ?? 0,
        stockMaximo: numeros.stockMaximo ?? 0,
        // El peso chileno no usa decimales.
        costo: Math.round(numeros.costo ?? 0),
        precioVenta: Math.round(numeros.precioVenta ?? 0),
        esInsumo: comoBooleano(valores.esInsumo ?? '', true),
        esVendible: comoBooleano(valores.esVendible ?? '', false),
        ubicacion: valores.ubicacion?.trim() || null,
        stockInicial,
        accion: existentes.has(sku) ? 'actualizar' : 'crear',
      });
    }

    return { ok: true, validas, errores, truncado, carga: JSON.stringify(validas) };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

const esquemaProducto = z.object({
  sku: z.string().min(1),
  nombre: z.string().min(1),
  categoria: z.string().nullable(),
  unidad: z.enum(UNIDADES),
  stockMinimo: z.number().min(0),
  stockMaximo: z.number().min(0),
  costo: z.number().int().min(0),
  precioVenta: z.number().int().min(0),
  esInsumo: z.boolean(),
  esVendible: z.boolean(),
  ubicacion: z.string().nullable(),
  stockInicial: z.number().min(0).nullable(),
  accion: z.enum(['crear', 'actualizar']),
  fila: z.number(),
});

export async function aplicarProductos(
  _previo: Previsualizacion<FilaProducto> | null,
  fd: FormData,
): Promise<Previsualizacion<FilaProducto>> {
  try {
    const sesion = await exigirPermiso('inventario', 'crear');

    // Se revalida lo que llega: la vista previa viajó por el navegador y no
    // puede darse por buena.
    const validado = z.array(esquemaProducto).max(LIMITE_FILAS).safeParse(JSON.parse(texto(fd, 'carga')));
    if (!validado.success) throw new Error('Los datos de la carga no son válidos. Vuelve a subir la planilla.');
    const filas = validado.data;
    if (filas.length === 0) throw new Error('No hay filas que aplicar.');

    // Las categorías nombradas se crean una sola vez, antes del bucle.
    const nombresCategoria = [...new Set(filas.map((f) => f.categoria).filter((c): c is string => Boolean(c)))];
    const categorias = new Map<string, string>();
    for (const nombre of nombresCategoria) {
      const existente = await prisma.categoriaProducto.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
      });
      const cat = existente ?? (await prisma.categoriaProducto.create({ data: { nombre } }));
      categorias.set(nombre.toLowerCase(), cat.id);
    }

    let creados = 0;
    let actualizados = 0;

    for (const f of filas) {
      const categoriaId = f.categoria ? (categorias.get(f.categoria.toLowerCase()) ?? null) : null;
      const comunes = {
        nombre: f.nombre,
        unidadMedida: f.unidad,
        stockMinimo: f.stockMinimo,
        stockMaximo: f.stockMaximo,
        costoPromedio: f.costo,
        precioVenta: f.precioVenta,
        esInsumo: f.esInsumo,
        esVendible: f.esVendible,
        ubicacion: f.ubicacion,
        ...(categoriaId ? { categoriaId } : {}),
      };

      const existente = await prisma.producto.findUnique({ where: { sku: f.sku } });

      if (existente) {
        // El stock no se toca en una actualización: se corrige con un conteo,
        // no reescribiéndolo desde una planilla.
        await prisma.producto.update({ where: { id: existente.id }, data: comunes });
        actualizados += 1;
      } else {
        const creado = await prisma.producto.create({ data: { sku: f.sku, ...comunes } });
        creados += 1;

        if (f.stockInicial && f.stockInicial > 0) {
          await prisma.$transaction(async (tx) => {
            await moverStock(tx, {
              productoId: creado.id,
              tipo: 'INVENTARIO_INICIAL',
              cantidad: f.stockInicial!,
              costoUnitario: f.costo || undefined,
              motivo: 'Carga masiva desde planilla',
              usuarioId: sesion.usuarioId,
            });
          });
        }
      }
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'importar_productos',
      modulo: 'inventario',
      entidad: 'Producto',
      detalle: { creados, actualizados },
    });

    revalidatePath('/inventario');
    return {
      ok: true,
      validas: [],
      errores: [],
      truncado: false,
      carga: '',
      resumen: { creados, actualizados },
    };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

// ─────────────────────────────────────────────────────────────
//  Conteo
// ─────────────────────────────────────────────────────────────

export async function previsualizarConteo(
  _previo: Previsualizacion<FilaConteoLeida> | null,
  fd: FormData,
): Promise<Previsualizacion<FilaConteoLeida>> {
  try {
    await exigirPermiso('inventario', 'editar');
    const conteoId = requerido(fd, 'conteoId', 'Conteo');

    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: conteoId },
      include: { items: { include: { producto: { select: { sku: true, nombre: true } } } } },
    });
    if (!conteo) throw new Error('El conteo no existe.');
    if (conteo.estado !== 'ABIERTO') throw new Error('Este conteo ya está cerrado.');

    const { filas, faltantes } = await leerPlanilla(archivoDe(fd), COLUMNAS_CONTEO);
    if (faltantes.length > 0) {
      return { ok: false, error: `A la planilla le falta la columna ${faltantes.join(', ')}.` };
    }

    const porSku = new Map(conteo.items.map((i) => [i.producto.sku.toLowerCase(), i]));
    const validas: FilaConteoLeida[] = [];
    const errores: ErrorFila[] = [];

    for (const { fila, valores } of filas) {
      const sku = (valores.sku ?? '').trim();
      const crudo = (valores.contado ?? '').trim();

      // Una fila sin cantidad no es un error: es una posición aún sin contar.
      if (crudo === '') continue;

      const item = porSku.get(sku.toLowerCase());
      if (!item) {
        errores.push({ fila, detalle: `el SKU "${sku}" no forma parte de este conteo` });
        continue;
      }

      const contado = comoNumero(crudo);
      if (contado === null || contado < 0) {
        errores.push({ fila, detalle: `"${crudo}" no es una cantidad válida` });
        continue;
      }

      validas.push({
        fila,
        sku: item.producto.sku,
        nombre: item.producto.nombre,
        contado,
        observaciones: valores.observaciones?.trim() || null,
        stockTeorico: item.stockTeorico,
        diferencia: contado - item.stockTeorico,
        itemId: item.id,
      });
    }

    if (validas.length === 0 && errores.length === 0) {
      return { ok: false, error: 'La planilla no trae ninguna cantidad contada.' };
    }

    return { ok: true, validas, errores, truncado: false, carga: JSON.stringify(validas) };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

const esquemaFilaConteo = z.object({
  itemId: z.string().min(1),
  contado: z.number().min(0),
  observaciones: z.string().nullable(),
});

export async function aplicarConteo(
  _previo: Previsualizacion<FilaConteoLeida> | null,
  fd: FormData,
): Promise<Previsualizacion<FilaConteoLeida>> {
  try {
    const sesion = await exigirPermiso('inventario', 'editar');
    const conteoId = requerido(fd, 'conteoId', 'Conteo');

    const conteo = await prisma.conteoInventario.findUnique({ where: { id: conteoId } });
    if (!conteo) throw new Error('El conteo no existe.');
    if (conteo.estado !== 'ABIERTO') throw new Error('Este conteo ya está cerrado.');

    const validado = z
      .array(esquemaFilaConteo)
      .max(LIMITE_FILAS)
      .safeParse(JSON.parse(texto(fd, 'carga')));
    if (!validado.success) throw new Error('Los datos de la carga no son válidos.');

    const ahora = new Date();
    await prisma.$transaction(
      validado.data.map((f) =>
        prisma.conteoInventarioItem.updateMany({
          where: { id: f.itemId, conteoId },
          data: { stockContado: f.contado, observaciones: f.observaciones, contadoAt: ahora },
        }),
      ),
    );

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'importar_conteo',
      modulo: 'inventario',
      entidad: 'ConteoInventario',
      entidadId: conteoId,
      detalle: { lineas: validado.data.length },
    });

    revalidatePath(`/inventario/conteos/${conteoId}`);
    return {
      ok: true,
      validas: [],
      errores: [],
      truncado: false,
      carga: '',
      resumen: { lineas: validado.data.length },
    };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}
