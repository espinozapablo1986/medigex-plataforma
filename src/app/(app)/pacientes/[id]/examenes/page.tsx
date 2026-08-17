import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { fechaCorta, humanizar, isoFecha } from '@/lib/format';
import { tamanoLegible } from '@/lib/uploads';
import {
  Badge,
  BadgeEstado,
  Campo,
  ContenedorTabla,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { SubirArchivos } from '@/components/subir-archivos';

import { crearExamen, eliminarExamen, registrarResultadoExamen, subirArchivos } from '../../acciones';
import { CabeceraPaciente } from '../cabecera';

const TIPOS = [
  { valor: 'RADIOGRAFIA', texto: 'Radiografía' },
  { valor: 'LABORATORIO', texto: 'Laboratorio' },
  { valor: 'IMAGENOLOGIA', texto: 'Imagenología' },
  { valor: 'BIOPSIA', texto: 'Biopsia' },
  { valor: 'ELECTROCARDIOGRAMA', texto: 'Electrocardiograma' },
  { valor: 'OTRO', texto: 'Otro' },
];

export default async function ExamenesPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('historia_clinica', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [examenes, profesionales, atenciones] = await Promise.all([
    prisma.examen.findMany({
      where: { pacienteId: id },
      orderBy: { fechaSolicitud: 'desc' },
      include: {
        solicitadoPor: { select: { nombres: true, apellidos: true } },
        adjuntos: { select: { id: true, nombreOriginal: true, tamanoBytes: true, mimeType: true } },
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
    prisma.atencion.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      take: 20,
      select: { id: true, fecha: true, motivoConsulta: true },
    }),
  ]);

  const puedeCrear = puede(sesion, 'historia_clinica', 'crear');
  const puedeEditar = puede(sesion, 'historia_clinica', 'editar');
  const puedeEliminar = puede(sesion, 'historia_clinica', 'eliminar');

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}/examenes`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
      />

      <div className="mb-4 flex justify-end">
        {puedeCrear && (
          <Modal titulo="Solicitar examen" etiquetaBoton="Solicitar examen" ancho="max-w-2xl">
            <Formulario accion={crearExamen} className="space-y-4">
              <input type="hidden" name="pacienteId" value={id} />
              <Grilla cols={2}>
                <Campo etiqueta="Tipo de examen" requerido>
                  <select name="tipo" required className="campo">
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.texto}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Nombre del examen" requerido>
                  <input name="nombre" required placeholder="Radiografía panorámica" className="campo" />
                </Campo>
                <Campo etiqueta="Solicitado por">
                  <select name="solicitadoPorId" defaultValue={sesion.profesionalId ?? ''} className="campo">
                    <option value="">Sin especificar</option>
                    {profesionales.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.apellidos}, {p.nombres}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Fecha de solicitud">
                  <input name="fechaSolicitud" type="date" defaultValue={isoFecha(new Date())} className="campo" />
                </Campo>
                <Campo etiqueta="Laboratorio / centro">
                  <input name="laboratorio" className="campo" />
                </Campo>
                <Campo etiqueta="Asociar a una atención">
                  <select name="atencionId" className="campo">
                    <option value="">Sin asociar</option>
                    {atenciones.map((a) => (
                      <option key={a.id} value={a.id}>
                        {fechaCorta(a.fecha)} — {a.motivoConsulta.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </Grilla>
              <Campo etiqueta="Indicaciones / descripción">
                <textarea name="descripcion" rows={2} className="campo" />
              </Campo>
              <div className="flex justify-end">
                <BotonEnviar>Solicitar examen</BotonEnviar>
              </div>
            </Formulario>
          </Modal>
        )}
      </div>

      {examenes.length === 0 ? (
        <EstadoVacio
          titulo="Sin exámenes"
          descripcion="Registra los exámenes solicitados y adjunta sus resultados cuando lleguen."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Examen</th>
                <th>Tipo</th>
                <th>Solicitud</th>
                <th>Solicitado por</th>
                <th>Estado</th>
                <th>Resultado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {examenes.map((e) => (
                <tr key={e.id}>
                  <td>
                    <p className="font-medium text-tinta-800">{e.nombre}</p>
                    {e.laboratorio && <p className="text-xs text-tinta-400">{e.laboratorio}</p>}
                    {e.adjuntos.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.adjuntos.map((ad) => (
                          <a
                            key={ad.id}
                            href={`/api/adjuntos/${ad.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-tinta-200 px-1.5 py-0.5 text-xs text-brand-700 hover:bg-tinta-50"
                          >
                            {ad.nombreOriginal} ({tamanoLegible(ad.tamanoBytes)})
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge tono={e.tipo === 'RADIOGRAFIA' ? 'morado' : 'gris'}>{humanizar(e.tipo)}</Badge>
                  </td>
                  <td className="text-tinta-600">{fechaCorta(e.fechaSolicitud)}</td>
                  <td className="text-xs text-tinta-500">
                    {e.solicitadoPor ? `${e.solicitadoPor.nombres} ${e.solicitadoPor.apellidos}` : '—'}
                  </td>
                  <td>
                    <BadgeEstado estado={e.estado} />
                  </td>
                  <td className="max-w-sm text-xs text-tinta-600">
                    {e.resultado ? (
                      <>
                        <p className="whitespace-pre-wrap">{e.resultado}</p>
                        {e.interpretacion && <p className="mt-1 italic text-tinta-500">{e.interpretacion}</p>}
                      </>
                    ) : (
                      <span className="text-tinta-400">Pendiente</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && (
                        <Modal
                          titulo={`Resultado: ${e.nombre}`}
                          etiquetaBoton="Resultado"
                          varianteBoton="secundario"
                          tamanoBoton="sm"
                          ancho="max-w-xl"
                        >
                          <Formulario accion={registrarResultadoExamen} className="space-y-4">
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="pacienteId" value={id} />
                            <Campo etiqueta="Resultado" requerido>
                              <textarea name="resultado" rows={4} defaultValue={e.resultado ?? ''} required className="campo" />
                            </Campo>
                            <Campo etiqueta="Interpretación clínica">
                              <textarea name="interpretacion" rows={2} defaultValue={e.interpretacion ?? ''} className="campo" />
                            </Campo>
                            <Grilla cols={2}>
                              <Campo etiqueta="Fecha de realización">
                                <input name="fechaRealizacion" type="date" className="campo" />
                              </Campo>
                              <Campo etiqueta="Fecha del resultado">
                                <input name="fechaResultado" type="date" defaultValue={isoFecha(new Date())} className="campo" />
                              </Campo>
                            </Grilla>
                            <div className="flex justify-end">
                              <BotonEnviar>Guardar resultado</BotonEnviar>
                            </div>
                          </Formulario>
                        </Modal>
                      )}
                      {puedeCrear && (
                        <Modal
                          titulo="Adjuntar archivo al examen"
                          etiquetaBoton="Adjuntar"
                          varianteBoton="secundario"
                          tamanoBoton="sm"
                          ancho="max-w-lg"
                        >
                          <Formulario accion={subirArchivos} className="space-y-4">
                            <input type="hidden" name="pacienteId" value={id} />
                            <input type="hidden" name="examenId" value={e.id} />
                            <input type="hidden" name="categoria" value="EXAMEN" />
                            <Campo etiqueta="Archivos" requerido>
                              <SubirArchivos name="archivos" requerido etiquetaCamara="Fotografiar resultado" />
                            </Campo>
                            <Campo etiqueta="Descripción">
                              <input name="descripcion" className="campo" />
                            </Campo>
                            <div className="flex justify-end">
                              <BotonEnviar>Subir</BotonEnviar>
                            </div>
                          </Formulario>
                        </Modal>
                      )}
                      {puedeEliminar && <BotonEliminar accion={eliminarExamen} id={e.id} variante="peligro" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}
    </>
  );
}
