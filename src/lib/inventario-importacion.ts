import type { ColumnaPlantilla } from './excel';

/**
 * Definición de las cargas masivas de inventario.
 *
 * Las columnas se declaran una sola vez y las usan tanto el generador de la
 * plantilla como el importador. Si estuvieran duplicadas, tarde o temprano la
 * plantilla ofrecería una columna que el importador ya no lee.
 */

export const UNIDADES = [
  'UNIDAD',
  'CAJA',
  'PAQUETE',
  'ML',
  'LITRO',
  'GRAMO',
  'KILO',
  'METRO',
  'PAR',
  'SET',
] as const;

export const COLUMNAS_PRODUCTOS: ColumnaPlantilla[] = [
  {
    clave: 'sku',
    titulo: 'SKU',
    ancho: 16,
    obligatoria: true,
    ejemplo: 'GUA-NIT-M',
    ayuda: 'Código único del producto. Es la llave: si ya existe, el producto se actualiza; si no, se crea.',
  },
  {
    clave: 'nombre',
    titulo: 'Nombre',
    ancho: 34,
    obligatoria: true,
    ejemplo: 'Guantes de nitrilo talla M',
    ayuda: 'Nombre con el que se busca el producto.',
  },
  {
    clave: 'categoria',
    titulo: 'Categoría',
    ancho: 20,
    ejemplo: 'Insumos clínicos',
    ayuda: 'Si la categoría no existe, se crea. Dejar vacío deja el producto sin categoría.',
  },
  {
    clave: 'unidad',
    titulo: 'Unidad',
    ancho: 12,
    ejemplo: 'CAJA',
    ayuda: 'Uno de los valores admitidos (ver abajo). Si se deja vacío, queda UNIDAD.',
  },
  {
    clave: 'stockMinimo',
    titulo: 'Stock mínimo',
    ancho: 14,
    ejemplo: 5,
    ayuda: 'Cantidad bajo la cual el producto aparece como stock bajo. Número, admite decimales.',
  },
  {
    clave: 'stockMaximo',
    titulo: 'Stock máximo',
    ancho: 14,
    ejemplo: 40,
    ayuda: 'Referencia para reponer. Opcional.',
  },
  {
    clave: 'costo',
    titulo: 'Costo',
    ancho: 12,
    ejemplo: 12990,
    ayuda: 'Costo unitario en pesos, sin decimales ni puntos. El peso chileno no usa decimales.',
  },
  {
    clave: 'precioVenta',
    titulo: 'Precio venta',
    ancho: 12,
    ejemplo: 0,
    ayuda: 'Sólo si el producto se vende al paciente. En pesos, sin decimales.',
  },
  {
    clave: 'esInsumo',
    titulo: 'Es insumo',
    ancho: 11,
    ejemplo: 'SI',
    ayuda: 'SI o NO. Un insumo se descuenta solo al cerrar una atención que lo consume.',
  },
  {
    clave: 'esVendible',
    titulo: 'Es vendible',
    ancho: 12,
    ejemplo: 'NO',
    ayuda: 'SI o NO. Determina si aparece al armar una venta o un presupuesto.',
  },
  {
    clave: 'ubicacion',
    titulo: 'Ubicación',
    ancho: 18,
    ejemplo: 'Bodega A · repisa 2',
    ayuda: 'Dónde está guardado. Sirve para acotar los conteos físicos.',
  },
  {
    clave: 'stockInicial',
    titulo: 'Stock inicial',
    ancho: 14,
    ejemplo: 20,
    ayuda:
      'Sólo para productos nuevos. Registra un movimiento de inventario inicial. En productos que ya existen se ignora: el stock se corrige con un conteo, no reescribiéndolo.',
  },
];

export const INSTRUCCIONES_PRODUCTOS = [
  'Completa la hoja «Datos». La primera fila son los encabezados y no debe cambiarse de nombre.',
  'La fila de ejemplo, en gris y cursiva, se puede borrar o sobrescribir.',
  'El SKU es la llave: si ya existe un producto con ese código se actualiza, y si no existe se crea.',
  'Antes de aplicar nada, la plataforma te muestra qué se va a crear, qué se va a actualizar y qué filas tienen error.',
  'Las columnas marcadas con * son obligatorias.',
  'Se leen hasta 2000 filas por archivo. Se aceptan .xlsx y .csv.',
];

export const COLUMNAS_CONTEO: ColumnaPlantilla[] = [
  {
    clave: 'sku',
    titulo: 'SKU',
    ancho: 16,
    obligatoria: true,
    ejemplo: 'GUA-NIT-M',
    ayuda: 'No modificar: identifica el producto dentro del conteo.',
  },
  {
    clave: 'nombre',
    titulo: 'Producto',
    ancho: 34,
    ejemplo: 'Guantes de nitrilo talla M',
    ayuda: 'Sólo de referencia. Lo que se escriba aquí se ignora.',
  },
  {
    clave: 'ubicacion',
    titulo: 'Ubicación',
    ancho: 18,
    ejemplo: 'Bodega A · repisa 2',
    ayuda: 'Sólo de referencia, para ordenar el recorrido físico.',
  },
  {
    clave: 'contado',
    titulo: 'Contado',
    ancho: 12,
    ejemplo: 18,
    ayuda: 'La cantidad que contaste. Déjala vacía si esa posición aún no se cuenta.',
  },
  {
    clave: 'observaciones',
    titulo: 'Observaciones',
    ancho: 30,
    ejemplo: 'Dos cajas abiertas',
    ayuda: 'Opcional: por qué la diferencia, estado del producto, lo que sirva.',
  },
];

export const INSTRUCCIONES_CONTEO = [
  'Esta planilla viene con los productos del conteo ya cargados.',
  'Escribe en la columna «Contado» lo que encontraste físicamente. Déjala vacía en lo que todavía no cuentes.',
  'No se incluye el stock del sistema a propósito: ver la cifra esperada mientras se cuenta sesga el recuento.',
  'Al subirla verás las diferencias antes de que se aplique ningún ajuste.',
  'No cambies la columna SKU ni el nombre de los encabezados.',
];

/** Interpreta «SI», «sí», «1», «true», «x» como verdadero. */
export function comoBooleano(valor: string, porDefecto: boolean): boolean {
  const v = valor.trim().toLowerCase();
  if (v === '') return porDefecto;
  return ['si', 'sí', 's', '1', 'true', 'verdadero', 'x'].includes(v);
}

/**
 * Interpreta un número escrito por una persona.
 *
 * Acepta «1.234,5» (formato chileno), «1234.5» y «1 234». Devuelve null si no
 * queda un número, para poder señalar la fila en vez de guardar un cero
 * silencioso, que es lo que rompe un inventario sin que nadie se dé cuenta.
 */
export function comoNumero(valor: string): number | null {
  const v = valor.trim();
  if (v === '') return null;

  let limpio = v.replace(/\s/g, '').replace(/\$/g, '');

  const tieneComa = limpio.includes(',');
  const tienePunto = limpio.includes('.');

  if (tieneComa && tienePunto) {
    // El separador decimal es el que aparece más a la derecha.
    limpio =
      limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
        ? limpio.replace(/\./g, '').replace(',', '.')
        : limpio.replace(/,/g, '');
  } else if (tieneComa) {
    limpio = limpio.replace(',', '.');
  } else if (tienePunto) {
    // «1.234» es mil doscientos treinta y cuatro; «0.500» son medio litro.
    // Un cero a la izquierda delata que el punto es decimal y no de miles.
    const partes = limpio.split('.');
    const pareceMiles =
      partes.length > 2 ||
      (partes.length === 2 && partes[1]!.length === 3 && partes[0] !== '0' && partes[0] !== '');
    if (pareceMiles) limpio = partes.join('');
  }

  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}
