import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { fechaCorta, humanizar } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { crearContacto } from '../acciones';

export const metadata = { title: 'Interesados' };

const ORIGENES = [
  { valor: 'RECOMENDACION', texto: 'Recomendación de un paciente' },
  { valor: 'INSTAGRAM', texto: 'Instagram' },
  { valor: 'FACEBOOK', texto: 'Facebook' },
  { valor: 'GOOGLE', texto: 'Búsqueda en Google' },
  { valor: 'SITIO_WEB', texto: 'Sitio web' },
  { valor: 'WHATSAPP', texto: 'WhatsApp' },
  { valor: 'PASABA_POR_FUERA', texto: 'Pasaba por fuera' },
  { valor: 'CONVENIO_EMPRESA', texto: 'Convenio de empresa' },
  { valor: 'DERIVACION', texto: 'Derivación' },
  { valor: 'CAMPANA', texto: 'Campaña publicitaria' },
  { valor: 'OTRO', texto: 'Otro' },
];

const TONO_ESTADO_CONTACTO: Record<string, 'gris' | 'azul' | 'ambar' | 'verde' | 'rojo' | 'morado'> = {
  NUEVO: 'azul',
  CONTACTADO: 'gris',
  INTERESADO: 'ambar',
  AGENDADO: 'morado',
  CONVERTIDO: 'verde',
  PERDIDO: 'rojo',
};

export default async function PaginaContactos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; origen?: string; q?: string }>;
}) {
  const sesion = await requerirPermiso('crm', 'ver');
  const { estado, origen, q } = await searchParams;

  const where = {
    ...(estado ? { estado: estado as never } : {}),
    ...(origen ? { origen: origen as never } : {}),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { telefono: { contains: q } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [contactos, porEstado, usuarios] = await Promise.all([
    prisma.contacto.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        asignadoA: { select: { nombres: true, apellidos: true } },
        paciente: { select: { id: true, numeroFicha: true } },
        _count: { select: { interacciones: true, seguimientos: true } },
      },
    }),
    prisma.contacto.groupBy({ by: ['estado'], _count: true }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
  ]);

  const cuenta = (e: string) => porEstado.find((p) => p.estado === e)?._count ?? 0;
  const total = porEstado.reduce((acc, p) => acc + p._count, 0);
  const convertidos = cuenta('CONVERTIDO');
  const cerrados = convertidos + cuenta('PERDIDO');
  const tasaConversion = cerrados > 0 ? Math.round((convertidos / cerrados) * 100) : 0;

  const puedeCrear = puede(sesion, 'crm', 'crear');

  return (
    <>
      <EncabezadoPagina
        titulo="Interesados"
        descripcion="Personas que preguntaron por atención y todavía no son pacientes."
        volver={{ href: '/crm', texto: 'CRM y seguimiento' }}
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo interesado" etiquetaBoton="Nuevo interesado" ancho="max-w-xl">
              <Formulario accion={crearContacto} className="space-y-4">
                <Grilla cols={2}>
                  <Campo etiqueta="Nombre" requerido>
                    <input name="nombre" required className="campo" />
                  </Campo>
                  <Campo etiqueta="Teléfono">
                    <input name="telefono" className="campo" placeholder="+56 9 …" />
                  </Campo>
                  <Campo etiqueta="Correo">
                    <input name="email" type="email" className="campo" />
                  </Campo>
                  <Campo etiqueta="RUT">
                    <input name="rut" className="campo" />
                  </Campo>
                  <Campo etiqueta="¿Cómo llegó?" requerido>
                    <select name="origen" required className="campo">
                      {ORIGENES.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.texto}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Asignar a">
                    <select name="asignadoAId" defaultValue={sesion.usuarioId} className="campo">
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.apellidos}, {u.nombres}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </Grilla>

                <Campo etiqueta="¿Qué está buscando?" ayuda="Lo que preguntó: implante, ortodoncia, limpieza…">
                  <input name="interes" className="campo" />
                </Campo>

                <Campo etiqueta="Observaciones">
                  <textarea name="observaciones" rows={2} className="campo" />
                </Campo>

                <Campo
                  etiqueta="Crear seguimiento en"
                  ayuda="Se agenda automáticamente la tarea de contactarlo, para que no se pierda."
                >
                  <select name="diasSeguimiento" defaultValue="2" className="campo">
                    <option value="0">Hoy mismo</option>
                    <option value="1">Mañana</option>
                    <option value="2">En 2 días</option>
                    <option value="7">En una semana</option>
                    <option value="-1">No crear seguimiento</option>
                  </select>
                </Campo>

                <div className="flex justify-end">
                  <BotonEnviar>Registrar interesado</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Interesados registrados" valor={String(total)} />
        <Metrica etiqueta="Sin contactar" valor={String(cuenta('NUEVO'))} tono={cuenta('NUEVO') > 0 ? 'alerta' : 'neutro'} />
        <Metrica etiqueta="Convertidos" valor={String(convertidos)} tono="positivo" />
        <Metrica
          etiqueta="Tasa de conversión"
          valor={`${tasaConversion}%`}
          detalle="Sobre los interesados ya cerrados"
          tono="marca"
        />
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar" className="w-56">
          <input name="q" defaultValue={q ?? ''} placeholder="Nombre, teléfono o correo" className="campo" />
        </Campo>
        <Campo etiqueta="Estado" className="w-44">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="NUEVO">Nuevo</option>
            <option value="CONTACTADO">Contactado</option>
            <option value="INTERESADO">Interesado</option>
            <option value="AGENDADO">Agendado</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>
        </Campo>
        <Campo etiqueta="Origen" className="w-52">
          <select name="origen" defaultValue={origen ?? ''} className="campo">
            <option value="">Todos</option>
            {ORIGENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </Campo>
        <button
          type="submit"
          className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50"
        >
          Filtrar
        </button>
      </form>

      {contactos.length === 0 ? (
        <EstadoVacio
          titulo="Sin interesados registrados"
          descripcion="Cada vez que alguien llame o escriba preguntando por atención, regístralo aquí para hacerle seguimiento."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Interesado</th>
                <th>Contacto</th>
                <th>Origen</th>
                <th>Busca</th>
                <th>Responsable</th>
                <th className="text-right">Gestiones</th>
                <th>Estado</th>
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              {contactos.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/crm/contactos/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.nombre}
                    </Link>
                    {c.paciente && (
                      <p className="text-xs text-emerald-600">Ficha Nº {c.paciente.numeroFicha}</p>
                    )}
                  </td>
                  <td className="text-xs text-tinta-500">
                    {c.telefono ?? '—'}
                    {c.email && <div>{c.email}</div>}
                  </td>
                  <td className="text-xs text-tinta-600">{humanizar(c.origen)}</td>
                  <td className="max-w-xs truncate text-xs text-tinta-600" title={c.interes ?? ''}>
                    {c.interes ?? '—'}
                  </td>
                  <td className="text-xs text-tinta-600">
                    {c.asignadoA ? `${c.asignadoA.nombres} ${c.asignadoA.apellidos}` : '—'}
                  </td>
                  <td className="text-right text-xs tabular-nums text-tinta-500">
                    {c._count.interacciones} contacto(s)
                    {c._count.seguimientos > 0 && <p>{c._count.seguimientos} tarea(s)</p>}
                  </td>
                  <td>
                    <Badge tono={TONO_ESTADO_CONTACTO[c.estado] ?? 'gris'}>{humanizar(c.estado)}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-xs text-tinta-500">{fechaCorta(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}
    </>
  );
}
