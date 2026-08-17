import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { clp, fechaCorta, fechaHora, humanizar } from '@/lib/format';
import {
  Badge,
  BadgeEstado,
  Definicion,
  EnlaceBoton,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';

import { CabeceraPaciente } from './cabecera';

export default async function FichaPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('pacientes', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [proximasCitas, ultimasAtenciones, ventas, presupuestos] = await Promise.all([
    prisma.cita.findMany({
      where: { pacienteId: id, inicio: { gte: new Date() }, estado: { notIn: ['CANCELADA', 'ATENDIDA'] } },
      orderBy: { inicio: 'asc' },
      take: 5,
      include: {
        profesional: { select: { nombres: true, apellidos: true } },
        servicios: { include: { servicio: { select: { nombre: true } } } },
        box: { select: { codigo: true } },
      },
    }),
    prisma.atencion.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      take: 5,
      include: { profesional: { select: { nombres: true, apellidos: true, especialidad: true } } },
    }),
    prisma.venta.findMany({
      where: { pacienteId: id, estado: { not: 'ANULADA' } },
      select: { total: true, saldo: true },
    }),
    prisma.presupuesto.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      take: 5,
      select: { id: true, folio: true, fecha: true, total: true, estado: true },
    }),
  ]);

  const totalFacturado = ventas.reduce((acc, v) => acc + v.total, 0);
  const puedeVerHistoria = puede(sesion, 'historia_clinica', 'ver');

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Atenciones" valor={String(contadores.atenciones)} />
        <Metrica etiqueta="Total facturado" valor={clp(totalFacturado)} />
        <Metrica
          etiqueta="Saldo pendiente"
          valor={clp(Math.max(0, saldo))}
          tono={saldo > 0 ? 'negativo' : 'positivo'}
        />
        <Metrica etiqueta="Documentos" valor={String(contadores.archivos)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta
            titulo="Próximas horas agendadas"
            acciones={
              <EnlaceBoton href={`/agenda/nueva?paciente=${id}`} variante="secundario" tamano="sm">
                Agendar
              </EnlaceBoton>
            }
          >
            {proximasCitas.length === 0 ? (
              <p className="text-sm text-tinta-500">Sin horas agendadas a futuro.</p>
            ) : (
              <ul className="divide-y divide-tinta-100">
                {proximasCitas.map((cita) => (
                  <li key={cita.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-tinta-800">{fechaHora(cita.inicio)}</p>
                      <p className="text-xs text-tinta-500">
                        {cita.profesional.nombres} {cita.profesional.apellidos}
                        {cita.servicios.length > 0 &&
                          ` · ${cita.servicios.map((s) => s.servicio.nombre).join(', ')}`}
                        {cita.box && ` · Box ${cita.box.codigo}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cita.usaRayosX && <Badge tono="morado">rayos X</Badge>}
                      <BadgeEstado estado={cita.estado} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          {puedeVerHistoria && (
            <Tarjeta
              titulo="Últimas atenciones"
              acciones={
                <EnlaceBoton href={`/pacientes/${id}/historia`} variante="secundario" tamano="sm">
                  Ver historia completa
                </EnlaceBoton>
              }
            >
              {ultimasAtenciones.length === 0 ? (
                <EstadoVacio
                  titulo="Sin atenciones registradas"
                  descripcion="Cuando el paciente sea atendido, la evolución aparecerá aquí."
                />
              ) : (
                <ul className="divide-y divide-tinta-100">
                  {ultimasAtenciones.map((a) => (
                    <li key={a.id} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-tinta-800">{a.motivoConsulta}</p>
                        <span className="text-xs text-tinta-400">{fechaCorta(a.fecha)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-tinta-500">
                        {a.profesional.nombres} {a.profesional.apellidos} · {a.profesional.especialidad}
                      </p>
                      {a.diagnostico && <p className="mt-1 text-sm text-tinta-600">Dg: {a.diagnostico}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          )}

          <Tarjeta
            titulo="Presupuestos"
            acciones={
              puede(sesion, 'presupuestos', 'crear') && (
                <EnlaceBoton href={`/presupuestos/nuevo?paciente=${id}`} variante="secundario" tamano="sm">
                  Nuevo presupuesto
                </EnlaceBoton>
              )
            }
          >
            {presupuestos.length === 0 ? (
              <p className="text-sm text-tinta-500">Sin presupuestos emitidos.</p>
            ) : (
              <ul className="divide-y divide-tinta-100">
                {presupuestos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/presupuestos/${p.id}`} className="text-sm text-brand-700 hover:underline">
                      Presupuesto Nº {p.folio}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-tinta-400">{fechaCorta(p.fecha)}</span>
                      <span className="text-sm font-medium tabular-nums">{clp(p.total)}</span>
                      <BadgeEstado estado={p.estado} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <div className="space-y-5">
          <Tarjeta titulo="Antecedentes de salud">
            <dl className="space-y-3">
              <Definicion termino="Alergias">
                {paciente.alergias ? <span className="text-rose-600">{paciente.alergias}</span> : null}
              </Definicion>
              <Definicion termino="Medicamentos actuales">{paciente.medicamentosActuales}</Definicion>
              <Definicion termino="Antecedentes médicos">{paciente.antecedentesMedicos}</Definicion>
              <Definicion termino="Antecedentes quirúrgicos">{paciente.antecedentesQuirurgicos}</Definicion>
              <Definicion termino="Observaciones">{paciente.observaciones}</Definicion>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Datos administrativos">
            <dl className="space-y-3">
              <Definicion termino="Dirección">
                {[paciente.direccion, paciente.comuna, paciente.ciudad].filter(Boolean).join(', ') || null}
              </Definicion>
              <Definicion termino="Ocupación">{paciente.ocupacion}</Definicion>
              <Definicion termino="Previsión">
                {paciente.prevision?.nombre ?? 'Sin registrar'}
                {paciente.previsionDetalle ? ` · ${paciente.previsionDetalle}` : ''}
              </Definicion>
              <Definicion termino="Convenio">
                {paciente.convenio ? `${paciente.convenio.nombre}` : null}
              </Definicion>
              <Definicion termino="Nº afiliado">{paciente.numeroAfiliado}</Definicion>
              <Definicion termino="Contacto de emergencia">
                {paciente.contactoEmergenciaNombre
                  ? `${paciente.contactoEmergenciaNombre} (${paciente.contactoEmergenciaRelacion ?? 'contacto'}) · ${paciente.contactoEmergenciaTelefono ?? ''}`
                  : null}
              </Definicion>
              <Definicion termino="Cómo nos conoció">{paciente.comoNosConocio}</Definicion>
              <Definicion termino="Ficha creada">{fechaCorta(paciente.createdAt)}</Definicion>
            </dl>
          </Tarjeta>

          {paciente.vieneDeOtroCentro && (
            <Tarjeta titulo="Derivación de origen">
              <dl className="space-y-3">
                <Definicion termino="Centro de origen">{paciente.centroOrigen}</Definicion>
                <Definicion termino="Profesional que deriva">{paciente.profesionalOrigen}</Definicion>
                <Definicion termino="Fecha de derivación">{fechaCorta(paciente.fechaDerivacion)}</Definicion>
                <Definicion termino="Motivo">{paciente.motivoDerivacion}</Definicion>
              </dl>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
