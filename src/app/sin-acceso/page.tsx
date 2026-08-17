import { MODULOS_POR_SLUG } from '@/lib/permissions';
import { EnlaceBoton } from '@/components/ui';

export const metadata = { title: 'Sin acceso' };

export default async function SinAcceso({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; accion?: string }>;
}) {
  const { modulo, accion } = await searchParams;
  const def = modulo ? MODULOS_POR_SLUG.get(modulo) : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="tarjeta max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">No tienes acceso a esta sección</h1>
        <p className="mt-2 text-sm text-slate-600">
          {def
            ? `Tu perfil no incluye el permiso "${accion ?? 'ver'}" sobre el módulo ${def.nombre}.`
            : 'Tu perfil no tiene permiso para acceder a esta sección.'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Si necesitas acceso, pídele a un administrador que lo habilite en Configuración → Roles y permisos.
        </p>
        <div className="mt-6">
          <EnlaceBoton href="/">Volver al inicio</EnlaceBoton>
        </div>
      </div>
    </div>
  );
}
