'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, FileUp, ImageIcon, Loader2, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import {
  COMPRESION_ALTA_FIDELIDAD,
  COMPRESION_ESTANDAR,
  comprimirImagen,
  esImagenComprimible,
  tamanoLegible,
} from '@/lib/comprimir-imagen';

interface ArchivoPreparado {
  clave: string;
  archivo: File;
  vistaPrevia: string | null;
  tamanoOriginal: number;
  seComprimio: boolean;
}

/**
 * Selector de archivos con captura desde la cámara del teléfono y compresión
 * en el navegador.
 *
 * Los archivos comprimidos se inyectan en un `<input type="file">` oculto que
 * es el que viaja en el formulario, de modo que la server action los recibe
 * igual que siempre y no hubo que cambiar nada del lado del servidor.
 */
export function SubirArchivos({
  name = 'archivos',
  multiple = true,
  requerido,
  aceptar = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx',
  etiquetaCamara = 'Tomar foto',
  etiquetaArchivo = 'Elegir archivo',
  maximoMb = 20,
}: {
  name?: string;
  multiple?: boolean;
  requerido?: boolean;
  aceptar?: string;
  etiquetaCamara?: string;
  etiquetaArchivo?: string;
  maximoMb?: number;
}) {
  const [archivos, setArchivos] = useState<ArchivoPreparado[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [altaFidelidad, setAltaFidelidad] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const entradaFinal = useRef<HTMLInputElement>(null);
  const entradaCamara = useRef<HTMLInputElement>(null);
  const entradaGaleria = useRef<HTMLInputElement>(null);

  // El input oculto es el que realmente se envía: hay que rellenarlo a mano
  // con los archivos ya comprimidos.
  useEffect(() => {
    if (!entradaFinal.current) return;
    const transferencia = new DataTransfer();
    archivos.forEach((a) => transferencia.items.add(a.archivo));
    entradaFinal.current.files = transferencia.files;
  }, [archivos]);

  // Libera las URL de vista previa al desmontar.
  useEffect(() => {
    return () => {
      archivos.forEach((a) => a.vistaPrevia && URL.revokeObjectURL(a.vistaPrevia));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregar = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setProcesando(true);
    setAviso(null);

    const preparados: ArchivoPreparado[] = [];
    const rechazados: string[] = [];

    for (const original of Array.from(lista)) {
      const resultado = esImagenComprimible(original)
        ? await comprimirImagen(original, altaFidelidad ? COMPRESION_ALTA_FIDELIDAD : COMPRESION_ESTANDAR)
        : { archivo: original, tamanoOriginal: original.size, seComprimio: false };

      if (resultado.archivo.size > maximoMb * 1024 * 1024) {
        rechazados.push(`${original.name} (${tamanoLegible(resultado.archivo.size)})`);
        continue;
      }

      preparados.push({
        clave: `${original.name}-${original.size}-${Math.random().toString(36).slice(2, 8)}`,
        archivo: resultado.archivo,
        vistaPrevia: resultado.archivo.type.startsWith('image/')
          ? URL.createObjectURL(resultado.archivo)
          : null,
        tamanoOriginal: resultado.tamanoOriginal,
        seComprimio: resultado.seComprimio,
      });
    }

    setArchivos((previos) => (multiple ? [...previos, ...preparados] : preparados.slice(0, 1)));

    if (rechazados.length > 0) {
      setAviso(`No se agregaron por superar los ${maximoMb} MB: ${rechazados.join(', ')}`);
    }

    setProcesando(false);
    // Permite volver a elegir el mismo archivo si se quitó de la lista.
    if (entradaCamara.current) entradaCamara.current.value = '';
    if (entradaGaleria.current) entradaGaleria.current.value = '';
  };

  const quitar = (clave: string) => {
    setArchivos((previos) => {
      const objetivo = previos.find((a) => a.clave === clave);
      if (objetivo?.vistaPrevia) URL.revokeObjectURL(objetivo.vistaPrevia);
      return previos.filter((a) => a.clave !== clave);
    });
  };

  const totalOriginal = archivos.reduce((acc, a) => acc + a.tamanoOriginal, 0);
  const totalFinal = archivos.reduce((acc, a) => acc + a.archivo.size, 0);
  const ahorro = totalOriginal > 0 ? Math.round((1 - totalFinal / totalOriginal) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Este es el campo que viaja en el formulario */}
      <input ref={entradaFinal} type="file" name={name} multiple={multiple} required={requerido} className="sr-only" tabIndex={-1} />

      {/* Entradas ocultas que abren cámara o explorador */}
      <input
        ref={entradaCamara}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        onChange={(e) => void agregar(e.target.files)}
        className="hidden"
      />
      <input
        ref={entradaGaleria}
        type="file"
        accept={aceptar}
        multiple={multiple}
        onChange={(e) => void agregar(e.target.files)}
        className="hidden"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={procesando}
          onClick={() => entradaCamara.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {etiquetaCamara}
        </button>

        <button
          type="button"
          disabled={procesando}
          onClick={() => entradaGaleria.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" />
          {etiquetaArchivo}
        </button>

        {procesando && (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Optimizando…
          </span>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={altaFidelidad}
          onChange={(e) => setAltaFidelidad(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
        />
        Alta fidelidad — para radiografías o fotos donde importa el detalle fino (archivos más pesados)
      </label>

      {aviso && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso}</p>
      )}

      {archivos.length > 0 && (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {archivos.map((a) => (
              <li
                key={a.clave}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2"
              >
                {a.vistaPrevia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.vistaPrevia}
                    alt={a.archivo.name}
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{a.archivo.name}</p>
                  <p className="text-xs text-slate-500">
                    {tamanoLegible(a.archivo.size)}
                    {a.seComprimio && (
                      <span className="text-emerald-600">
                        {' '}
                        · antes {tamanoLegible(a.tamanoOriginal)}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => quitar(a.clave)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Quitar ${a.archivo.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <p className={cn('text-xs', ahorro > 0 ? 'text-emerald-700' : 'text-slate-500')}>
            {archivos.length} archivo(s) · {tamanoLegible(totalFinal)}
            {ahorro > 0 && ` — ${ahorro}% menos que los ${tamanoLegible(totalOriginal)} originales`}
          </p>
        </>
      )}
    </div>
  );
}
