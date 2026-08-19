import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { obtenerSesion, puede } from '@/lib/auth';
import { generarPlantilla } from '@/lib/excel';
import {
  COLUMNAS_CONTEO,
  COLUMNAS_PRODUCTOS,
  INSTRUCCIONES_CONTEO,
  INSTRUCCIONES_PRODUCTOS,
  UNIDADES,
} from '@/lib/inventario-importacion';

/**
 * Entrega la plantilla de importación en formato `.xlsx`.
 *
 * La de conteo sale **prellenada** con los productos de ese conteo, y a
 * propósito **sin la existencia teórica**: ver la cifra esperada mientras se
 * cuenta sesga el recuento hacia confirmarla.
 */
export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return new NextResponse('No autorizado', { status: 401 });
  if (!puede(sesion, 'inventario', 'ver')) return new NextResponse('Sin permiso', { status: 403 });

  const params = new URL(request.url).searchParams;
  const tipo = params.get('tipo') ?? 'productos';

  let contenido: Buffer;
  let nombre: string;

  if (tipo === 'conteo') {
    const conteoId = params.get('conteo');
    if (!conteoId) return new NextResponse('Falta el conteo', { status: 400 });

    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: conteoId },
      include: {
        items: {
          include: { producto: { select: { sku: true, nombre: true, ubicacion: true } } },
          orderBy: { producto: { nombre: 'asc' } },
        },
      },
    });
    if (!conteo) return new NextResponse('El conteo no existe', { status: 404 });

    contenido = await generarPlantilla({
      titulo: `Conteo N.° ${conteo.folio} — ${conteo.nombre}`,
      columnas: COLUMNAS_CONTEO,
      instrucciones: INSTRUCCIONES_CONTEO,
      filas: conteo.items.map((i) => [
        i.producto.sku,
        i.producto.nombre,
        i.producto.ubicacion ?? '',
        i.stockContado ?? '',
        i.observaciones ?? '',
      ]),
    });
    nombre = `conteo-${conteo.folio}.xlsx`;
  } else {
    const categorias = await prisma.categoriaProducto.findMany({
      select: { nombre: true },
      orderBy: { nombre: 'asc' },
    });

    contenido = await generarPlantilla({
      titulo: 'Carga masiva de productos — MEDIGEX',
      columnas: COLUMNAS_PRODUCTOS,
      instrucciones: INSTRUCCIONES_PRODUCTOS,
      listas: [
        { titulo: 'Unidades admitidas', valores: [...UNIDADES] },
        {
          titulo: 'Categorías existentes',
          valores:
            categorias.length > 0
              ? categorias.map((c) => c.nombre)
              : ['(todavía no hay; las que escribas se crearán solas)'],
        },
      ],
    });
    nombre = 'plantilla-productos.xlsx';
  }

  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
