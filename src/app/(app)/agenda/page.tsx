import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { finDelDia, inicioDelDia, sumarDias } from '@/lib/agenda';
import { DIAS_SEMANA, fechaLarga, hora, horaAMinutos, isoFecha, minutosAHora } from '@/lib/format';
import {
  Badge,
  BadgeEstado,
  Campo,
  EncabezadoPagina,
  EnlaceBoton,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';

import { PanelCita } from './panel-cita';

export const metadata = { title: 'Agenda' };

const ALTO_POR_MINUTO = 1.4; // px

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; vista?: string; profesional?: string }>;
}) {
  const sesion = await requerirPermiso('agenda', 'ver');
  const { fecha: fechaTexto, vista, profesional: filtroProfesional } = await searchParams;

  const dia = fechaTexto ? new Date(`${fechaTexto}T12:00:00`) : new Date();
  const desde = inicioDelDia(dia);
  const hasta = finDelDia(dia);
  const porBoxes = vista === 'boxes';

  const [citas, profesionales, boxes, disponibilidad, bloqueos] = await Promise.all([
    prisma.cita.findMany({
      where: { inicio: { gte: desde, lte: hasta }, ...(filtroProfesional ? { profesionalId: filtroProfesional } : {}) },
      orderBy: { inicio: 'asc' },
      include: {
        paciente: {
          select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true, alergias: true },
        },
        profesional: { select: { id: true, nombres: true, apellidos: true, colorAgenda: true } },
        servicio: { select: { nombre: true, duracionMinutos: true } },
        box: { select: { id: true, codigo: true } },
        atencion: { select: { id: true } },
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true, colorAgenda: true },
    }),
    prisma.box.findMany({ where: { activo: true }, orderBy: { codigo: 'asc' } }),
    prisma.disponibilidad.findMany({
      where: {
        diaSemana: dia.getDay(),
        activo: true,
        vigenteDesde: { lte: hasta },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }],
      },
    }),
    prisma.excepcionAgenda.findMany({
      where: { fechaInicio: { lte: hasta }, fechaFin: { gte: desde }, tipo: { not: 'DISPONIBILIDAD_EXTRA' } },
      include: { profesional: { select: { apellidos: true } }, box: { select: { codigo: true } } },
    }),
  ]);

  // Rango horario visible: del bloque más temprano al más tardío, con margen.
  const minutosDisponibles = disponibilidad.flatMap((d) => [horaAMinutos(d.horaInicio), horaAMinutos(d.horaFin)]);
  const minutosCitas = citas.flatMap((c) => [
    c.inicio.getHours() * 60 + c.inicio.getMinutes(),
    c.fin.getHours() * 60 + c.fin.getMinutes(),
  ]);
  const todos = [...minutosDisponibles, ...minutosCitas];
  const apertura = todos.length > 0 ? Math.max(0, Math.min(...todos) - 30) : 8 * 60;
  const cierre = todos.length > 0 ? Math.min(24 * 60, Math.max(...todos) + 30) : 20 * 60;
  const alturaTotal = (cierre - apertura) * ALTO_POR_MINUTO;

  // Columnas: profesionales con agenda ese día, o boxes.
  const profesionalesConAgenda = profesionales.filter(
    (p) =>
      (!filtroProfesional || p.id === filtroProfesional) &&
      (disponibilidad.some((d) => d.profesionalId === p.id) || citas.some((c) => c.profesionalId === p.id)),
  );

  const columnas = porBoxes
    ? boxes.map((b) => ({ id: b.id, titulo: b.codigo, subtitulo: b.nombre, color: '#64748b' }))
    : profesionalesConAgenda.map((p) => ({
        id: p.id,
        titulo: `${p.nombres} ${p.apellidos}`,
        subtitulo: p.especialidad,
        color: p.colorAgenda,
      }));

  const horasGuia: number[] = [];
  for (let m = Math.ceil(apertura / 60) * 60; m <= cierre; m += 60) horasGuia.push(m);

  const atendidas = citas.filter((c) => c.estado === 'ATENDIDA').length;
  const canceladas = citas.filter((c) => c.estado === 'CANCELADA' || c.estado === 'NO_ASISTIO').length;
  const puedeCrear = puede(sesion, 'agenda', 'crear');

  const paramsBase = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ fecha: isoFecha(dia), ...(vista ? { vista } : {}), ...(filtroProfesional ? { profesional: filtroProfesional } : {}), ...extra });
    return `/agenda?${p}`;
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Agenda"
        descripcion={`${DIAS_SEMANA[dia.getDay()]} ${fechaLarga(dia)}`}
        acciones={puedeCrear && <EnlaceBoton href={`/agenda/nueva?fecha=${isoFecha(dia)}`}>Agendar hora</EnlaceBoton>}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Link href={paramsBase({ fecha: isoFecha(sumarDias(dia, -1)) })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            ←
          </Link>
          <form className="flex items-center gap-1">
            {vista && <input type="hidden" name="vista" value={vista} />}
            {filtroProfesional && <input type="hidden" name="profesional" value={filtroProfesional} />}
            <input type="date" name="fecha" defaultValue={isoFecha(dia)} className="campo w-40" />
            <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              Ir
            </button>
          </form>
          <Link href={paramsBase({ fecha: isoFecha(sumarDias(dia, 1)) })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            →
          </Link>
          <Link href={paramsBase({ fecha: isoFecha(new Date()) })} className="ml-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            Hoy
          </Link>
        </div>

        <form className="flex items-end gap-2">
          <input type="hidden" name="fecha" value={isoFecha(dia)} />
          <Campo etiqueta="Vista" className="w-40">
            <select name="vista" defaultValue={vista ?? 'profesionales'} className="campo">
              <option value="profesionales">Por profesional</option>
              <option value="boxes">Por box</option>
            </select>
          </Campo>
          <Campo etiqueta="Profesional" className="w-56">
            <select name="profesional" defaultValue={filtroProfesional ?? ''} className="campo">
              <option value="">Todos</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellidos}, {p.nombres}
                </option>
              ))}
            </select>
          </Campo>
          <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Aplicar
          </button>
        </form>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Horas del día" valor={String(citas.length)} />
        <Metrica etiqueta="Atendidas" valor={String(atendidas)} tono="positivo" />
        <Metrica etiqueta="Canceladas / no asistió" valor={String(canceladas)} tono={canceladas > 0 ? 'negativo' : 'neutro'} />
        <Metrica etiqueta="Con rayos X" valor={String(citas.filter((c) => c.usaRayosX).length)} tono="marca" />
      </div>

      {bloqueos.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {bloqueos.map((b) => (
            <Badge key={b.id} tono="ambar">
              {b.tipo.replace(/_/g, ' ').toLowerCase()}
              {b.profesional ? ` · ${b.profesional.apellidos}` : ''}
              {b.box ? ` · box ${b.box.codigo}` : ''}
              {b.motivo ? `: ${b.motivo}` : ''}
            </Badge>
          ))}
        </div>
      )}

      {columnas.length === 0 ? (
        <EstadoVacio
          titulo="No hay agenda para este día"
          descripcion={
            porBoxes
              ? 'No hay boxes activos configurados.'
              : 'Ningún profesional tiene disponibilidad ni citas este día. Configura sus horarios en la ficha del profesional.'
          }
          accion={puedeCrear && <EnlaceBoton href={`/agenda/nueva?fecha=${isoFecha(dia)}`}>Agendar hora</EnlaceBoton>}
        />
      ) : (
        <Tarjeta sinPadding>
          <div className="scroll-fino overflow-x-auto">
            <div className="flex min-w-max">
              {/* Regla horaria */}
              <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-slate-200 bg-white">
                <div className="h-14 border-b border-slate-200" />
                <div className="relative" style={{ height: alturaTotal }}>
                  {horasGuia.map((m) => (
                    <div
                      key={m}
                      className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-slate-400"
                      style={{ top: (m - apertura) * ALTO_POR_MINUTO }}
                    >
                      {minutosAHora(m)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Columnas */}
              {columnas.map((columna) => {
                const citasColumna = citas.filter((c) =>
                  porBoxes ? c.boxId === columna.id : c.profesionalId === columna.id,
                );
                const bloquesColumna = porBoxes
                  ? []
                  : disponibilidad.filter((d) => d.profesionalId === columna.id);

                return (
                  <div key={columna.id} className="w-56 shrink-0 border-r border-slate-200 last:border-r-0">
                    <header className="flex h-14 flex-col justify-center border-b border-slate-200 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: columna.color }} />
                        <p className="truncate text-sm font-medium text-slate-800">{columna.titulo}</p>
                      </div>
                      <p className="truncate text-xs text-slate-400">{columna.subtitulo}</p>
                    </header>

                    <div className="relative bg-slate-50/40" style={{ height: alturaTotal }}>
                      {/* Líneas de hora */}
                      {horasGuia.map((m) => (
                        <div
                          key={m}
                          className="absolute inset-x-0 border-t border-slate-100"
                          style={{ top: (m - apertura) * ALTO_POR_MINUTO }}
                        />
                      ))}

                      {/* Franjas de disponibilidad */}
                      {bloquesColumna.map((b) => (
                        <div
                          key={b.id}
                          className="absolute inset-x-0 bg-white"
                          style={{
                            top: (horaAMinutos(b.horaInicio) - apertura) * ALTO_POR_MINUTO,
                            height: (horaAMinutos(b.horaFin) - horaAMinutos(b.horaInicio)) * ALTO_POR_MINUTO,
                          }}
                        />
                      ))}

                      {/* Citas */}
                      {citasColumna.map((cita) => {
                        const inicioMin = cita.inicio.getHours() * 60 + cita.inicio.getMinutes();
                        const finMin = cita.fin.getHours() * 60 + cita.fin.getMinutes();
                        const anulada = cita.estado === 'CANCELADA' || cita.estado === 'NO_ASISTIO';
                        return (
                          <div
                            key={cita.id}
                            className="absolute inset-x-1"
                            style={{
                              top: (inicioMin - apertura) * ALTO_POR_MINUTO,
                              height: Math.max(28, (finMin - inicioMin) * ALTO_POR_MINUTO - 2),
                            }}
                          >
                            <PanelCita cita={cita} anulada={anulada} puedeEditar={puede(sesion, 'agenda', 'editar')} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Tarjeta>
      )}

      {/* Listado del día, útil en móvil y para recepción */}
      {citas.length > 0 && (
        <Tarjeta titulo="Listado del día" className="mt-5" sinPadding>
          <ul className="divide-y divide-slate-100">
            {citas.map((cita) => (
              <li key={cita.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm font-medium tabular-nums text-slate-700">
                    {hora(cita.inicio)}–{hora(cita.fin)}
                  </span>
                  <div>
                    <Link href={`/pacientes/${cita.paciente.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                      {cita.paciente.nombres} {cita.paciente.apellidoPaterno}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {cita.profesional.nombres} {cita.profesional.apellidos}
                      {cita.servicio && ` · ${cita.servicio.nombre}`}
                      {cita.box && ` · Box ${cita.box.codigo}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {cita.paciente.alergias && <Badge tono="rojo">alergias</Badge>}
                  {cita.usaRayosX && <Badge tono="morado">rayos X</Badge>}
                  <BadgeEstado estado={cita.estado} />
                  <span className="text-xs text-slate-400">{cita.paciente.telefonoPrincipal}</span>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}
