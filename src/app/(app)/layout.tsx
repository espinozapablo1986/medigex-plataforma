import { requerirSesion } from '@/lib/auth';
import { navegacionVisible } from '@/lib/navegacion';
import { prisma } from '@/lib/prisma';
import { iniciales } from '@/lib/format';
import { BarraLateral } from '@/components/barra-lateral';
import { BandaVistaPrevia } from '@/components/banda-vista-previa';
import { BuscadorGlobal } from '@/components/buscador-global';

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
        {/* Barra superior: el buscador vive aquí para estar disponible desde
            cualquier pantalla, no sólo dentro de un módulo. */}
        <div className="sticky top-0 z-20 hidden border-b border-tinta-200 bg-marfil/95 backdrop-blur lg:block no-imprimir">
          <div className="mx-auto flex max-w-[1600px] justify-end px-4 py-2.5 sm:px-6 lg:px-8">
            <BuscadorGlobal />
          </div>
        </div>

        {/* En móvil va dentro del contenido: la cabecera ya tiene el menú. */}
        <div className="px-4 pt-4 sm:px-6 lg:hidden no-imprimir">
          <BuscadorGlobal />
        </div>

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
