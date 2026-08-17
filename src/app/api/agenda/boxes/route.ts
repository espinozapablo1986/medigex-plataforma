import { NextResponse } from 'next/server';

import { obtenerSesion, puede } from '@/lib/auth';
import { boxesConEstado } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

/**
 * Estado de los boxes en un horario concreto, para la grilla del agendamiento.
 *
 *   /api/agenda/boxes?inicio=2026-03-14T09:00&duracion=45&tipo=SALA_RAYOS_X
 *
 * Devuelve todos los boxes activos, no sólo los libres: al agendar conviene
 * ver cuál está ocupado y por quién, para poder decidir mover la hora.
 */
export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puede(sesion, 'agenda', 'ver')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inicioTexto = searchParams.get('inicio');
  const duracion = parseInt(searchParams.get('duracion') ?? '30', 10) || 30;
  const tipoRequerido = searchParams.get('tipo');
  const excluirCitaId = searchParams.get('excluir');

  if (!inicioTexto) {
    return NextResponse.json({ boxes: [], mensaje: 'Elige primero una hora.' });
  }

  const inicio = new Date(inicioTexto);
  if (Number.isNaN(inicio.getTime())) {
    return NextResponse.json({ error: 'Hora no válida' }, { status: 400 });
  }

  const fin = new Date(inicio.getTime() + duracion * 60_000);
  const boxes = await boxesConEstado(inicio, fin, { tipoRequerido, excluirCitaId });

  return NextResponse.json({
    boxes,
    resumen: {
      total: boxes.length,
      libres: boxes.filter((b) => b.disponible).length,
      libresRecomendados: boxes.filter((b) => b.disponible && b.recomendado).length,
    },
  });
}
