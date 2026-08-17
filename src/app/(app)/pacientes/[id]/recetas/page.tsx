import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { fechaCorta, humanizar } from '@/lib/format';
import { Badge, ContenedorTabla, EncabezadoPagina, EnlaceBoton, EstadoVacio, Tarjeta } from '@/components/ui';

import { CabeceraPaciente } from '../cabecera';

export default async function RecetasPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('recetas', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const recetas = await prisma.receta.findMany({
    where: { pacienteId: id },
    orderBy: { fecha: 'desc' },
    include: {
      profesional: { select: { nombres: true, apellidos: true, especialidad: true } },
      items: { orderBy: { orden: 'asc' } },
    },
  });

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}/recetas`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
      />

      <div className="mb-4 flex justify-end">
        {puede(sesion, 'recetas', 'crear') && (
          <EnlaceBoton href={`/recetas/nueva?paciente=${id}`}>Nueva receta</EnlaceBoton>
        )}
      </div>

      {recetas.length === 0 ? (
        <EstadoVacio
          titulo="Sin recetas"
          descripcion="Las prescripciones que se emitan a este paciente quedarán registradas aquí."
          accion={
            puede(sesion, 'recetas', 'crear') && (
              <EnlaceBoton href={`/recetas/nueva?paciente=${id}`}>Nueva receta</EnlaceBoton>
            )
          }
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Profesional</th>
                <th>Tipo</th>
                <th>Medicamentos</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recetas.map((r) => {
                const vencida = r.vigenteHasta && r.vigenteHasta < new Date();
                return (
                  <tr key={r.id} className={r.anulada ? 'opacity-50' : ''}>
                    <td className="font-mono text-xs text-tinta-500">{r.folio}</td>
                    <td className="whitespace-nowrap text-tinta-600">{fechaCorta(r.fecha)}</td>
                    <td className="text-xs text-tinta-600">
                      {r.profesional.nombres} {r.profesional.apellidos}
                      <p className="text-tinta-400">{r.profesional.especialidad}</p>
                    </td>
                    <td>
                      <Badge tono={r.tipo === 'RETENIDA' ? 'ambar' : 'gris'}>{humanizar(r.tipo)}</Badge>
                    </td>
                    <td className="max-w-md text-xs text-tinta-600">
                      <ul className="space-y-0.5">
                        {r.items.map((i) => (
                          <li key={i.id}>
                            <strong>{i.medicamento}</strong>
                            {i.frecuencia && ` — ${i.frecuencia}`}
                            {i.duracion && ` ${i.duracion}`}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      {r.anulada ? (
                        <Badge tono="rojo">anulada</Badge>
                      ) : vencida ? (
                        <Badge tono="ambar">vencida</Badge>
                      ) : (
                        <Badge tono="verde">vigente</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <Link href={`/recetas/${r.id}`} className="text-sm text-brand-700 hover:underline">
                        Ver / imprimir
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
