import { redirect } from 'next/navigation';

import { obtenerSesion } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BotonEnviar, Formulario } from '@/components/formulario';
import { Campo } from '@/components/ui';

import { iniciarSesion } from './acciones';

export const metadata = { title: 'Iniciar sesión' };
export const dynamic = 'force-dynamic';

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (sesion) redirect('/');

  const { siguiente } = await searchParams;
  const config = await prisma.configuracion.findUnique({ where: { id: 'singleton' } }).catch(() => null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-24 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold tracking-tight text-white">
            MEDIGEX
          </span>
          <h1 className="text-xl font-semibold text-slate-900">{config?.nombreClinica ?? 'MEDIGEX'}</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con tu cuenta para continuar</p>
        </div>

        <div className="tarjeta p-6">
          <Formulario accion={iniciarSesion} className="space-y-4">
            <input type="hidden" name="siguiente" value={siguiente ?? ''} />

            <Campo etiqueta="Correo electrónico" requerido>
              <input
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                placeholder="nombre@clinica.cl"
                className="campo"
              />
            </Campo>

            <Campo etiqueta="Contraseña" requerido>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="campo"
              />
            </Campo>

            <BotonEnviar className="w-full" tamano="lg">
              Entrar
            </BotonEnviar>
          </Formulario>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          ¿Olvidaste tu contraseña? Solicita al administrador que la restablezca.
        </p>
      </div>
    </div>
  );
}
