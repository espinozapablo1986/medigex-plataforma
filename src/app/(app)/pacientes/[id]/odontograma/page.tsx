import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { buscarPieza, nombreCara, type Cara } from '@/lib/dental';
import { fechaCorta } from '@/lib/format';
import {
  Aviso,
  Badge,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Metrica,
  Pestanas,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario } from '@/components/formulario';

import { CabeceraPaciente } from '../cabecera';
import { EsquemaOdontograma } from './esquema';
import { completarPendiente, eliminarRegistroOdontograma, presupuestarPendientes } from './acciones';

export const metadata = { title: 'Odontograma' };

export default async function PaginaOdontograma({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ denticion?: string }>;
}) {
  const { id } = await params;
  const { denticion: denticionParam } = await searchParams;
  const denticion = denticionParam === 'TEMPORAL' ? 'TEMPORAL' : 'PERMANENTE';

  const sesion = await requerirPermiso('odontograma', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [registros, condiciones, atenciones] = await Promise.all([
    prisma.registroOdontograma.findMany({
      where: { pacienteId: id, denticion },
      orderBy: { fecha: 'desc' },
      include: {
        condicion: { select: { nombre: true, color: true, categoria: true, servicioId: true } },
        profesional: { select: { nombres: true, apellidos: true } },
      },
    }),
    prisma.condicionDental.findMany({
      where: { activo: true },
      orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
      include: { servicio: { select: { id: true } } },
    }),
    prisma.atencion.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      take: 15,
      select: { id: true, fecha: true, motivoConsulta: true },
    }),
  ]);

  const puedeEditar = puede(sesion, 'odontograma', 'editar');
  const puedeCrear = puede(sesion, 'odontograma', 'crear');

  const activos = registros.filter((r) => r.estado !== 'ANULADO');
  const pendientes = activos.filter((r) => r.estado === 'PENDIENTE');
  const diagnosticos = activos.filter((r) => r.condicion.categoria === 'DIAGNOSTICO');
  const procedimientos = activos.filter((r) => r.condicion.categoria === 'PROCEDIMIENTO' && r.estado === 'REALIZADO');
  const piezasIntervenidas = new Set(activos.map((r) => r.pieza)).size;
  const pendientesPresupuestables = pendientes.filter((r) => r.condicion.servicioId).length;

  const base = `/pacientes/${id}/odontograma`;

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={base}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
        modulosDentales={{
          odontograma: puede(sesion, 'odontograma', 'ver'),
          periodontograma: puede(sesion, 'periodontograma', 'ver'),
        }}
      />

      <EncabezadoPagina
        titulo="Odontograma"
        descripcion="Registro de lo encontrado y lo realizado en cada pieza y cara."
        acciones={
          <Pestanas
            activo={`${base}?denticion=${denticion}`}
            items={[
              { href: `${base}?denticion=PERMANENTE`, texto: 'Permanente' },
              { href: `${base}?denticion=TEMPORAL`, texto: 'Temporal' },
            ]}
          />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Piezas con registro" valor={String(piezasIntervenidas)} />
        <Metrica etiqueta="Diagnósticos" valor={String(diagnosticos.length)} tono={diagnosticos.length > 0 ? 'alerta' : 'neutro'} />
        <Metrica etiqueta="Procedimientos realizados" valor={String(procedimientos.length)} tono="positivo" />
        <Metrica
          etiqueta="Pendientes"
          valor={String(pendientes.length)}
          tono={pendientes.length > 0 ? 'negativo' : 'positivo'}
          detalle={pendientes.length > 0 ? `${pendientesPresupuestables} presupuestables` : 'Nada por hacer'}
        />
      </div>

      {condiciones.length === 0 ? (
        <Aviso tono="alerta" titulo="Falta el catálogo de condiciones dentales">
          Para poder marcar el odontograma hay que cargar los diagnósticos y procedimientos en{' '}
          <Link href="/configuracion" className="underline">
            Configuración → Condiciones dentales
          </Link>
          .
        </Aviso>
      ) : (
        <EsquemaOdontograma
          pacienteId={id}
          denticion={denticion}
          puedeEditar={puedeCrear}
          condiciones={condiciones.map((c) => ({
            id: c.id,
            codigo: c.codigo,
            nombre: c.nombre,
            categoria: c.categoria,
            color: c.color,
            porCara: c.porCara,
            tieneServicio: Boolean(c.servicioId),
          }))}
          registros={activos.map((r) => ({
            id: r.id,
            pieza: r.pieza,
            caras: r.caras,
            estado: r.estado,
            fecha: fechaCorta(r.fecha),
            observaciones: r.observaciones,
            condicion: { nombre: r.condicion.nombre, color: r.condicion.color, categoria: r.condicion.categoria },
            profesional: r.profesional ? `${r.profesional.nombres} ${r.profesional.apellidos}` : null,
          }))}
          atenciones={atenciones.map((a) => ({
            id: a.id,
            etiqueta: `${fechaCorta(a.fecha)} — ${a.motivoConsulta.slice(0, 40)}`,
          }))}
        />
      )}

      {/* ── Pendientes ── */}
      {pendientes.length > 0 && (
        <Tarjeta
          titulo={`Procedimientos pendientes (${pendientes.length})`}
          descripcion="Lo que quedó marcado por hacer en el esquema."
          className="mt-5"
          sinPadding
          acciones={
            pendientesPresupuestables > 0 &&
            puede(sesion, 'presupuestos', 'crear') && (
              <Formulario accion={presupuestarPendientes}>
                <input type="hidden" name="pacienteId" value={id} />
                <BotonEnviar tamano="sm">Armar presupuesto ({pendientesPresupuestables})</BotonEnviar>
              </Formulario>
            )
          }
        >
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Pieza</th>
                <th>Procedimiento</th>
                <th>Caras</th>
                <th>Marcado</th>
                <th>Observaciones</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((r) => {
                const pieza = buscarPieza(r.pieza);
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs font-semibold">{r.pieza}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: r.condicion.color }}
                        />
                        {r.condicion.nombre}
                      </span>
                      {!r.condicion.servicioId && (
                        <p className="text-xs text-alerta-texto">sin servicio asociado</p>
                      )}
                    </td>
                    <td className="text-xs text-tinta-600">
                      {r.caras.includes('PIEZA_COMPLETA')
                        ? 'Pieza completa'
                        : r.caras.map((c) => nombreCara(c as Cara, pieza)).join(', ')}
                    </td>
                    <td className="whitespace-nowrap text-xs text-tinta-600">{fechaCorta(r.fecha)}</td>
                    <td className="text-xs text-tinta-600">{r.observaciones ?? '—'}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {puedeEditar && (
                          <BotonEliminar
                            accion={completarPendiente}
                            id={r.id}
                            texto="Marcar realizado"
                            mensaje={`¿Confirmas que se realizó ${r.condicion.nombre} en la pieza ${r.pieza}?`}
                          />
                        )}
                        {puede(sesion, 'odontograma', 'eliminar') && (
                          <BotonEliminar accion={eliminarRegistroOdontograma} id={r.id} variante="peligro" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}

      {/* ── Historial ── */}
      <Tarjeta titulo="Historial de la ficha" className="mt-5" sinPadding>
        {activos.length === 0 ? (
          <div className="p-4">
            <EstadoVacio
              titulo="Sin registros en el odontograma"
              descripcion="Elige una condición del catálogo y marca las caras afectadas en el esquema."
            />
          </div>
        ) : (
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pieza</th>
                <th>Caras</th>
                <th>Condición</th>
                <th>Tipo</th>
                <th>Profesional</th>
                <th>Observaciones</th>
                {puede(sesion, 'odontograma', 'eliminar') && <th />}
              </tr>
            </thead>
            <tbody>
              {activos.map((r) => {
                const pieza = buscarPieza(r.pieza);
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-tinta-600">{fechaCorta(r.fecha)}</td>
                    <td className="font-mono text-xs font-semibold">{r.pieza}</td>
                    <td className="text-xs text-tinta-600">
                      {r.caras.includes('PIEZA_COMPLETA')
                        ? '—'
                        : r.caras.map((c) => nombreCara(c as Cara, pieza)).join(', ')}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: r.condicion.color }}
                        />
                        {r.condicion.nombre}
                      </span>
                    </td>
                    <td>
                      <Badge tono={r.condicion.categoria === 'DIAGNOSTICO' ? 'ambar' : 'verde'}>
                        {r.condicion.categoria === 'DIAGNOSTICO' ? 'diagnóstico' : 'procedimiento'}
                      </Badge>
                      {r.estado === 'PENDIENTE' && <Badge tono="rojo">pendiente</Badge>}
                    </td>
                    <td className="text-xs text-tinta-600">
                      {r.profesional ? `${r.profesional.nombres} ${r.profesional.apellidos}` : '—'}
                    </td>
                    <td className="text-xs text-tinta-600">{r.observaciones ?? '—'}</td>
                    {puede(sesion, 'odontograma', 'eliminar') && (
                      <td className="text-right">
                        <BotonEliminar accion={eliminarRegistroOdontograma} id={r.id} variante="peligro" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </ContenedorTabla>
        )}
      </Tarjeta>
    </>
  );
}
