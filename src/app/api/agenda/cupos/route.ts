import { NextResponse } from 'next/server';

import { obtenerSesion, puede } from '@/lib/auth';
import { cuposDelDia } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

/**
 * Cupos de un profesional en un día, para el selector de horario de la agenda.
 *
 *   /api/agenda/cupos?profesional=<id>&fecha=2026-03-14&duracion=45
 *
 * `duracion` es la suma de los servicios elegidos: los cupos se calculan con
 * ese largo para que un bloque de 30 minutos no se ofrezca cuando la sesión
 * requiere 90.
 */
export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puede(sesion, 'agenda', 'ver')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const profesionalId = searchParams.get('profesional');
  const fechaTexto = searchParams.get('fecha');
  const duracion = parseInt(searchParams.get('duracion') ?? '0', 10);
  const excluirCitaId = searchParams.get('excluir');

  if (!profesionalId || !fechaTexto) {
    return NextResponse.json({ cupos: [], mensaje: 'Elige un profesional y una fecha.' });
  }

  const dia = new Date(`${fechaTexto}T12:00:00`);
  if (Number.isNaN(dia.getTime())) {
    return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
  }

  const cupos = await cuposDelDia(profesionalId, dia, duracion > 0 ? duracion : undefined);

  // Al reagendar, la propia hora de la cita no debe contarse como ocupada.
  const ahora = new Date();
  const resultado = cupos.map((c) => ({
    inicio: c.inicio.toISOString(),
    fin: c.fin.toISOString(),
    disponible: c.disponible && c.inicio > ahora,
    motivo: c.inicio <= ahora ? 'Ya pasó' : c.motivo,
    boxSugeridoId: c.boxSugeridoId ?? null,
  }));

  // La disponibilidad de boxes se consulta aparte, cuando ya hay una hora
  // elegida: depende del bloque exacto, no del día completo.
  return NextResponse.json({
    cupos: resultado,
    excluirCitaId,
    resumen: {
      total: resultado.length,
      libres: resultado.filter((c) => c.disponible).length,
    },
  });
}
