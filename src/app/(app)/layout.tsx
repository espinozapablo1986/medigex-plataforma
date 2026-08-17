import { requerirSesion } from '@/lib/auth';
import { navegacionVisible } from '@/lib/navegacion';
import { prisma } from '@/lib/prisma';
import { iniciales } from '@/lib/format';
import { BarraLateral } from '@/components/barra-lateral';
import { BandaVistaPrevia } from '@/components/banda-vista-previa';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await requerirSesion();
  const config = await prisma.configuracion.findUnique({ where: { id: 'singleton' } });

  return (
    <div className="min-h-screen bg-tinta-50">
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
        {/* Hueco para que la banda fija no tape la última fila de una tabla. */}
        {sesion.vistaPrevia && <div className="h-20" aria-hidden />}
      </main>

      {sesion.vistaPrevia && (
        <BandaVistaPrevia
          observadoNombre={`${sesion.nombres} ${sesion.apellidos}`}
          observadoEmail={sesion.email}
          rolNombre={sesion.rolNombre}
          administradorNombre={sesion.vistaPrevia.administradorNombre}
        />
      )}
    </div>
  );
}
