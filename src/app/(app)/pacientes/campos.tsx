'use client';

import { useState } from 'react';
import { Campo, Grilla } from '@/components/ui';

export interface ValoresPaciente {
  rut: string | null;
  pasaporte: string | null;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fechaNacimiento: Date | string | null;
  edadRegistrada: number | null;
  sexo: string;
  telefonoPrincipal: string;
  telefonoSecundario: string | null;
  email: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  ocupacion: string | null;
  prevision: string;
  previsionDetalle: string | null;
  convenioId: string | null;
  numeroAfiliado: string | null;
  vieneDeOtroCentro: boolean;
  centroOrigen: string | null;
  profesionalOrigen: string | null;
  motivoDerivacion: string | null;
  fechaDerivacion: Date | string | null;
  alergias: string | null;
  antecedentesMedicos: string | null;
  medicamentosActuales: string | null;
  antecedentesQuirurgicos: string | null;
  observaciones: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  contactoEmergenciaRelacion: string | null;
  comoNosConocio: string | null;
}

const SEXOS = [
  { valor: 'NO_ESPECIFICA', texto: 'Prefiere no decirlo' },
  { valor: 'FEMENINO', texto: 'Femenino' },
  { valor: 'MASCULINO', texto: 'Masculino' },
  { valor: 'OTRO', texto: 'Otro' },
];

const PREVISIONES = [
  { valor: 'PARTICULAR', texto: 'Particular' },
  { valor: 'FONASA', texto: 'Fonasa' },
  { valor: 'ISAPRE', texto: 'Isapre' },
  { valor: 'SEGURO_COMPLEMENTARIO', texto: 'Seguro complementario' },
  { valor: 'OTRO', texto: 'Otro' },
];

const ORIGENES = [
  'Recomendación de un paciente',
  'Redes sociales',
  'Búsqueda en Google',
  'Pasaba por fuera',
  'Convenio de empresa',
  'Derivación de otro centro',
  'Otro',
];

function aFecha(valor: Date | string | null | undefined) {
  if (!valor) return '';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CamposPaciente({
  valores,
  convenios,
}: {
  valores?: ValoresPaciente;
  convenios: { id: string; nombre: string; tipo: string }[];
}) {
  const [derivado, setDerivado] = useState(valores?.vieneDeOtroCentro ?? false);

  return (
    <div className="space-y-6">
      {/* ── Identificación ── */}
      <section className="tarjeta p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Identificación</h3>
        <Grilla cols={3}>
          <Campo etiqueta="RUT" ayuda="Si es extranjero sin RUT, deja vacío y usa el pasaporte.">
            <input name="rut" defaultValue={valores?.rut ?? ''} placeholder="12345678-9" className="campo" />
          </Campo>
          <Campo etiqueta="Pasaporte / DNI">
            <input name="pasaporte" defaultValue={valores?.pasaporte ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Sexo">
            <select name="sexo" defaultValue={valores?.sexo ?? 'NO_ESPECIFICA'} className="campo">
              {SEXOS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Nombres" requerido>
            <input name="nombres" defaultValue={valores?.nombres} required className="campo" />
          </Campo>
          <Campo etiqueta="Apellido paterno" requerido>
            <input name="apellidoPaterno" defaultValue={valores?.apellidoPaterno} required className="campo" />
          </Campo>
          <Campo etiqueta="Apellido materno">
            <input name="apellidoMaterno" defaultValue={valores?.apellidoMaterno ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento">
            <input
              name="fechaNacimiento"
              type="date"
              defaultValue={aFecha(valores?.fechaNacimiento)}
              max={aFecha(new Date())}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Edad" ayuda="Sólo si no se conoce la fecha de nacimiento exacta.">
            <input
              name="edadRegistrada"
              type="number"
              min={0}
              max={120}
              defaultValue={valores?.edadRegistrada ?? ''}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Ocupación">
            <input name="ocupacion" defaultValue={valores?.ocupacion ?? ''} className="campo" />
          </Campo>
        </Grilla>
      </section>

      {/* ── Contacto ── */}
      <section className="tarjeta p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Contacto</h3>
        <Grilla cols={3}>
          <Campo etiqueta="Teléfono principal" requerido>
            <input
              name="telefonoPrincipal"
              defaultValue={valores?.telefonoPrincipal}
              required
              placeholder="+56 9 1234 5678"
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Teléfono secundario">
            <input name="telefonoSecundario" defaultValue={valores?.telefonoSecundario ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Correo electrónico">
            <input name="email" type="email" defaultValue={valores?.email ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Dirección">
            <input name="direccion" defaultValue={valores?.direccion ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Comuna">
            <input name="comuna" defaultValue={valores?.comuna ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input name="ciudad" defaultValue={valores?.ciudad ?? ''} className="campo" />
          </Campo>
        </Grilla>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Contacto de emergencia</p>
          <Grilla cols={3}>
            <Campo etiqueta="Nombre">
              <input name="contactoEmergenciaNombre" defaultValue={valores?.contactoEmergenciaNombre ?? ''} className="campo" />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input name="contactoEmergenciaTelefono" defaultValue={valores?.contactoEmergenciaTelefono ?? ''} className="campo" />
            </Campo>
            <Campo etiqueta="Relación">
              <input
                name="contactoEmergenciaRelacion"
                defaultValue={valores?.contactoEmergenciaRelacion ?? ''}
                placeholder="Cónyuge, hijo/a…"
                className="campo"
              />
            </Campo>
          </Grilla>
        </div>
      </section>

      {/* ── Previsión y convenio ── */}
      <section className="tarjeta p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Previsión y convenio</h3>
        <Grilla cols={2}>
          <Campo etiqueta="Previsión">
            <select name="prevision" defaultValue={valores?.prevision ?? 'PARTICULAR'} className="campo">
              {PREVISIONES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Detalle de previsión" ayuda="Nombre de la Isapre, seguro o tramo Fonasa.">
            <input name="previsionDetalle" defaultValue={valores?.previsionDetalle ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Convenio" ayuda="Aplica tarifas y cobertura especial en presupuestos y ventas.">
            <select name="convenioId" defaultValue={valores?.convenioId ?? ''} className="campo">
              <option value="">Sin convenio</option>
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Nº de afiliado / póliza">
            <input name="numeroAfiliado" defaultValue={valores?.numeroAfiliado ?? ''} className="campo" />
          </Campo>
        </Grilla>
      </section>

      {/* ── Procedencia ── */}
      <section className="tarjeta p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Procedencia</h3>
        <Campo etiqueta="¿Cómo nos conoció?">
          <select name="comoNosConocio" defaultValue={valores?.comoNosConocio ?? ''} className="campo">
            <option value="">Sin especificar</option>
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Campo>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="vieneDeOtroCentro"
            checked={derivado}
            onChange={(e) => setDerivado(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          El paciente viene derivado de otro centro clínico
        </label>

        {derivado && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
            <Grilla cols={2}>
              <Campo etiqueta="Centro de origen" requerido>
                <input name="centroOrigen" defaultValue={valores?.centroOrigen ?? ''} required={derivado} className="campo" />
              </Campo>
              <Campo etiqueta="Profesional que deriva">
                <input name="profesionalOrigen" defaultValue={valores?.profesionalOrigen ?? ''} className="campo" />
              </Campo>
              <Campo etiqueta="Fecha de derivación">
                <input name="fechaDerivacion" type="date" defaultValue={aFecha(valores?.fechaDerivacion)} className="campo" />
              </Campo>
            </Grilla>
            <Campo etiqueta="Motivo de la derivación" className="mt-4">
              <textarea name="motivoDerivacion" rows={2} defaultValue={valores?.motivoDerivacion ?? ''} className="campo" />
            </Campo>
          </div>
        )}
      </section>

      {/* ── Antecedentes ── */}
      <section className="tarjeta p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Antecedentes de salud</h3>
        <Grilla cols={2}>
          <Campo etiqueta="Alergias" ayuda="Se destaca en rojo en la ficha y en cada atención.">
            <textarea name="alergias" rows={2} defaultValue={valores?.alergias ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Medicamentos actuales">
            <textarea name="medicamentosActuales" rows={2} defaultValue={valores?.medicamentosActuales ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Antecedentes médicos">
            <textarea name="antecedentesMedicos" rows={2} defaultValue={valores?.antecedentesMedicos ?? ''} className="campo" />
          </Campo>
          <Campo etiqueta="Antecedentes quirúrgicos">
            <textarea name="antecedentesQuirurgicos" rows={2} defaultValue={valores?.antecedentesQuirurgicos ?? ''} className="campo" />
          </Campo>
        </Grilla>
        <Campo etiqueta="Observaciones generales" className="mt-4">
          <textarea name="observaciones" rows={2} defaultValue={valores?.observaciones ?? ''} className="campo" />
        </Campo>
      </section>
    </div>
  );
}
