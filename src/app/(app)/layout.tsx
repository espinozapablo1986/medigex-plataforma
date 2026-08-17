import { requerirSesion } from '@/lib/auth';
import { navegacionVisible } from '@/lib/navegacion';
import { prisma } from '@/lib/prisma';
import { iniciales } from '@/lib/format';
import { BarraLateral } from '@/components/barra-lateral';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await requerirSesion();
  const config = await prisma.configuracion.findUnique({ where: { id: 'singleton' } });

  return (
    <div className="min-h-screen bg-slate-50">
      <BarraLateral
        grupos={navegacionVisible(sesion)}
        nombreClinica={config?.nombreClinica ?? 'MEDIGEX'}
        usuario={{
          nombre: `${sesion.nombres} ${sesion.apellidos}`,
          rol: sesion.rolNombre,
          iniciales: iniciales(sesion.nombres, sesion.apellidos),
        }}
      />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
