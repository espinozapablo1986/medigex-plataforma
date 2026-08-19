/**
 * Pruebas de la lógica pura de MEDIGEX.
 *
 * Se ejecutan contra los módulos reales del proyecto, sin base de datos ni
 * servidor: son las funciones de las que dependen los cálculos clínicos y de
 * dinero, y ninguna estaba cubierta hasta ahora.
 */
export {}; // hace de este archivo un módulo, para poder usar await arriba

const RAIZ = '../src/lib';

const { validarRut, normalizarRut, formatearRut, clp, desglosarIva, calcularEdad, horaAMinutos, minutosAHora, sinTildes, iniciales, slugificar } = await import(`${RAIZ}/format.ts`);
const { buscarPieza, nombreCara, ladoDeLaCara, nivelInsercion, severidadBolsa, esBolsaPatologica, filasDe, todasLasPiezas } = await import(`${RAIZ}/dental.ts`);
const { numeroWhatsapp, enlaceWhatsapp, nombrePila, MENSAJES } = await import(`${RAIZ}/whatsapp.ts`);
const { comoNumero, comoBooleano, COLUMNAS_PRODUCTOS, COLUMNAS_CONTEO, UNIDADES } = await import(`${RAIZ}/inventario-importacion.ts`);
const { MODULOS, ACCIONES, ETIQUETA_ACCION, ROLES_SEMILLA, expandirPermisos, claveP } = await import(`${RAIZ}/permissions.ts`);
const { GUIAS, buscarGuias, guiaDe, AREAS } = await import(`${RAIZ}/ayuda.ts`);

let pasadas = 0;
const fallos: string[] = [];
let grupoActual = '';

function grupo(nombre: string) {
  grupoActual = nombre;
  console.log(`\n── ${nombre}`);
}

function comprobar(descripcion: string, condicion: boolean, detalle = '') {
  if (condicion) {
    pasadas += 1;
  } else {
    fallos.push(`[${grupoActual}] ${descripcion}${detalle ? ` → ${detalle}` : ''}`);
    console.log(`   FALLA  ${descripcion}${detalle ? ` → ${detalle}` : ''}`);
  }
}

function igual(descripcion: string, actual: unknown, esperado: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  comprobar(descripcion, a === e, a === e ? '' : `obtuve ${a}, esperaba ${e}`);
}

// ─────────────────────────────────────────────────────────────
grupo('RUT chileno');

// RUTs reales válidos (dígito verificador por módulo 11)
igual('11.111.111-1 es válido', validarRut('11.111.111-1'), true);
igual('12.345.678-5 es válido', validarRut('12345678-5'), true);
igual('6.666.666-2 es válido', validarRut('6666666-2'), true);
igual('6.666.666-3 es inválido', validarRut('6666666-3'), false);
igual('rechaza dígito incorrecto', validarRut('12345678-9'), false);
igual('rechaza texto', validarRut('no-soy-un-rut'), false);
igual('rechaza vacío', validarRut(''), false);
igual('acepta K minúscula', validarRut('20.347.878-k'), validarRut('20.347.878-K'));
igual('normaliza quitando puntos', normalizarRut('12.345.678-5'), '12345678-5');
comprobar('formatea con puntos', String(formatearRut('123456785')).includes('.'));

// ─────────────────────────────────────────────────────────────
grupo('Dinero y IVA (CLP sin decimales)');

comprobar('clp devuelve texto con separador', /\d/.test(String(clp(12990))));
const desglose = desglosarIva(11900, 0.19);
comprobar('desglosarIva devuelve neto e iva', desglose && typeof desglose === 'object');
igual('exento no cobra IVA', desglosarIva(10000, 0.19, false), { neto: 10000, iva: 0, total: 10000 });
if (desglose) {
  const d = desglose as Record<string, number>;
  const suma = Object.values(d).filter((v) => typeof v === 'number');
  comprobar('el neto es entero', Number.isInteger(d.neto ?? 0), `neto=${d.neto}`);
  comprobar('el iva es entero', Number.isInteger(d.iva ?? 0), `iva=${d.iva}`);
  comprobar(
    'neto + iva reconstruye el total',
    Math.abs((d.neto ?? 0) + (d.iva ?? 0) - 11900) <= 1,
    `neto=${d.neto} iva=${d.iva} total=${d.total ?? '-'}`,
  );
}

// ─────────────────────────────────────────────────────────────
grupo('Horas y fechas');

igual('horaAMinutos 08:30', horaAMinutos('08:30'), 510);
igual('horaAMinutos 00:00', horaAMinutos('00:00'), 0);
igual('minutosAHora 510', minutosAHora(510), '08:30');
igual('ida y vuelta 14:45', minutosAHora(horaAMinutos('14:45')), '14:45');
const edad = calcularEdad(new Date('1990-01-01'), null);
comprobar('calcularEdad sobre fecha de nacimiento', typeof edad === 'number' && edad > 30, `edad=${edad}`);
igual('calcularEdad usa la edad registrada si no hay fecha', calcularEdad(null, 42), 42);

// ─────────────────────────────────────────────────────────────
grupo('Texto');

igual('sinTildes', sinTildes('José Muñoz Pérez'), 'Jose Munoz Perez');
igual('iniciales', iniciales('Pablo', 'Espinoza'), 'PE');
comprobar('slugificar quita tildes y espacios', !/[\sáéíóúñ]/i.test(String(slugificar('Atención Médica Ñandú'))));

// ─────────────────────────────────────────────────────────────
grupo('Odontograma (notación FDI)');

const piezas = todasLasPiezas();
comprobar('hay 32 piezas permanentes', filasDe('PERMANENTE').superior.length + filasDe('PERMANENTE').inferior.length === 32,
  `${filasDe('PERMANENTE').superior.length + filasDe('PERMANENTE').inferior.length}`);
comprobar('hay 20 piezas temporales', filasDe('TEMPORAL').superior.length + filasDe('TEMPORAL').inferior.length === 20,
  `${filasDe('TEMPORAL').superior.length + filasDe('TEMPORAL').inferior.length}`);

const p11 = buscarPieza('1.1');
const p21 = buscarPieza('2.1');
comprobar('encuentra la pieza 1.1', Boolean(p11));
comprobar('encuentra la pieza 2.1', Boolean(p21));
comprobar('una pieza inexistente devuelve nada', !buscarPieza('9.9'));

// La regla clínica que más importa: mesial siempre mira a la línea media,
// así que en cuadrantes opuestos cae a lados opuestos de la pantalla.
if (p11 && p21) {
  const ladoDerecho = ladoDeLaCara('MESIAL', p11);
  const ladoIzquierdo = ladoDeLaCara('MESIAL', p21);
  comprobar(
    'mesial se refleja entre cuadrantes (no queda espejado)',
    ladoDerecho !== ladoIzquierdo,
    `1.1→${ladoDerecho}  2.1→${ladoIzquierdo}`,
  );
  comprobar('nombreCara devuelve texto legible', String(nombreCara('MESIAL', p11)).length > 3);
}

// ─────────────────────────────────────────────────────────────
grupo('Periodontograma');

// Convención del esquema: margen positivo = la encía cubre el límite
// amelocementario; negativo = recesión. El NIC es lo que la bolsa baja por
// debajo de ese límite.
igual('encía que cubre 2 mm reduce el NIC', nivelInsercion(5, 2), 3);
igual('recesión de 2 mm lo aumenta', nivelInsercion(4, -2), 6);
igual('sin pérdida de inserción', nivelInsercion(2, 2), 0);
igual('margen a nivel del límite: NIC = sondaje', nivelInsercion(5, 0), 5);
comprobar('el NIC nunca contradice al gráfico',
  nivelInsercion(5, 2) < 5 && nivelInsercion(5, -2) > 5,
  'la encía que cubre debe bajar el NIC y la recesión subirlo');
comprobar('una bolsa de 3 mm no es patológica', !esBolsaPatologica(3));
comprobar('una bolsa de 6 mm sí lo es', esBolsaPatologica(6));
comprobar('severidad devuelve una categoría', typeof severidadBolsa(7) === 'string');
comprobar('severidades distintas para 2 y 8 mm', severidadBolsa(2) !== severidadBolsa(8),
  `2mm=${severidadBolsa(2)} 8mm=${severidadBolsa(8)}`);

// ─────────────────────────────────────────────────────────────
grupo('WhatsApp');

igual('móvil de 9 dígitos', numeroWhatsapp('912345678'), '56912345678');
igual('con espacios y prefijo', numeroWhatsapp('+56 9 1234 5678'), '56912345678');
igual('con cero de marcación', numeroWhatsapp('09 1234 5678'), '56912345678');
igual('ocho dígitos añade el 9', numeroWhatsapp('12345678'), '56912345678');
igual('vacío no sirve', numeroWhatsapp(''), null);
igual('nulo no sirve', numeroWhatsapp(null), null);
igual('texto no sirve', numeroWhatsapp('sin teléfono'), null);
igual('demasiado corto no sirve', numeroWhatsapp('123'), null);
comprobar('el enlace apunta a wa.me', String(enlaceWhatsapp('912345678', 'hola')).startsWith('https://wa.me/'));
comprobar('el mensaje viaja codificado', String(enlaceWhatsapp('912345678', 'hola qué tal')).includes('%20'));
igual('sin teléfono no hay enlace', enlaceWhatsapp('nada', 'hola'), null);
igual('nombrePila toma sólo el primero', nombrePila('María José Pérez Soto'), 'María');

const msj = MENSAJES.recordatorioHora({ nombre: 'Camila Torres', centro: 'Clínica X', fecha: '20-08-2026', hora: '10:30', profesional: 'Dr. Soto' });
comprobar('el recordatorio incluye fecha, hora y profesional',
  msj.includes('20-08-2026') && msj.includes('10:30') && msj.includes('Dr. Soto'));
comprobar('el recordatorio saluda por el nombre de pila', msj.startsWith('Hola Camila,'), msj.slice(0, 30));

// ─────────────────────────────────────────────────────────────
grupo('Importación de inventario');

igual('entero simple', comoNumero('20'), 20);
igual('miles con punto', comoNumero('1.234'), 1234);
igual('decimal chileno', comoNumero('1.234,56'), 1234.56);
igual('medio litro no es 500', comoNumero('0.500'), 0.5);
igual('con signo peso', comoNumero('$12.990'), 12990);
igual('texto no es número', comoNumero('abc'), null);
igual('vacío es nulo', comoNumero(''), null);
igual('SI es verdadero', comoBooleano('SI', false), true);
igual('sí con tilde', comoBooleano('sí', false), true);
igual('NO es falso', comoBooleano('NO', true), false);
igual('vacío toma el valor por defecto', comoBooleano('', true), true);

comprobar('la plantilla de productos exige SKU y nombre',
  COLUMNAS_PRODUCTOS.filter((c: any) => c.obligatoria).map((c: any) => c.clave).join(',') === 'sku,nombre');
comprobar('cada columna tiene ayuda', COLUMNAS_PRODUCTOS.every((c: any) => c.ayuda && c.ayuda.length > 10));
comprobar('la plantilla de conteo exige SKU', COLUMNAS_CONTEO.some((c: any) => c.clave === 'sku' && c.obligatoria));
comprobar('el conteo NO pide la existencia del sistema',
  !COLUMNAS_CONTEO.some((c: any) => /teorico|sistema|stock/i.test(c.clave)));

// ─────────────────────────────────────────────────────────────
grupo('Permisos');

comprobar('hay 25 módulos', MODULOS.length === 25, `${MODULOS.length}`);
comprobar('todo módulo declara al menos "ver"', MODULOS.every((m: any) => m.acciones.includes('ver')));
comprobar('toda acción declarada existe en ACCIONES',
  MODULOS.every((m: any) => m.acciones.every((a: string) => ACCIONES.includes(a))));
comprobar('toda acción tiene etiqueta', ACCIONES.every((a: string) => Boolean(ETIQUETA_ACCION[a])));
comprobar('los slugs de módulo no se repiten',
  new Set(MODULOS.map((m: any) => m.slug)).size === MODULOS.length);
igual('claveP arma modulo.accion', claveP('pacientes', 'ver'), 'pacientes.ver');

const permisosAdmin = expandirPermisos(ROLES_SEMILLA.find((r: any) => r.slug === 'administrador').permisos);
const totalPosibles = MODULOS.reduce((n: number, m: any) => n + m.acciones.length, 0);
comprobar('el administrador recibe todos los permisos',
  permisosAdmin.filter((p: any) => p.permitido).length === totalPosibles,
  `${permisosAdmin.filter((p: any) => p.permitido).length} de ${totalPosibles}`);
comprobar('inventario incluye aprobar (cerrar conteos)',
  MODULOS.find((m: any) => m.slug === 'inventario').acciones.includes('aprobar'));
comprobar('usuarios incluye suplantar (ver como)',
  MODULOS.find((m: any) => m.slug === 'usuarios').acciones.includes('suplantar'));

const rolesSinAdmin = ROLES_SEMILLA.filter((r: any) => r.slug !== 'administrador');
comprobar('ningún rol no administrador puede suplantar',
  rolesSinAdmin.every((r: any) => !expandirPermisos(r.permisos).some((p: any) => p.permitido && p.modulo === 'usuarios' && p.accion === 'suplantar')));
comprobar('ningún rol no administrador puede aprobar conteos',
  rolesSinAdmin.every((r: any) => !expandirPermisos(r.permisos).some((p: any) => p.permitido && p.modulo === 'inventario' && p.accion === 'aprobar')));

// ─────────────────────────────────────────────────────────────
grupo('Módulo de ayuda');

comprobar('hay una guía por cada módulo con página propia',
  GUIAS.length >= 20, `${GUIAS.length} guías`);
const slugsModulo = new Set(MODULOS.map((m: any) => m.slug));
const huerfanas = GUIAS.filter((g: any) => !slugsModulo.has(g.slug)).map((g: any) => g.slug);
comprobar('ninguna guía apunta a un módulo inexistente', huerfanas.length === 0, huerfanas.join(', '));

const rotos = GUIAS.flatMap((g: any) => (g.relacionados ?? []).filter((r: string) => !guiaDe(r)).map((r: string) => `${g.slug}→${r}`));
comprobar('todos los enlaces «relacionados» existen', rotos.length === 0, rotos.join(', '));

const areasMalas = GUIAS.filter((g: any) => !AREAS.includes(g.area)).map((g: any) => `${g.slug}:${g.area}`);
comprobar('toda guía cae en un área conocida', areasMalas.length === 0, areasMalas.join(', '));
comprobar('toda guía tiene pasos', GUIAS.every((g: any) => g.pasos.length > 0));

comprobar('buscar «caries» encuentra el odontograma',
  buscarGuias('caries').some((g: any) => g.slug === 'odontograma'));
comprobar('buscar sin tildes funciona',
  buscarGuias('periodontograma').length > 0 && buscarGuias('agendar hora').length > 0);
comprobar('buscar algo inexistente no devuelve nada', buscarGuias('zzzzqqq').length === 0);

// ─────────────────────────────────────────────────────────────
grupo('Higiene del código fuente');

// Un byte NUL en una cadena compila sin quejarse y revienta en tiempo de
// ejecución: PostgreSQL rechaza de plano el texto que lo contiene. Ya pasó
// una vez, en un centinela del buscador, y el error sólo apareció en
// producción.
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const IGNORAR = new Set(['node_modules', '.next', '.git', 'storage', 'dist']);
  const sucios: string[] = [];

  const recorrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR.has(entrada.name)) continue;
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(completo);
      } else if (/\.(ts|tsx|js|mjs|css|sql|json|md|yml|prisma)$/.test(entrada.name)) {
        if (fs.readFileSync(completo).includes(0)) sucios.push(path.relative(raiz, completo));
      }
    }
  };
  recorrer(raiz);

  comprobar('ningún archivo del proyecto contiene un byte NUL', sucios.length === 0, sucios.join(', '));
}

// ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`  ${pasadas} comprobaciones pasadas, ${fallos.length} fallidas`);
if (fallos.length > 0) {
  console.log('\n  FALLOS:');
  for (const f of fallos) console.log(`   · ${f}`);
}
console.log('═'.repeat(60));
process.exit(fallos.length > 0 ? 1 : 0);
