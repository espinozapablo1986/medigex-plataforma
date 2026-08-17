import 'server-only';

import { prisma } from './prisma';

/**
 * Listas inteligentes del CRM.
 *
 * No inventan datos nuevos: cruzan la agenda, la historia clínica y las
 * ventas que ya existen para responder las preguntas que en la práctica se
 * le escapan a un centro chico — quién dejó de venir, qué presupuesto quedó
 * sin respuesta, a quién hay que cobrarle.
 */

const DIA = 86_400_000;

function haceDias(dias: number) {
  return new Date(Date.now() - dias * DIA);
}

export interface FilaRecall {
  pacienteId: string;
  nombre: string;
  telefono: string;
  email: string | null;
  detalle: string;
  /** Días transcurridos desde el hecho que motiva el contacto. */
  dias: number;
  monto?: number;
}

/**
 * Pacientes que no vuelven: sin atención en los últimos `meses` y sin ninguna
 * hora agendada a futuro. Es la lista que más ingresos recupera.
 */
export async function pacientesSinVolver(meses = 6, limite = 50): Promise<FilaRecall[]> {
  const corte = haceDias(meses * 30);
  const ahora = new Date();

  const pacientes = await prisma.paciente.findMany({
    where: {
      activo: true,
      atenciones: { some: {}, none: { fecha: { gte: corte } } },
      citas: { none: { inicio: { gte: ahora }, estado: { notIn: ['CANCELADA', 'NO_ASISTIO'] } } },
    },
    select: {
      id: true,
      nombres: true,
      apellidoPaterno: true,
      telefonoPrincipal: true,
      email: true,
      atenciones: { orderBy: { fecha: 'desc' }, take: 1, select: { fecha: true, motivoConsulta: true } },
    },
    take: limite,
  });

  return pacientes
    .map((p) => {
      const ultima = p.atenciones[0];
      const dias = ultima ? Math.floor((Date.now() - ultima.fecha.getTime()) / DIA) : 0;
      return {
        pacienteId: p.id,
        nombre: `${p.nombres} ${p.apellidoPaterno}`,
        telefono: p.telefonoPrincipal,
        email: p.email,
        detalle: ultima ? `Última atención: ${ultima.motivoConsulta}` : 'Sin atenciones',
        dias,
      };
    })
    .sort((a, b) => b.dias - a.dias);
}

/**
 * Controles que el profesional dejó agendados en la ficha pero que nunca se
 * convirtieron en una hora real.
 */
export async function controlesVencidos(limite = 50): Promise<FilaRecall[]> {
  const ahora = new Date();

  const atenciones = await prisma.atencion.findMany({
    where: {
      proximoControl: { lt: ahora, gte: haceDias(365) },
      paciente: {
        activo: true,
        citas: { none: { inicio: { gte: ahora }, estado: { notIn: ['CANCELADA', 'NO_ASISTIO'] } } },
      },
    },
    orderBy: { proximoControl: 'asc' },
    take: limite,
    select: {
      proximoControl: true,
      diagnostico: true,
      motivoConsulta: true,
      paciente: {
        select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true, email: true },
      },
      profesional: { select: { apellidos: true } },
    },
  });

  // Un paciente puede tener varios controles vencidos: nos quedamos con el más antiguo.
  const vistos = new Set<string>();
  const filas: FilaRecall[] = [];

  for (const a of atenciones) {
    if (vistos.has(a.paciente.id)) continue;
    vistos.add(a.paciente.id);
    filas.push({
      pacienteId: a.paciente.id,
      nombre: `${a.paciente.nombres} ${a.paciente.apellidoPaterno}`,
      telefono: a.paciente.telefonoPrincipal,
      email: a.paciente.email,
      detalle: `Control indicado por ${a.profesional.apellidos} · ${a.diagnostico ?? a.motivoConsulta}`,
      dias: Math.floor((Date.now() - (a.proximoControl?.getTime() ?? Date.now())) / DIA),
    });
  }

  return filas;
}

/** Presupuestos enviados que llevan días sin aceptarse ni rechazarse. */
export async function presupuestosSinRespuesta(diasMinimos = 7, limite = 50) {
  const presupuestos = await prisma.presupuesto.findMany({
    where: {
      estado: { in: ['ENVIADO', 'BORRADOR'] },
      fecha: { lte: haceDias(diasMinimos) },
    },
    orderBy: { fecha: 'asc' },
    take: limite,
    include: {
      paciente: { select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true, email: true } },
    },
  });

  return presupuestos.map((p) => ({
    presupuestoId: p.id,
    folio: p.folio,
    pacienteId: p.paciente.id,
    nombre: `${p.paciente.nombres} ${p.paciente.apellidoPaterno}`,
    telefono: p.paciente.telefonoPrincipal,
    email: p.paciente.email,
    total: p.total,
    estado: p.estado,
    dias: Math.floor((Date.now() - p.fecha.getTime()) / DIA),
  }));
}

/** Pacientes con saldo pendiente, ordenados por antigüedad de la deuda. */
export async function saldosPendientes(diasMinimos = 15, limite = 50): Promise<FilaRecall[]> {
  const ventas = await prisma.venta.findMany({
    where: {
      saldo: { gt: 0 },
      estado: { in: ['PENDIENTE', 'PARCIAL'] },
      fecha: { lte: haceDias(diasMinimos) },
    },
    orderBy: { fecha: 'asc' },
    take: limite * 3,
    include: {
      paciente: { select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true, email: true } },
    },
  });

  // Se agrupa por paciente: interesa el total adeudado, no cada documento.
  const porPaciente = new Map<string, FilaRecall>();

  for (const v of ventas) {
    const previo = porPaciente.get(v.paciente.id);
    const dias = Math.floor((Date.now() - v.fecha.getTime()) / DIA);

    if (previo) {
      previo.monto = (previo.monto ?? 0) + v.saldo;
      previo.dias = Math.max(previo.dias, dias);
      previo.detalle = `${previo.detalle.split(' ')[0]} documentos pendientes`;
    } else {
      porPaciente.set(v.paciente.id, {
        pacienteId: v.paciente.id,
        nombre: `${v.paciente.nombres} ${v.paciente.apellidoPaterno}`,
        telefono: v.paciente.telefonoPrincipal,
        email: v.paciente.email,
        detalle: `Venta Nº ${v.folio}`,
        dias,
        monto: v.saldo,
      });
    }
  }

  return [...porPaciente.values()].sort((a, b) => (b.monto ?? 0) - (a.monto ?? 0)).slice(0, limite);
}

/** Horas perdidas en los últimos días que nadie volvió a agendar. */
export async function inasistenciasSinReagendar(dias = 30, limite = 50): Promise<FilaRecall[]> {
  const ahora = new Date();

  const citas = await prisma.cita.findMany({
    where: {
      estado: { in: ['NO_ASISTIO', 'CANCELADA'] },
      inicio: { gte: haceDias(dias), lte: ahora },
      paciente: {
        activo: true,
        citas: { none: { inicio: { gte: ahora }, estado: { notIn: ['CANCELADA', 'NO_ASISTIO'] } } },
      },
    },
    orderBy: { inicio: 'desc' },
    take: limite,
    include: {
      paciente: { select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true, email: true } },
      profesional: { select: { apellidos: true } },
    },
  });

  const vistos = new Set<string>();
  const filas: FilaRecall[] = [];

  for (const c of citas) {
    if (vistos.has(c.paciente.id)) continue;
    vistos.add(c.paciente.id);
    filas.push({
      pacienteId: c.paciente.id,
      nombre: `${c.paciente.nombres} ${c.paciente.apellidoPaterno}`,
      telefono: c.paciente.telefonoPrincipal,
      email: c.paciente.email,
      detalle: `${c.estado === 'NO_ASISTIO' ? 'No asistió' : 'Canceló'} con ${c.profesional.apellidos}`,
      dias: Math.floor((Date.now() - c.inicio.getTime()) / DIA),
    });
  }

  return filas;
}

/** Cumpleaños del mes en curso: excusa barata y efectiva para reactivar. */
export async function cumpleanosDelMes(limite = 60) {
  const mes = new Date().getMonth() + 1;

  const pacientes = await prisma.$queryRaw<
    { id: string; nombres: string; apellidoPaterno: string; telefonoPrincipal: string; dia: number }[]
  >`
    SELECT id, nombres, "apellidoPaterno", "telefonoPrincipal",
           EXTRACT(DAY FROM "fechaNacimiento")::int AS dia
    FROM pacientes
    WHERE activo = true
      AND "fechaNacimiento" IS NOT NULL
      AND EXTRACT(MONTH FROM "fechaNacimiento") = ${mes}
    ORDER BY dia ASC
    LIMIT ${limite}
  `;

  return pacientes;
}

/** Resumen para las tarjetas del panel del CRM. */
export async function resumenCrm() {
  const ahora = new Date();

  const [seguimientosPendientes, seguimientosVencidos, contactosAbiertos, contactosConvertidosMes] =
    await Promise.all([
      prisma.seguimiento.count({ where: { estado: { in: ['PENDIENTE', 'EN_CURSO'] } } }),
      prisma.seguimiento.count({
        where: { estado: { in: ['PENDIENTE', 'EN_CURSO'] }, fechaVencimiento: { lt: ahora } },
      }),
      prisma.contacto.count({ where: { estado: { in: ['NUEVO', 'CONTACTADO', 'INTERESADO', 'AGENDADO'] } } }),
      prisma.contacto.count({
        where: {
          estado: 'CONVERTIDO',
          convertidoAt: { gte: new Date(ahora.getFullYear(), ahora.getMonth(), 1) },
        },
      }),
    ]);

  return { seguimientosPendientes, seguimientosVencidos, contactosAbiertos, contactosConvertidosMes };
}

/** Enlace de WhatsApp con el mensaje ya escrito. */
export function enlaceWhatsapp(telefono: string, mensaje: string) {
  const numero = telefono.replace(/[^\d]/g, '');
  // Los teléfonos chilenos se guardan de varias formas; se normaliza a +56.
  const internacional = numero.startsWith('56') ? numero : `56${numero.replace(/^0+/, '')}`;
  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensaje)}`;
}
