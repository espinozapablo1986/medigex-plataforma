import { Campo, Grilla } from '@/components/ui';

export interface ValoresServicio {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  precio: number;
  costoEstimado: number;
  duracionMinutos: number;
  requiereBox: boolean;
  tipoBoxRequerido: string | null;
  usaRayosX: boolean;
  afectoIva: boolean;
  comisionPorcentaje: number | null;
  requiereConsentimiento: boolean;
}

const TIPOS_BOX = [
  { valor: '', texto: 'Cualquier box disponible' },
  { valor: 'BOX_DENTAL', texto: 'Box dental' },
  { valor: 'BOX_MEDICO', texto: 'Box médico' },
  { valor: 'SALA_RAYOS_X', texto: 'Sala de rayos X' },
  { valor: 'SALA_PROCEDIMIENTOS', texto: 'Sala de procedimientos' },
  { valor: 'SALA_CIRUGIA', texto: 'Sala de cirugía' },
];

/** Campos compartidos entre el alta y la edición de un servicio. */
export function CamposServicio({
  valores,
  categorias,
}: {
  valores?: ValoresServicio;
  categorias: { id: string; nombre: string }[];
}) {
  return (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Código" requerido ayuda="Identificador interno, ej: OD-001">
          <input name="codigo" defaultValue={valores?.codigo} required className="campo uppercase" />
        </Campo>
        <Campo etiqueta="Nombre del servicio" requerido>
          <input name="nombre" defaultValue={valores?.nombre} required className="campo" />
        </Campo>
        <Campo etiqueta="Categoría">
          <select name="categoriaId" defaultValue={valores?.categoriaId ?? ''} className="campo">
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Duración (minutos)" requerido>
          <input
            name="duracionMinutos"
            type="number"
            min={5}
            step={5}
            defaultValue={valores?.duracionMinutos ?? 30}
            required
            className="campo"
          />
        </Campo>
        <Campo etiqueta="Precio de lista (CLP)" requerido ayuda="Precio final al público, IVA incluido.">
          <input name="precio" type="number" min={0} step={100} defaultValue={valores?.precio ?? 0} required className="campo" />
        </Campo>
        <Campo etiqueta="Costo estimado (CLP)" ayuda="Insumos y costos directos, para calcular margen.">
          <input name="costoEstimado" type="number" min={0} step={100} defaultValue={valores?.costoEstimado ?? 0} className="campo" />
        </Campo>
        <Campo etiqueta="Tipo de box requerido">
          <select name="tipoBoxRequerido" defaultValue={valores?.tipoBoxRequerido ?? ''} className="campo">
            {TIPOS_BOX.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          etiqueta="Comisión del profesional (%)"
          ayuda="Déjalo vacío para usar la comisión general del profesional."
        >
          <input
            name="comisionPorcentaje"
            type="number"
            min={0}
            max={100}
            step={0.5}
            defaultValue={valores?.comisionPorcentaje ?? ''}
            className="campo"
          />
        </Campo>
      </Grilla>

      <Campo etiqueta="Descripción" className="mt-4">
        <textarea name="descripcion" rows={2} defaultValue={valores?.descripcion ?? ''} className="campo" />
      </Campo>

      <fieldset className="mt-4 space-y-2">
        <legend className="etiqueta">Opciones</legend>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input
            type="checkbox"
            name="requiereBox"
            defaultChecked={valores?.requiereBox ?? true}
            className="h-4 w-4 rounded border-tinta-300 text-brand-600"
          />
          Requiere reservar un box
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input
            type="checkbox"
            name="usaRayosX"
            defaultChecked={valores?.usaRayosX ?? false}
            className="h-4 w-4 rounded border-tinta-300 text-brand-600"
          />
          Usa la sala de rayos X
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input
            type="checkbox"
            name="afectoIva"
            defaultChecked={valores?.afectoIva ?? true}
            className="h-4 w-4 rounded border-tinta-300 text-brand-600"
          />
          Afecto a IVA
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input
            type="checkbox"
            name="requiereConsentimiento"
            defaultChecked={valores?.requiereConsentimiento ?? false}
            className="h-4 w-4 rounded border-tinta-300 text-brand-600"
          />
          Requiere consentimiento informado firmado
        </label>
      </fieldset>
    </>
  );
}
