import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { calcularEdad, fechaCorta, fechaLarga, formatearRut, humanizar } from '@/lib/format';
import { Aviso, Badge, Campo, EncabezadoPagina, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { anularReceta } from '../acciones';

export default async function DetalleReceta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('recetas', 'ver');

  const [receta, config] = await Promise.all([
    prisma.receta.findUnique({
      where: { id },
      include: {
        paciente: true,
        profesional: true,
        atencion: { select: { id: true, fecha: true, motivoConsulta: true } },
        items: { orderBy: { orden: 'asc' } },
      },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!receta) notFound();

  const paciente = receta.paciente;
  const edad = calcularEdad(paciente.fechaNacimiento, paciente.edadRegistrada);
  const vencida = receta.vigenteHasta && receta.vigenteHasta < new Date();

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo={`Receta Nº ${receta.folio}`}
          descripcion={`${paciente.nombres} ${paciente.apellidoPaterno} · ${fechaCorta(receta.fecha)}`}
          volver={{ href: '/recetas', texto: 'Recetas' }}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tono={receta.tipo === 'RETENIDA' ? 'ambar' : 'gris'}>{humanizar(receta.tipo)}</Badge>
              {receta.anulada && <Badge tono="rojo">anulada</Badge>}
              {!receta.anulada && vencida && <Badge tono="ambar">vencida</Badge>}

              {puede(sesion, 'recetas', 'anular') && !receta.anulada && (
                <Modal titulo="Anular receta" etiquetaBoton="Anular" varianteBoton="peligro" tamanoBoton="sm" ancho="max-w-md">
                  <Formulario accion={anularReceta} className="space-y-4">
                    <input type="hidden" name="id" value={receta.id} />
                    <Aviso tono="alerta">
                      La receta quedará marcada como anulada en la historia clínica, pero no se elimina por
                      trazabilidad.
                    </Aviso>
                    <Campo etiqueta="Motivo">
                      <textarea name="motivo" rows={2} className="campo" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar variante="peligro">Anular receta</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )}
            </div>
          }
        />

        {receta.anulada && (
          <div className="mb-4">
            <Aviso tono="error" titulo="Receta anulada">
              Esta prescripción fue anulada y no debe dispensarse.
            </Aviso>
          </div>
        )}
      </div>

      {/* ── Documento imprimible ── */}
      <article className="tarjeta mx-auto max-w-3xl p-10">
        <header className="mb-8 flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{config?.nombreClinica ?? 'MEDIGEX'}</h1>
            {config?.giro && <p className="text-sm text-slate-600">{config.giro}</p>}
            <p className="text-sm text-slate-600">
              {[config?.direccion, config?.comuna, config?.ciudad].filter(Boolean).join(', ')}
            </p>
            {config?.telefono && <p className="text-sm text-slate-600">Teléfono {config.telefono}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-slate-400">{humanizar(receta.tipo)}</p>
            <p className="text-2xl font-bold text-slate-900">Nº {receta.folio}</p>
            <p className="text-sm text-slate-600">{fechaLarga(receta.fecha)}</p>
          </div>
        </header>

        <section className="mb-6 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Dato etiqueta="Paciente" valor={`${paciente.nombres} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno ?? ''}`} />
          <Dato etiqueta="RUT" valor={formatearRut(paciente.rut) || paciente.pasaporte || '—'} />
          <Dato etiqueta="Edad" valor={edad !== null ? `${edad} años` : '—'} />
          <Dato etiqueta="Previsión" valor={humanizar(paciente.prevision)} />
          {paciente.direccion && (
            <Dato etiqueta="Domicilio" valor={[paciente.direccion, paciente.comuna].filter(Boolean).join(', ')} />
          )}
          {receta.diagnostico && <Dato etiqueta="Diagnóstico" valor={receta.diagnostico} />}
        </section>

        {paciente.alergias && (
          <div className="mb-6 rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Alergias</p>
            <p className="text-sm text-rose-800">{paciente.alergias}</p>
          </div>
        )}

        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">Prescripción</h2>
        <ol className="mb-8 space-y-4">
          {receta.items.map((item, indice) => (
            <li key={item.id} className="border-l-4 border-slate-800 pl-4">
              <p className="font-semibold text-slate-900">
                {indice + 1}. {item.medicamento}
                {item.presentacion && <span className="font-normal text-slate-600"> — {item.presentacion}</span>}
              </p>
              {item.principioActivo && (
                <p className="text-sm italic text-slate-500">({item.principioActivo})</p>
              )}
              <p className="mt-1 text-sm text-slate-700">
                {[
                  item.dosis && `Dosis: ${item.dosis}`,
                  item.via && `Vía: ${item.via.toLowerCase()}`,
                  item.frecuencia,
                  item.duracion,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.cantidad && <p className="text-sm text-slate-600">Cantidad: {item.cantidad}</p>}
              {item.indicaciones && <p className="text-sm text-slate-600">{item.indicaciones}</p>}
            </li>
          ))}
        </ol>

        {receta.indicacionesGenerales && (
          <section className="mb-8 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Indicaciones generales</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{receta.indicacionesGenerales}</p>
          </section>
        )}

        <footer className="mt-12 flex items-end justify-between gap-6">
          <div className="text-xs text-slate-500">
            {receta.vigenteHasta && <p>Vigente hasta el {fechaCorta(receta.vigenteHasta)}.</p>}
            {receta.atencion && <p>Asociada a la atención del {fechaCorta(receta.atencion.fecha)}.</p>}
            {receta.firmadaAt && <p>Firmada digitalmente el {fechaCorta(receta.firmadaAt)}.</p>}
          </div>

          <div className="w-64 text-center">
            <div className="border-t border-slate-800 pt-1">
              <p className="text-sm font-semibold text-slate-900">
                {receta.profesional.nombres} {receta.profesional.apellidos}
              </p>
              <p className="text-xs text-slate-600">{receta.profesional.especialidad}</p>
              <p className="text-xs text-slate-600">RUT {formatearRut(receta.profesional.rut)}</p>
              {receta.profesional.registroSuperintendencia && (
                <p className="text-xs text-slate-600">Reg. Nº {receta.profesional.registroSuperintendencia}</p>
              )}
            </div>
          </div>
        </footer>

        {receta.anulada && (
          <div className="pointer-events-none mt-6 rotate-[-8deg] text-center text-4xl font-black uppercase tracking-widest text-rose-200">
            Anulada
          </div>
        )}
      </article>

      <p className="no-imprimir mt-4 text-center text-xs text-slate-400">
        Usa Ctrl/Cmd + P para imprimir la receta o guardarla como PDF.
      </p>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-semibold text-slate-500">{etiqueta}:</span>
      <span className="text-slate-800">{valor}</span>
    </div>
  );
}
