'use client';

import { useEffect, useRef } from 'react';

/**
 * Copia el encabezado de cada columna a sus celdas, como `data-etiqueta`.
 *
 * En pantallas angostas la hoja de estilos convierte cada fila en una tarjeta
 * y muestra esa etiqueta junto al dato; sin ella, una tarjeta sería una lista
 * de valores sueltos sin decir a qué corresponde cada uno.
 *
 * Se hace aquí y no en cada página porque hay más de veinte tablas: marcarlas
 * a mano habría significado tocar cientos de celdas y volver a hacerlo en
 * cada tabla nueva. La tabla ya declara sus encabezados; esto sólo los
 * reutiliza.
 */
export function EtiquetasTabla() {
  const ancla = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const tabla = ancla.current?.parentElement?.querySelector('table');
    if (!tabla) return;

    function etiquetar() {
      if (!tabla) return;
      const encabezados = Array.from(tabla.querySelectorAll('thead th')).map((th) =>
        (th.textContent ?? '').trim(),
      );
      if (encabezados.length === 0) return;

      for (const fila of Array.from(tabla.querySelectorAll('tbody tr'))) {
        const celdas = Array.from(fila.children);
        // Una fila con menos celdas que columnas suele ser un `colSpan`
        // («sin resultados»): etiquetarla sólo añadiría ruido.
        if (celdas.length !== encabezados.length) continue;

        celdas.forEach((celda, i) => {
          if (celda.tagName === 'TD') celda.setAttribute('data-etiqueta', encabezados[i] ?? '');
        });
      }
    }

    etiquetar();

    // Las tablas se repueblan al filtrar, paginar o revalidar.
    const observador = new MutationObserver(etiquetar);
    const cuerpo = tabla.querySelector('tbody');
    if (cuerpo) observador.observe(cuerpo, { childList: true, subtree: true });

    return () => observador.disconnect();
  }, []);

  return <span ref={ancla} className="hidden" aria-hidden />;
}
