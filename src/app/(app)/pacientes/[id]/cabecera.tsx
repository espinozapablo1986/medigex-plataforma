import Link from 'next/link';

import { calcularEdad, clp, formatearRut, humanizar } from '@/lib/format';
import { Aviso, Badge, EnlaceBoton, Pestanas } from '@/components/ui';

export interface PacienteCabecera {
  id: string;
  numeroFicha: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  rut: string | null;
  pasaporte: string | null;
  fechaNacimiento: Date | null;
  edadRegistrada: number | null;
  sexo: string;
  telefonoPrincipal: string;
  telefonoSecundario: string | null;
  email: string | null;
  prevision: string;
  previsionDetalle: string | null;
  alergias: string | null;
  activo: boolean;
  vieneDeOtroCentro: boolean;
  centroOrigen: string | null;
  convenio?: { nombre: string } | null;
}

export function nombreCompleto(p: {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}) {
  return `${p.nombres} ${p.apellidoPaterno}${p.apellidoMaterno ? ` ${p.apellidoMaterno}` : ''}`;
}

/** Cabecera y pestañas comunes a todas las vistas de la ficha del paciente. */
export function CabeceraPaciente({
  paciente,
  saldo,
  activo,
  puedeEditar,
  contadores,
}: {
  paciente: PacienteCabecera;
  saldo: number;
  activo: string;
  puedeEditar: boolean;
  contadores?: { atenciones?: number; examenes?: number; archivos?: number };
}) {
  const edad = calcularEdad(paciente.fechaNacimiento, paciente.edadRegistrada);
  const base = `/pacientes/${paciente.id}`;

  return (
    <div className="mb-5">
      <Link href="/pacientes" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        ← Pacientes
      </Link>

      <div className="tarjeta mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{nombreCompleto(paciente)}</h1>
              <Badge tono="gris">Ficha Nº {paciente.numeroFicha}</Badge>
              {!paciente.activo && <Badge tono="rojo">inactivo</Badge>}
              {paciente.vieneDeOtroCentro && (
                <Badge tono="morado">derivado de {paciente.centroOrigen ?? 'otro centro'}</Badge>
              )}
              {paciente.convenio && <Badge tono="azul">{paciente.convenio.nombre}</Badge>}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              <span>{formatearRut(paciente.rut) || paciente.pasaporte || 'Sin identificación'}</span>
              {edad !== null && <span>{edad} años</span>}
              <span>{humanizar(paciente.sexo)}</span>
              <span>{paciente.telefonoPrincipal}</span>
              {paciente.telefonoSecundario && <span>{paciente.telefonoSecundario}</span>}
              {paciente.email && <span>{paciente.email}</span>}
              <span>
                {humanizar(paciente.prevision)}
                {paciente.previsionDetalle ? ` · ${paciente.previsionDetalle}` : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Saldo en cuenta</p>
              <p
                className={`text-lg font-semibold tabular-nums ${
                  saldo > 0 ? 'text-rose-600' : saldo < 0 ? 'text-emerald-600' : 'text-slate-700'
                }`}
              >
                {saldo < 0 ? `${clp(Math.abs(saldo))} a favor` : clp(saldo)}
              </p>
            </div>
            <div className="flex gap-2 no-imprimir">
              <EnlaceBoton href={`/agenda/nueva?paciente=${paciente.id}`} variante="secundario" tamano="sm">
                Agendar hora
              </EnlaceBoton>
              {puedeEditar && (
                <EnlaceBoton href={`${base}/editar`} variante="secundario" tamano="sm">
                  Editar ficha
                </EnlaceBoton>
              )}
            </div>
          </div>
        </div>

        {paciente.alergias && (
          <div className="mt-3">
            <Aviso tono="error" titulo="Alergias">
              {paciente.alergias}
            </Aviso>
          </div>
        )}
      </div>

      <Pestanas
        activo={activo}
        items={[
          { href: base, texto: 'Resumen' },
          { href: `${base}/historia`, texto: 'Historia clínica', contador: contadores?.atenciones },
          { href: `${base}/examenes`, texto: 'Exámenes', contador: contadores?.examenes },
          { href: `${base}/archivos`, texto: 'Archivos', contador: contadores?.archivos },
          { href: `${base}/cuenta`, texto: 'Cuenta corriente' },
          { href: `${base}/recetas`, texto: 'Recetas' },
        ]}
      />
    </div>
  );
}
