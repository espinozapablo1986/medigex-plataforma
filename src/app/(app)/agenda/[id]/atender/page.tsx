import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { calcularEdad, clp, fechaCorta, fechaHora, formatearRut, humanizar, isoFechaHora } from '@/lib/format';
import { Aviso, Badge, Campo, Definicion, EncabezadoPagina, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { registrarAtencion } from '../../../pacientes/acciones';

export const metadata = { title: 'Atender' };

export default async function PaginaAtender({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('historia_clinica', 'crear');

  const cita = await prisma.cita.findUnique({
    where: { id },
    include: {
      paciente: {
        include: {
          prevision: { select: { nombre: true } },
          atenciones: {
            orderBy: { fecha: 'desc' },
            take: 3,
            include: { profesional: { select: { apellidos: true, especialidad: true } } },
          },
        },
      },
      profesional: { select: { id: true, nombres: true, apellidos: true, especialidad: true } },
      servicios: { orderBy: { orden: 'asc' }, include: { servicio: true } },
      box: { select: { codigo: true, nombre: true } },
      atencion: { select: { id: true } },
    },
  });
  if (!cita) notFound();

  // Si ya fue atendida, no duplicamos el registro.
  if (cita.atencion) redirect(`/pacientes/${cita.pacienteId}/historia`);

  const paciente = cita.paciente;
  const edad = calcularEdad(paciente.fechaNacimiento, paciente.edadRegistrada);

  const profesionales = await prisma.profesional.findMany({
    where: { activo: true },
    orderBy: { apellidos: 'asc' },
    select: { id: true, nombres: true, apellidos: true, especialidad: true },
  });

  return (
    <>
      <EncabezadoPagina
        titulo={`Atender a ${paciente.nombres} ${paciente.apellidoPaterno}`}
        descripcion={`Hora de las ${fechaHora(cita.inicio)}${
          cita.servicios.length > 0 ? ` · ${cita.servicios.map((s) => s.servicio.nombre).join(', ')}` : ''
        }`}
        volver={{ href: '/agenda', texto: 'Agenda' }}
      />

      {paciente.alergias && (
        <div className="mb-4">
          <Aviso tono="error" titulo="Alergias del paciente">
            {paciente.alergias}
          </Aviso>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tarjeta titulo="Registro de la atención">
            <Formulario accion={registrarAtencion} className="space-y-4">
              <input type="hidden" name="pacienteId" value={paciente.id} />
              <input type="hidden" name="citaId" value={cita.id} />

              <Grilla cols={2}>
                <Campo etiqueta="Profesional que atiende" requerido>
                  <select
                    name="profesionalId"
                    defaultValue={sesion.profesionalId ?? cita.profesionalId}
                    required
                    className="campo"
                  >
                    {profesionales.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.apellidos}, {p.nombres} — {p.especialidad}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Fecha y hora">
                  <input name="fecha" type="datetime-local" defaultValue={isoFechaHora(new Date())} className="campo" />
                </Campo>
              </Grilla>

              <Campo
                etiqueta="Motivo de consulta"
                requerido
                ayuda="Confirma con el paciente qué lo trae hoy, aunque ya venga anotado desde la agenda."
              >
                <textarea
                  name="motivoConsulta"
                  rows={2}
                  required
                  autoFocus
                  defaultValue={cita.motivoConsulta ?? ''}
                  className="campo"
                />
              </Campo>

              <Grilla cols={2}>
                <Campo etiqueta="Anamnesis">
                  <textarea name="anamnesis" rows={4} className="campo" />
                </Campo>
                <Campo etiqueta="Examen físico">
                  <textarea name="examenFisico" rows={4} className="campo" />
                </Campo>
              </Grilla>

              <Grilla cols={2}>
                <Campo etiqueta="Diagnóstico">
                  <textarea name="diagnostico" rows={2} className="campo" />
                </Campo>
                <Campo etiqueta="Código CIE-10">
                  <input name="cie10" className="campo" />
                </Campo>
                <Campo etiqueta="Tratamiento realizado">
                  <textarea
                    name="tratamientoRealizado"
                    rows={3}
                    defaultValue={cita.servicios.map((s) => s.servicio.nombre).join('\n')}
                    className="campo"
                  />
                </Campo>
                <Campo etiqueta="Indicaciones al paciente">
                  <textarea name="indicaciones" rows={3} className="campo" />
                </Campo>
              </Grilla>

              <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signos vitales
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Campo etiqueta="P. arterial">
                    <input name="presionArterial" placeholder="120/80" className="campo" />
                  </Campo>
                  <Campo etiqueta="F. cardíaca">
                    <input name="frecuenciaCardiaca" type="number" min={0} max={300} className="campo" />
                  </Campo>
                  <Campo etiqueta="Temp. °C">
                    <input name="temperatura" type="number" step="0.1" min={30} max={45} className="campo" />
                  </Campo>
                  <Campo etiqueta="Sat. %">
                    <input name="saturacion" type="number" min={0} max={100} className="campo" />
                  </Campo>
                  <Campo etiqueta="Peso kg">
                    <input name="pesoKg" type="number" step="0.1" min={0} className="campo" />
                  </Campo>
                  <Campo etiqueta="Talla cm">
                    <input name="tallaCm" type="number" step="0.5" min={0} className="campo" />
                  </Campo>
                </div>
              </fieldset>

              <Grilla cols={2}>
                <Campo etiqueta="Observaciones">
                  <textarea name="observaciones" rows={2} className="campo" />
                </Campo>
                <Campo etiqueta="Próximo control">
                  <input name="proximoControl" type="date" className="campo" />
                </Campo>
              </Grilla>

              {cita.servicios.length > 0 && (
                <Aviso tono="info">
                  Al guardar se marcará la hora como atendida y se descontarán del inventario los insumos de{' '}
                  {cita.servicios.map((s) => `«${s.servicio.nombre}»`).join(', ')}.
                </Aviso>
              )}

              <div className="flex justify-end">
                <BotonEnviar tamano="lg">Guardar atención</BotonEnviar>
              </div>
            </Formulario>
          </Tarjeta>
        </div>

        <div className="space-y-5">
          <Tarjeta titulo="Paciente">
            <dl className="space-y-3">
              <Definicion termino="Nombre">
                <Link href={`/pacientes/${paciente.id}`} className="text-brand-700 hover:underline">
                  {paciente.nombres} {paciente.apellidoPaterno} {paciente.apellidoMaterno ?? ''}
                </Link>
              </Definicion>
              <Definicion termino="Ficha">Nº {paciente.numeroFicha}</Definicion>
              <Definicion termino="RUT">{formatearRut(paciente.rut) || paciente.pasaporte}</Definicion>
              <Definicion termino="Edad">{edad !== null ? `${edad} años` : null}</Definicion>
              <Definicion termino="Previsión">
                {paciente.prevision?.nombre ?? 'Sin registrar'}
                {paciente.previsionDetalle ? ` · ${paciente.previsionDetalle}` : ''}
              </Definicion>
              <Definicion termino="Medicamentos actuales">{paciente.medicamentosActuales}</Definicion>
              <Definicion termino="Antecedentes">{paciente.antecedentesMedicos}</Definicion>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Detalle de la hora">
            <dl className="space-y-3">
              <Definicion termino="Profesional">
                {cita.profesional.nombres} {cita.profesional.apellidos}
              </Definicion>
              <Definicion termino={cita.servicios.length === 1 ? 'Servicio' : 'Servicios'}>
                {cita.servicios.length > 0 ? (
                  <ul className="space-y-0.5">
                    {cita.servicios.map((s) => (
                      <li key={s.id} className="flex justify-between gap-2">
                        <span>{s.servicio.nombre}</span>
                        <span className="tabular-nums text-slate-500">{clp(s.servicio.precio)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Definicion>
              <Definicion termino="Box">{cita.box ? `${cita.box.codigo} — ${cita.box.nombre}` : null}</Definicion>
              <Definicion termino="Rayos X">
                {cita.usaRayosX ? <Badge tono="morado">requiere sala de rayos X</Badge> : 'No'}
              </Definicion>
              <Definicion termino="Observaciones de agenda">{cita.observaciones}</Definicion>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Últimas atenciones">
            {paciente.atenciones.length === 0 ? (
              <p className="text-sm text-slate-500">Primera atención de este paciente.</p>
            ) : (
              <ul className="space-y-3">
                {paciente.atenciones.map((a) => (
                  <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-xs text-slate-400">
                      {fechaCorta(a.fecha)} · {a.profesional.apellidos} ({a.profesional.especialidad})
                    </p>
                    <p className="text-sm text-slate-700">{a.motivoConsulta}</p>
                    {a.diagnostico && <p className="text-xs text-slate-500">Dg: {a.diagnostico}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
