import { Campo, Grilla } from '@/components/ui';

export interface ValoresProfesional {
  rut: string;
  nombres: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  especialidad: string;
  subespecialidad: string | null;
  registroSuperintendencia: string | null;
  colorAgenda: string;
  modeloPago: string;
  comisionPorcentaje: number;
  sueldoBase: number;
  observaciones: string | null;
}

export const MODELOS_PAGO = [
  { valor: 'COMISION', texto: 'Comisión sobre lo producido' },
  { valor: 'ARRIENDO', texto: 'Arrienda box (paga arriendo)' },
  { valor: 'COMISION_Y_ARRIENDO', texto: 'Comisión y además paga arriendo' },
  { valor: 'SUELDO', texto: 'Sueldo fijo' },
];

export function CamposProfesional({ valores }: { valores?: ValoresProfesional }) {
  return (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="RUT" requerido>
          <input name="rut" defaultValue={valores?.rut} required placeholder="12345678-9" className="campo" />
        </Campo>
        <Campo etiqueta="Registro Superintendencia" ayuda="Nº de registro nacional de prestadores individuales.">
          <input name="registroSuperintendencia" defaultValue={valores?.registroSuperintendencia ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Nombres" requerido>
          <input name="nombres" defaultValue={valores?.nombres} required className="campo" />
        </Campo>
        <Campo etiqueta="Apellidos" requerido>
          <input name="apellidos" defaultValue={valores?.apellidos} required className="campo" />
        </Campo>
        <Campo etiqueta="Especialidad" requerido>
          <input
            name="especialidad"
            defaultValue={valores?.especialidad}
            required
            placeholder="Odontología general"
            className="campo"
          />
        </Campo>
        <Campo etiqueta="Subespecialidad">
          <input name="subespecialidad" defaultValue={valores?.subespecialidad ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Correo">
          <input name="email" type="email" defaultValue={valores?.email ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={valores?.telefono ?? ''} className="campo" />
        </Campo>
      </Grilla>

      <div className="mt-4 rounded-lg border border-tinta-200 bg-tinta-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tinta-500">Condiciones económicas</p>
        <Grilla cols={3}>
          <Campo etiqueta="Modelo de pago" requerido>
            <select name="modeloPago" defaultValue={valores?.modeloPago ?? 'COMISION'} required className="campo">
              {MODELOS_PAGO.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Comisión general (%)" ayuda="Se aplica si el servicio no define una comisión propia.">
            <input
              name="comisionPorcentaje"
              type="number"
              min={0}
              max={100}
              step={0.5}
              defaultValue={valores?.comisionPorcentaje ?? 0}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Sueldo base (CLP)">
            <input name="sueldoBase" type="number" min={0} step={1000} defaultValue={valores?.sueldoBase ?? 0} className="campo" />
          </Campo>
        </Grilla>
        <p className="mt-2 text-xs text-tinta-500">
          El arriendo de box se configura en la ficha del profesional, después de crearlo.
        </p>
      </div>

      <Grilla cols={2}>
        <Campo etiqueta="Color en la agenda" className="mt-4">
          <input name="colorAgenda" type="color" defaultValue={valores?.colorAgenda ?? '#3384fb'} className="campo h-10 p-1" />
        </Campo>
      </Grilla>

      <Campo etiqueta="Observaciones" className="mt-4">
        <textarea name="observaciones" rows={2} defaultValue={valores?.observaciones ?? ''} className="campo" />
      </Campo>
    </>
  );
}
