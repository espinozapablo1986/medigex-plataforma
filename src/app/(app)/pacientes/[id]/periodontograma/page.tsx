import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { fechaCorta, isoFecha } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { CabeceraPaciente } from '../cabecera';
import { crearPeriodontograma } from './acciones';

export const metadata = { title: 'Periodontograma' };

export default async function PaginaPeriodontogramas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('periodontograma', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [examenes, atenciones] = await Promise.all([
    prisma.periodontograma.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      include: {
        profesional: { select: { nombres: true, apellidos: true } },
        piezas: { include: { sitios: true } },
      },
    }),
    prisma.atencion.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      take: 15,
      select: { id: true, fecha: true, motivoConsulta: true },
    }),
  ]);

  const resumen = (examen: (typeof examenes)[number]) => {
    const presentes = examen.piezas.filter((p) => !p.ausente);
    const sitios = presentes.flatMap((p) => p.sitios);
    if (sitios.length === 0) return { sangrado: 0, placa: 0, bolsas: 0, presentes: presentes.length };
    return {
      sangrado: Math.round((sitios.filter((s) => s.sangrado).length / sitios.length) * 100),
      placa: Math.round((sitios.filter((s) => s.placa).length / sitios.length) * 100),
      bolsas: sitios.filter((s) => s.profundidad >= 4).length,
      presentes: presentes.length,
    };
  };

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}/periodontograma`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
        modulosDentales={{
          odontograma: puede(sesion, 'odontograma', 'ver'),
          periodontograma: puede(sesion, 'periodontograma', 'ver'),
        }}
      />

      <EncabezadoPagina
        ayuda="periodontograma"
        titulo="Periodontograma"
        descripcion="Exámenes periodontales del paciente. Cada uno queda con su fecha para poder comparar la evolución."
        acciones={
          puede(sesion, 'periodontograma', 'crear') && (
            <Modal titulo="Nuevo periodontograma" etiquetaBoton="Nuevo examen" ancho="max-w-lg">
              <Formulario accion={crearPeriodontograma} className="space-y-4">
                <input type="hidden" name="pacienteId" value={id} />
                <p className="text-sm text-tinta-600">
                  Se crea la ficha completa con las piezas en cero para ir corrigiendo sólo lo que difiere.
                </p>
                <Grilla cols={2}>
                  <Campo etiqueta="Fecha del examen">
                    <input name="fecha" type="date" defaultValue={isoFecha(new Date())} className="campo" />
                  </Campo>
                  <Campo etiqueta="Dentición">
                    <select name="denticion" defaultValue="PERMANENTE" className="campo">
                      <option value="PERMANENTE">Permanente</option>
                      <option value="TEMPORAL">Temporal</option>
                    </select>
                  </Campo>
                </Grilla>
                <Campo etiqueta="Asociar a atención">
                  <select name="atencionId" className="campo">
                    <option value="">Sin asociar</option>
                    {atenciones.map((a) => (
                      <option key={a.id} value={a.id}>
                        {fechaCorta(a.fecha)} — {a.motivoConsulta.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Observaciones">
                  <textarea name="observaciones" rows={2} className="campo" />
                </Campo>
                <div className="flex justify-end">
                  <BotonEnviar>Crear examen</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {examenes.length === 0 ? (
        <EstadoVacio
          titulo="Sin exámenes periodontales"
          descripcion="Crea el primero para registrar sondaje, margen gingival, placa, sangrado y furca de cada pieza."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Profesional</th>
                <th className="text-right">Piezas presentes</th>
                <th className="text-right">Placa</th>
                <th className="text-right">Sangrado</th>
                <th className="text-right">Bolsas ≥ 4 mm</th>
                <th>Observaciones</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {examenes.map((e) => {
                const r = resumen(e);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap font-medium">{fechaCorta(e.fecha)}</td>
                    <td className="text-xs text-tinta-600">
                      {e.profesional ? `${e.profesional.nombres} ${e.profesional.apellidos}` : '—'}
                    </td>
                    <td className="text-right tabular-nums">{r.presentes}</td>
                    <td className="text-right tabular-nums">
                      <Badge tono={r.placa > 20 ? 'ambar' : 'verde'}>{r.placa}%</Badge>
                    </td>
                    <td className="text-right tabular-nums">
                      <Badge tono={r.sangrado > 10 ? 'rojo' : 'verde'}>{r.sangrado}%</Badge>
                    </td>
                    <td className="text-right tabular-nums">
                      {r.bolsas > 0 ? <span className="font-semibold text-error">{r.bolsas}</span> : '0'}
                    </td>
                    <td className="max-w-xs truncate text-xs text-tinta-600">{e.observaciones ?? '—'}</td>
                    <td className="text-right">
                      <Link
                        href={`/pacientes/${id}/periodontograma/${e.id}`}
                        className="text-sm text-brand-700 hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}
    </>
  );
}
