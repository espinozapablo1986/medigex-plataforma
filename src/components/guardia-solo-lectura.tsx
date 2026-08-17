'use client';

import { useEffect } from 'react';

/**
 * Freno de escritura en el navegador durante la vista previa.
 *
 * La barrera de verdad está en el servidor (`exigirPermiso` rechaza cualquier
 * acción que no sea "ver"), pero en producción Next.js oculta el mensaje de
 * los errores lanzados en el servidor, así que el usuario sólo vería una
 * pantalla de error sin explicación. Interceptando aquí el envío se le dice
 * en el momento y sin recargar por qué no se guardó.
 *
 * Se bloquean únicamente los formularios POST propios de la aplicación —que
 * es como viajan todas las server actions—; los filtros y buscadores usan GET
 * y siguen funcionando, porque durante la vista previa hay que poder navegar.
 */
export function GuardiaSoloLectura({ observadoNombre }: { observadoNombre: string }) {
  useEffect(() => {
    function alEnviar(evento: SubmitEvent) {
      const formulario = evento.target as HTMLFormElement | null;
      if (!formulario || formulario.tagName !== 'FORM') return;

      // Los formularios de filtro navegan con GET: no escriben nada.
      const metodo = (evento.submitter?.getAttribute('formmethod') ?? formulario.method ?? 'get').toLowerCase();
      if (metodo !== 'post') return;

      // Salir de la vista previa y cerrar sesión son rutas propias y deben
      // seguir funcionando aunque todo lo demás esté bloqueado.
      const destino = formulario.getAttribute('action') ?? '';
      if (destino.startsWith('/api/')) return;

      evento.preventDefault();
      evento.stopPropagation();
      window.alert(
        `Estás viendo la plataforma como ${observadoNombre}.\n\n` +
          'La vista previa es de sólo lectura: sirve para comprobar qué alcanza a hacer esta cuenta, ' +
          'no para trabajar en su nombre. Sal de la vista previa para poder guardar.',
      );
    }

    // En captura, para adelantarse a los manejadores de React.
    document.addEventListener('submit', alEnviar, true);
    return () => document.removeEventListener('submit', alEnviar, true);
  }, [observadoNombre]);

  return null;
}
