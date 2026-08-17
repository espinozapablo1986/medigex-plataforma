import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { fechaHora, humanizar } from '@/lib/format';
import { esImagen, tamanoLegible } from '@/lib/uploads';
import { Badge, Campo, EstadoVacio, Grilla, Tarjeta } from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { SubirArchivos } from '@/components/subir-archivos';

import { borrarArchivo, subirArchivos } from '../../acciones';
import { CabeceraPaciente } from '../cabecera';

const CATEGORIAS = [
  { valor: 'FOTOGRAFIA', texto: 'Fotografía clínica' },
  { valor: 'RADIOGRAFIA', texto: 'Radiografía' },
  { valor: 'EXAMEN', texto: 'Examen' },
  { valor: 'DOCUMENTO', texto: 'Documento' },
  { valor: 'CONSENTIMIENTO', texto: 'Consentimiento informado' },
  { valor: 'OTRO', texto: 'Otro' },
];

export default async function ArchivosPaciente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { id } = await params;
  const { categoria } = await searchParams;
  const sesion = await requerirPermiso('historia_clinica', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [adjuntos, atenciones] = await Promise.all([
    prisma.adjunto.findMany({
      where: {
        pacienteId: id,
        ...(categoria ? { categoria: categoria as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subidoPor: { select: { nombres: true, apellidos: true } },
        atencion: { select: { id: true, fecha: true, motivoConsulta: true } },
        examen: { select: { nombre: true } },
      },
    }),
    prisma.atencion.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      take: 20,
      select: { id: true, fecha: true, motivoConsulta: true },
    }),
  ]);

  const puedeCrear = puede(sesion, 'historia_clinica', 'crear');
  const puedeEliminar = puede(sesion, 'historia_clinica', 'eliminar');

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}/archivos`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-3">
          <Campo etiqueta="Categoría" className="w-56">
            <select name="categoria" defaultValue={categoria ?? ''} className="campo">
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </Campo>
          <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
            Filtrar
          </button>
        </form>

        {puedeCrear && (
          <Modal titulo="Subir archivos" etiquetaBoton="Subir archivos" ancho="max-w-lg">
            <Formulario accion={subirArchivos} className="space-y-4">
              <input type="hidden" name="pacienteId" value={id} />
              <Campo
                etiqueta="Archivos"
                requerido
                ayuda="Las fotos se optimizan en el teléfono antes de subirlas, sin perder calidad visible."
              >
                <SubirArchivos name="archivos" requerido />
              </Campo>
              <Grilla cols={2}>
                <Campo etiqueta="Categoría" requerido>
                  <select name="categoria" required className="campo">
                    {CATEGORIAS.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.texto}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Asociar a atención">
                  <select name="atencionId" className="campo">
                    <option value="">Sin asociar</option>
                    {atenciones.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fecha.toLocaleDateString('es-CL')} — {a.motivoConsulta.slice(0, 30)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </Grilla>
              <Campo etiqueta="Descripción">
                <input name="descripcion" className="campo" placeholder="Ej: control post operatorio, cara vestibular" />
              </Campo>
              <div className="flex justify-end">
                <BotonEnviar>Subir archivos</BotonEnviar>
              </div>
            </Formulario>
          </Modal>
        )}
      </div>

      {adjuntos.length === 0 ? (
        <EstadoVacio
          titulo="Sin archivos"
          descripcion="Sube fotografías, radiografías, consentimientos y cualquier documento del paciente."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {adjuntos.map((a) => (
            <figure key={a.id} className="tarjeta overflow-hidden">
              <a href={`/api/adjuntos/${a.id}`} target="_blank" rel="noreferrer" className="block">
                {esImagen(a.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/adjuntos/${a.id}`}
                    alt={a.descripcion ?? a.nombreOriginal}
                    className="h-40 w-full bg-tinta-100 object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-tinta-100 text-4xl text-tinta-300">
                    {a.mimeType.includes('pdf') ? 'PDF' : 'DOC'}
                  </div>
                )}
              </a>
              <figcaption className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-tinta-800" title={a.nombreOriginal}>
                    {a.nombreOriginal}
                  </p>
                  <Badge tono={a.categoria === 'RADIOGRAFIA' ? 'morado' : 'gris'}>{humanizar(a.categoria)}</Badge>
                </div>
                {a.descripcion && <p className="text-xs text-tinta-500">{a.descripcion}</p>}
                {a.atencion && (
                  <p className="text-xs text-brand-600">Atención del {a.atencion.fecha.toLocaleDateString('es-CL')}</p>
                )}
                {a.examen && <p className="text-xs text-brand-600">Examen: {a.examen.nombre}</p>}
                <p className="text-xs text-tinta-400">
                  {tamanoLegible(a.tamanoBytes)} · {fechaHora(a.createdAt)}
                  {a.subidoPor && ` · ${a.subidoPor.nombres} ${a.subidoPor.apellidos}`}
                </p>
                {puedeEliminar && (
                  <div className="pt-1">
                    <BotonEliminar
                      accion={borrarArchivo}
                      id={a.id}
                      variante="secundario"
                      mensaje={`¿Eliminar "${a.nombreOriginal}"? Se borrará del servidor.`}
                    />
                  </div>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
