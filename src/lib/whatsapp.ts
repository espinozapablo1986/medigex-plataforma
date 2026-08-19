/**
 * Enlaces de WhatsApp con el mensaje ya escrito.
 *
 * Es un envío **manual**: la plataforma no manda nada por su cuenta. Prepara
 * el mensaje y abre WhatsApp con el número del paciente ya cargado, para que
 * la persona lo revise y decida si lo envía. No hay cola, ni proveedor, ni
 * trámite de alta de por medio.
 */

/**
 * Normaliza un teléfono chileno al formato internacional que espera wa.me.
 *
 * Acepta lo que la gente escribe de verdad: «+56 9 1234 5678», «912345678»,
 * «09 1234 5678». Devuelve null si no queda un número plausible, para no
 * ofrecer un botón que llevaría a una conversación vacía.
 */
export function numeroWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;

  let digitos = telefono.replace(/\D/g, '');
  if (!digitos) return null;

  // Un 0 inicial es de marcación nacional antigua y sobra en el formato
  // internacional.
  digitos = digitos.replace(/^0+/, '');

  // Si ya viene con el código de país, se respeta.
  if (digitos.startsWith('56')) {
    return digitos.length >= 11 ? digitos : null;
  }

  // Móvil chileno sin código de país: 9 dígitos empezando en 9.
  if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`;

  // Ocho dígitos: suele ser un móvil al que le falta el 9.
  if (digitos.length === 8) return `569${digitos}`;

  return null;
}

export function enlaceWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = numeroWhatsapp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/** Sólo el nombre de pila: escribir el nombre completo suena a circular. */
export function nombrePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

function formatearMonto(monto: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto);
}

/**
 * Mensajes predefinidos por situación.
 *
 * Están redactados en el tono que usaría recepción por teléfono: tratan de
 * usted al centro y de tú al paciente, no prometen nada que la plataforma no
 * pueda cumplir, y siempre terminan en una pregunta para que la conversación
 * pueda seguir.
 */
export const MENSAJES = {
  recordatorioHora: (p: { nombre: string; centro: string; fecha: string; hora: string; profesional: string }) =>
    `Hola ${nombrePila(p.nombre)}, te recordamos de ${p.centro} tu hora del ${p.fecha} a las ${p.hora} con ${p.profesional}. ¿Nos confirmas que puedes asistir?`,

  reagendar: (p: { nombre: string; centro: string }) =>
    `Hola ${nombrePila(p.nombre)}, te saludamos de ${p.centro}. Notamos que no pudiste asistir a tu hora. ¿Te ayudamos a reagendarla?`,

  saldoPendiente: (p: { nombre: string; centro: string; monto: number }) =>
    `Hola ${nombrePila(p.nombre)}, te contactamos de ${p.centro} por el saldo pendiente de tu atención (${formatearMonto(p.monto)}). ¿Podemos coordinar el pago?`,

  presupuesto: (p: { nombre: string; centro: string; folio?: string | number }) =>
    `Hola ${nombrePila(p.nombre)}, te escribimos de ${p.centro} por el presupuesto${p.folio ? ` N° ${p.folio}` : ''} que te enviamos. ¿Tienes alguna duda que podamos resolver?`,

  control: (p: { nombre: string; centro: string }) =>
    `Hola ${nombrePila(p.nombre)}, te escribimos de ${p.centro}. Tu profesional dejó indicado un control que ya está pendiente. ¿Te acomoda que te agendemos una hora esta semana?`,

  invitarVolver: (p: { nombre: string; centro: string }) =>
    `Hola ${nombrePila(p.nombre)}, te saludamos de ${p.centro}. Vimos que ha pasado un tiempo desde tu última atención y queríamos saber cómo estás. ¿Te gustaría agendar una hora de control?`,

  receta: (p: { nombre: string; centro: string }) =>
    `Hola ${nombrePila(p.nombre)}, te saludamos de ${p.centro}. Tenemos lista tu receta. ¿Prefieres pasar a retirarla o que te la enviemos por este medio?`,

  contactoGeneral: (p: { nombre: string; centro: string }) =>
    `Hola ${nombrePila(p.nombre)}, te saludamos de ${p.centro}. ¿En qué podemos ayudarte?`,
} as const;
