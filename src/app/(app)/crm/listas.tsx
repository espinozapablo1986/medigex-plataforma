'use client';

import { useState } from 'react';
import { MessageCircle, Phone } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Campo, EstadoVacio, Grilla } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { agendarSeguimientosEnLote } from './acciones';

export interface FilaLista {
  pacienteId: string;
  nombre: string;
  telefono: string;
  email: string | null;
  detalle: string;
  dias: number;
  monto?: number;
}

function clp(monto: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto);
}

/**
 * Compone el mensaje a partir de una plantilla de texto.
 *
 * La plantilla llega como **cadena**, no como función: React no puede
 * serializar una función al pasar del servidor a un componente de cliente, y
 * al intentarlo la página entera fallaba al renderizar.
 */
function componerMensaje(plantilla: string, fila: FilaLista) {
  return plantilla
    .replace(/\{nombre\}/g, fila.nombre.split(' ')[0] ?? fila.nombre)
    .replace(/\{monto\}/g, clp(fila.monto ?? 0));
}

function enlaceWhatsapp(telefono: string, mensaje: string) {
  const numero = telefono.replace(/[^\d]/g, '');
  const internacional = numero.startsWith('56') ? numero : `56${numero.replace(/^0+/, '')}`;
  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Lista inteligente con selección múltiple: se marcan pacientes y se generan
 * las tareas de seguimiento de una sola vez, o se abre WhatsApp con el
 * mensaje ya escrito para llamar uno por uno.
 */
export function ListaRecall({
  filas,
  tipo,
  tituloTarea,
  plantilla,
  usuarios,
  mostrarMonto,
  vacio,
}: {
  filas: FilaLista[];
  tipo: string;
  tituloTarea: string;
  /** Texto del mensaje; admite los marcadores {nombre} y {monto}. */
  plantilla: string;
  usuarios: { id: string; nombre: string }[];
  mostrarMonto?: boolean;
  vacio: string;
}) {
  const [marcados, setMarcados] = useState<string[]>([]);

  if (filas.length === 0) {
    return <EstadoVacio titulo="Nada pendiente aquí" descripcion={vacio} />;
  }

  const alternar = (id: string) =>
    setMarcados((previo) => (previo.includes(id) ? previo.filter((x) => x !== id) : [...previo, id]));

  const todos = marcados.length === filas.length;

  return (
    <div className="space-y-3">
      <div className="scroll-fino max-h-[26rem] overflow-y-auto rounded-lg border border-tinta-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-tinta-50">
            <tr className="border-b border-tinta-200 text-left text-xs uppercase tracking-wide text-tinta-500">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={() => setMarcados(todos ? [] : filas.map((f) => f.pacienteId))}
                  className="h-4 w-4 rounded border-tinta-300 text-brand-600"
                  aria-label="Marcar todos"
                />
              </th>
              <th className="py-2">Paciente</th>
              <th>Motivo</th>
              <th className="text-right">Días</th>
              {mostrarMonto && <th className="text-right">Monto</th>}
              <th className="w-24 text-right pr-3">Contactar</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.pacienteId}
                className={cn(
                  'border-b border-tinta-100 last:border-0',
                  marcados.includes(f.pacienteId) && 'bg-brand-50/50',
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={marcados.includes(f.pacienteId)}
                    onChange={() => alternar(f.pacienteId)}
                    className="h-4 w-4 rounded border-tinta-300 text-brand-600"
                    aria-label={`Marcar ${f.nombre}`}
                  />
                </td>
                <td className="py-2">
                  <a href={`/pacientes/${f.pacienteId}`} className="font-medium text-brand-700 hover:underline">
                    {f.nombre}
                  </a>
                  <p className="text-xs text-tinta-400">{f.telefono}</p>
                </td>
                <td className="max-w-xs truncate text-xs text-tinta-600" title={f.detalle}>
                  {f.detalle}
                </td>
                <td className="text-right tabular-nums text-tinta-600">{f.dias}</td>
                {mostrarMonto && (
                  <td className="text-right font-medium tabular-nums text-rose-600">{clp(f.monto ?? 0)}</td>
                )}
                <td className="pr-3 text-right">
                  <div className="flex justify-end gap-1">
                    <a
                      href={enlaceWhatsapp(f.telefono, componerMensaje(plantilla, f))}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp con el mensaje escrito"
                      className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    <a
                      href={`tel:${f.telefono.replace(/[^\d+]/g, '')}`}
                      title="Llamar"
                      className="rounded p-1.5 text-tinta-500 hover:bg-tinta-100"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Formulario accion={agendarSeguimientosEnLote} className="rounded-lg border border-tinta-200 bg-tinta-50 p-3">
        {marcados.map((id) => (
          <input key={id} type="hidden" name="pacienteIds" value={id} />
        ))}
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="titulo" value={tituloTarea} />

        <Grilla cols={3}>
          <Campo etiqueta="Asignar a">
            <select name="asignadoAId" className="campo">
              <option value="">Yo</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Contactar en">
            <select name="dias" defaultValue="0" className="campo">
              <option value="0">Hoy</option>
              <option value="1">Mañana</option>
              <option value="3">En 3 días</option>
              <option value="7">En una semana</option>
            </select>
          </Campo>
          <div className="flex items-end">
            <BotonEnviar className="w-full" variante={marcados.length > 0 ? 'primario' : 'secundario'}>
              Agendar {marcados.length > 0 ? `${marcados.length} seguimiento(s)` : 'seguimientos'}
            </BotonEnviar>
          </div>
        </Grilla>

        {marcados.length === 0 && (
          <p className="mt-2 text-xs text-tinta-500">Marca a quiénes vas a contactar para generar sus tareas.</p>
        )}
      </Formulario>
    </div>
  );
}
