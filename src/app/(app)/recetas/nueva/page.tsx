import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { fechaCorta, isoFecha } from '@/lib/format';
import { Aviso, Campo, EncabezadoPagina, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { crearReceta } from '../acciones';
import { EditorMedicamentos } from '../editor-medicamentos';
import { SelectorBuscable } from '@/components/selector';

export const metadata = { title: 'Nueva receta' };

const TIPOS = [
  { valor: 'SIMPLE', texto: 'Receta simple' },
  { valor: 'RETENIDA', texto: 'Receta retenida' },
  { valor: 'CHEQUE_MEDICO', texto: 'Cheque médico' },
  { valor: 'MAGISTRAL', texto: 'Receta magistral' },
];

export default async function PaginaNuevaReceta({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; atencion?: string }>;
}) {
  const sesion = await requerirPermiso('recetas', 'crear');
  const { paciente: pacienteId, atencion: atencionId } = await searchParams;

  const [pacientes, profesionales, pacienteSeleccionado] = await Promise.all([
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: { apellidoPaterno: 'asc' },
      take: 500,
      select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, rut: true, numeroFicha: true },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true, registroSuperintendencia: true },
    }),
    pacienteId
      ? prisma.paciente.findUnique({
          where: { id: pacienteId },
          include: {
            atenciones: {
              orderBy: { fecha: 'desc' },
              take: 10,
              select: { id: true, fecha: true, motivoConsulta: true, diagnostico: true },
            },
          },
        })
      : null,
  ]);

  const vigencia = new Date();
  vigencia.setMonth(vigencia.getMonth() + 6);

  return (
    <>
      <EncabezadoPagina
        titulo="Nueva receta"
        descripcion="La receta queda registrada en la historia clínica del paciente y se puede imprimir o guardar en PDF."
        volver={{ href: '/recetas', texto: 'Recetas' }}
      />

      {pacienteSeleccionado?.alergias && (
        <div className="mb-4">
          <Aviso tono="error" titulo="Alergias del paciente">
            {pacienteSeleccionado.alergias}
          </Aviso>
        </div>
      )}

      {pacienteSeleccionado?.medicamentosActuales && (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="Medicamentos que ya toma">
            {pacienteSeleccionado.medicamentosActuales}
          </Aviso>
        </div>
      )}

      <Formulario accion={crearReceta} className="space-y-5">
        <Tarjeta titulo="Datos de la receta">
          <Grilla cols={2}>
            <Campo etiqueta="Paciente" requerido>
              <SelectorBuscable
                name="pacienteId"
                opciones={pacientes.map((p) => ({
                  valor: p.id,
                  etiqueta: `${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}, ${p.nombres}`.replace(/\s+/g, ' '),
                  detalle: p.rut ?? `Ficha ${p.numeroFicha}`,
                  buscarPor: p.rut ?? '',
                }))}
                valorInicial={pacienteId}
                placeholder="Busca por nombre o RUT…"
                permiteVacio={false}
                requerido
              />
            </Campo>

            <Campo etiqueta="Profesional que prescribe" requerido>
              <SelectorBuscable
                name="profesionalId"
                opciones={profesionales.map((p) => ({
                  valor: p.id,
                  etiqueta: `${p.apellidos}, ${p.nombres}`,
                  detalle: p.especialidad,
                }))}
                valorInicial={sesion.profesionalId}
                placeholder="Busca por nombre o especialidad…"
                permiteVacio={false}
                requerido
              />
            </Campo>

            <Campo etiqueta="Tipo de receta" requerido>
              <select name="tipo" defaultValue="SIMPLE" required className="campo">
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Fecha">
              <input name="fecha" type="date" defaultValue={isoFecha(new Date())} className="campo" />
            </Campo>

            <Campo etiqueta="Vigente hasta" ayuda="Por defecto, 6 meses.">
              <input name="vigenteHasta" type="date" defaultValue={isoFecha(vigencia)} className="campo" />
            </Campo>

            {pacienteSeleccionado && pacienteSeleccionado.atenciones.length > 0 && (
              <Campo etiqueta="Asociar a una atención">
                <select name="atencionId" defaultValue={atencionId ?? ''} className="campo">
                  <option value="">Sin asociar</option>
                  {pacienteSeleccionado.atenciones.map((a) => (
                    <option key={a.id} value={a.id}>
                      {fechaCorta(a.fecha)} — {a.motivoConsulta.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </Grilla>

          <Campo
            etiqueta="Diagnóstico"
            ayuda="Obligatorio en recetas retenidas y cheques médicos."
            className="mt-4"
          >
            <input
              name="diagnostico"
              defaultValue={pacienteSeleccionado?.atenciones[0]?.diagnostico ?? ''}
              className="campo"
            />
          </Campo>

          <Campo etiqueta="Indicaciones generales" className="mt-4">
            <textarea
              name="indicacionesGenerales"
              rows={2}
              placeholder="Reposo relativo, abundante líquido, control en 7 días…"
              className="campo"
            />
          </Campo>
        </Tarjeta>

        <Tarjeta titulo="Medicamentos">
          <EditorMedicamentos />
        </Tarjeta>

        <div className="sticky bottom-4 flex justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <BotonEnviar tamano="lg">Emitir receta</BotonEnviar>
          </div>
        </div>
      </Formulario>
    </>
  );
}
