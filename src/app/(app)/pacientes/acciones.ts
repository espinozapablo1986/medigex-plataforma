'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CategoriaAdjunto, Sexo, TipoExamen } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { normalizarRut, validarRut } from '@/lib/format';
import { consumirInsumosDeServicio } from '@/lib/inventario';
import { eliminarAdjunto, guardarAdjunto } from '@/lib/uploads';
import {
  booleano,
  decimal,
  entero,
  fecha,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const SEXOS: Sexo[] = ['MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA'];
const TIPOS_EXAMEN: TipoExamen[] = [
  'RADIOGRAFIA',
  'LABORATORIO',
  'IMAGENOLOGIA',
  'BIOPSIA',
  'ELECTROCARDIOGRAMA',
  'OTRO',
];
const CATEGORIAS_ADJUNTO: CategoriaAdjunto[] = [
  'FOTOGRAFIA',
  'RADIOGRAFIA',
  'DOCUMENTO',
  'EXAMEN',
  'CONSENTIMIENTO',
  'COMPROBANTE_PAGO',
  'DOCUMENTO_TRIBUTARIO',
  'PRESUPUESTO',
  'OTRO',
];

// ═══════════════════════════════════════════════════════════════
//  Ficha del paciente
// ═══════════════════════════════════════════════════════════════

function datosPaciente(fd: FormData) {
  const rut = textoOpcional(fd, 'rut');
  const pasaporte = textoOpcional(fd, 'pasaporte');

  if (!rut && !pasaporte) {
    throw new Error('Debes ingresar el RUT del paciente o, si es extranjero sin RUT, su número de pasaporte.');
  }
  if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido. Revisa el dígito verificador.');

  const sexo = texto(fd, 'sexo') as Sexo;
  const edad = entero(fd, 'edadRegistrada', -1);
  const vieneDeOtroCentro = booleano(fd, 'vieneDeOtroCentro');

  return {
    rut: rut ? normalizarRut(rut) : null,
    pasaporte,
    nombres: requerido(fd, 'nombres', 'Nombres'),
    apellidoPaterno: requerido(fd, 'apellidoPaterno', 'Apellido paterno'),
    apellidoMaterno: textoOpcional(fd, 'apellidoMaterno'),
    fechaNacimiento: fecha(fd, 'fechaNacimiento'),
    edadRegistrada: edad >= 0 ? edad : null,
    sexo: SEXOS.includes(sexo) ? sexo : ('NO_ESPECIFICA' as Sexo),
    telefonoPrincipal: requerido(fd, 'telefonoPrincipal', 'Teléfono principal'),
    telefonoSecundario: textoOpcional(fd, 'telefonoSecundario'),
    email: textoOpcional(fd, 'email'),
    direccion: textoOpcional(fd, 'direccion'),
    comuna: textoOpcional(fd, 'comuna'),
    ciudad: textoOpcional(fd, 'ciudad'),
    ocupacion: textoOpcional(fd, 'ocupacion'),
    previsionId: textoOpcional(fd, 'previsionId'),
    previsionDetalle: textoOpcional(fd, 'previsionDetalle'),
    convenioId: textoOpcional(fd, 'convenioId'),
    numeroAfiliado: textoOpcional(fd, 'numeroAfiliado'),

    vieneDeOtroCentro,
    centroOrigen: vieneDeOtroCentro ? textoOpcional(fd, 'centroOrigen') : null,
    profesionalOrigen: vieneDeOtroCentro ? textoOpcional(fd, 'profesionalOrigen') : null,
    motivoDerivacion: vieneDeOtroCentro ? textoOpcional(fd, 'motivoDerivacion') : null,
    fechaDerivacion: vieneDeOtroCentro ? fecha(fd, 'fechaDerivacion') : null,

    alergias: textoOpcional(fd, 'alergias'),
    antecedentesMedicos: textoOpcional(fd, 'antecedentesMedicos'),
    medicamentosActuales: textoOpcional(fd, 'medicamentosActuales'),
    antecedentesQuirurgicos: textoOpcional(fd, 'antecedentesQuirurgicos'),
    observaciones: textoOpcional(fd, 'observaciones'),

    contactoEmergenciaNombre: textoOpcional(fd, 'contactoEmergenciaNombre'),
    contactoEmergenciaTelefono: textoOpcional(fd, 'contactoEmergenciaTelefono'),
    contactoEmergenciaRelacion: textoOpcional(fd, 'contactoEmergenciaRelacion'),
    comoNosConocio: textoOpcional(fd, 'comoNosConocio'),
  };
}

export async function crearPaciente(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';
  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('pacientes', 'crear');
    const datos = datosPaciente(fd);

    if (datos.rut) {
      const existente = await prisma.paciente.findUnique({ where: { rut: datos.rut } });
      if (existente) {
        throw new Error(
          `Ya existe una ficha con el RUT ${datos.rut}: ${existente.nombres} ${existente.apellidoPaterno} (ficha Nº ${existente.numeroFicha}).`,
        );
      }
    }

    const paciente = await prisma.paciente.create({ data: { ...datos, creadoPorId: sesion.usuarioId } });
    nuevoId = paciente.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'pacientes',
      entidad: 'Paciente',
      entidadId: paciente.id,
      detalle: { numeroFicha: paciente.numeroFicha },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/pacientes');
  redirect(`/pacientes/${nuevoId}`);
}

export async function editarPaciente(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('pacientes', 'editar');
    const id = requerido(fd, 'id', 'Paciente');
    const datos = datosPaciente(fd);

    if (datos.rut) {
      const existente = await prisma.paciente.findUnique({ where: { rut: datos.rut } });
      if (existente && existente.id !== id) throw new Error('Ese RUT ya pertenece a otra ficha de paciente.');
    }

    await prisma.paciente.update({ where: { id }, data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'pacientes',
      entidad: 'Paciente',
      entidadId: id,
    });

    revalidatePath(`/pacientes/${id}`);
    revalidatePath('/pacientes');
    return { ok: true as const, mensaje: 'Ficha actualizada.' };
  });
}

export async function alternarActivoPaciente(fd: FormData): Promise<void> {
  await exigirPermiso('pacientes', 'editar');
  const id = String(fd.get('id'));
  const paciente = await prisma.paciente.findUnique({ where: { id } });
  if (!paciente) return;
  await prisma.paciente.update({ where: { id }, data: { activo: !paciente.activo } });
  revalidatePath('/pacientes');
  revalidatePath(`/pacientes/${id}`);
}

export async function eliminarPaciente(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('pacientes', 'eliminar');
  const id = String(fd.get('id'));

  const atenciones = await prisma.atencion.count({ where: { pacienteId: id } });
  if (atenciones > 0) {
    throw new Error(
      `Esta ficha tiene ${atenciones} atención(es) registradas. Por trazabilidad clínica no puede eliminarse: desactívala.`,
    );
  }

  await prisma.paciente.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'pacientes',
    entidad: 'Paciente',
    entidadId: id,
  });
  redirect('/pacientes');
}

// ═══════════════════════════════════════════════════════════════
//  Atenciones (historia clínica)
// ═══════════════════════════════════════════════════════════════

export async function registrarAtencion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('historia_clinica', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    // El motivo de consulta es obligatorio en toda atención.
    const motivoConsulta = requerido(fd, 'motivoConsulta', 'Motivo de consulta');
    const citaId = textoOpcional(fd, 'citaId');

    const temperatura = texto(fd, 'temperatura');
    const peso = texto(fd, 'pesoKg');
    const talla = texto(fd, 'tallaCm');
    const fc = texto(fd, 'frecuenciaCardiaca');
    const sat = texto(fd, 'saturacion');

    const atencion = await prisma.$transaction(async (tx) => {
      const creada = await tx.atencion.create({
        data: {
          pacienteId,
          profesionalId,
          citaId,
          fecha: fecha(fd, 'fecha') ?? new Date(),
          motivoConsulta,
          anamnesis: textoOpcional(fd, 'anamnesis'),
          examenFisico: textoOpcional(fd, 'examenFisico'),
          diagnostico: textoOpcional(fd, 'diagnostico'),
          cie10: textoOpcional(fd, 'cie10'),
          tratamientoRealizado: textoOpcional(fd, 'tratamientoRealizado'),
          indicaciones: textoOpcional(fd, 'indicaciones'),
          observaciones: textoOpcional(fd, 'observaciones'),
          proximoControl: fecha(fd, 'proximoControl'),
          presionArterial: textoOpcional(fd, 'presionArterial'),
          frecuenciaCardiaca: fc === '' ? null : entero(fd, 'frecuenciaCardiaca'),
          temperatura: temperatura === '' ? null : decimal(fd, 'temperatura'),
          pesoKg: peso === '' ? null : decimal(fd, 'pesoKg'),
          tallaCm: talla === '' ? null : decimal(fd, 'tallaCm'),
          saturacion: sat === '' ? null : entero(fd, 'saturacion'),
          registradoPorId: sesion.usuarioId,
        },
      });

      // Marca la cita como atendida y descuenta los insumos de cada servicio
      // de la sesión, que pueden ser varios.
      if (citaId) {
        const cita = await tx.cita.findUnique({
          where: { id: citaId },
          include: { servicios: true },
        });
        if (cita) {
          await tx.cita.update({
            where: { id: citaId },
            data: { estado: 'ATENDIDA', atendidaAt: new Date(), motivoConsulta },
          });
          for (const linea of cita.servicios) {
            await consumirInsumosDeServicio(tx, {
              servicioId: linea.servicioId,
              veces: linea.cantidad,
              referenciaTipo: 'atencion',
              referenciaId: creada.id,
              usuarioId: sesion.usuarioId,
            });
          }
        }
      }

      return creada;
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'historia_clinica',
      entidad: 'Atencion',
      entidadId: atencion.id,
      detalle: { pacienteId },
    });

    revalidatePath(`/pacientes/${pacienteId}`);
    revalidatePath(`/pacientes/${pacienteId}/historia`);
    revalidatePath('/agenda');
    return { ok: true as const, mensaje: 'Atención registrada en la historia clínica.' };
  });
}

export async function editarAtencion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('historia_clinica', 'editar');
    const id = requerido(fd, 'id', 'Atención');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');

    await prisma.atencion.update({
      where: { id },
      data: {
        motivoConsulta: requerido(fd, 'motivoConsulta', 'Motivo de consulta'),
        anamnesis: textoOpcional(fd, 'anamnesis'),
        examenFisico: textoOpcional(fd, 'examenFisico'),
        diagnostico: textoOpcional(fd, 'diagnostico'),
        cie10: textoOpcional(fd, 'cie10'),
        tratamientoRealizado: textoOpcional(fd, 'tratamientoRealizado'),
        indicaciones: textoOpcional(fd, 'indicaciones'),
        observaciones: textoOpcional(fd, 'observaciones'),
        proximoControl: fecha(fd, 'proximoControl'),
      },
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'historia_clinica',
      entidad: 'Atencion',
      entidadId: id,
    });

    revalidatePath(`/pacientes/${pacienteId}/historia`);
    return { ok: true as const, mensaje: 'Atención actualizada.' };
  });
}

// ═══════════════════════════════════════════════════════════════
//  Exámenes
// ═══════════════════════════════════════════════════════════════

export async function crearExamen(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('historia_clinica', 'crear');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const tipo = texto(fd, 'tipo') as TipoExamen;

    await prisma.examen.create({
      data: {
        pacienteId,
        atencionId: textoOpcional(fd, 'atencionId'),
        solicitadoPorId: textoOpcional(fd, 'solicitadoPorId'),
        tipo: TIPOS_EXAMEN.includes(tipo) ? tipo : ('OTRO' as TipoExamen),
        nombre: requerido(fd, 'nombre', 'Nombre del examen'),
        descripcion: textoOpcional(fd, 'descripcion'),
        laboratorio: textoOpcional(fd, 'laboratorio'),
        fechaSolicitud: fecha(fd, 'fechaSolicitud') ?? new Date(),
      },
    });

    await auditar({ usuarioId: sesion.usuarioId, accion: 'crear', modulo: 'historia_clinica', entidad: 'Examen' });
    revalidatePath(`/pacientes/${pacienteId}/examenes`);
    return { ok: true as const, mensaje: 'Examen solicitado.' };
  });
}

export async function registrarResultadoExamen(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('historia_clinica', 'editar');
    const id = requerido(fd, 'id', 'Examen');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');

    await prisma.examen.update({
      where: { id },
      data: {
        estado: 'CON_RESULTADO',
        resultado: requerido(fd, 'resultado', 'Resultado'),
        interpretacion: textoOpcional(fd, 'interpretacion'),
        fechaResultado: fecha(fd, 'fechaResultado') ?? new Date(),
        fechaRealizacion: fecha(fd, 'fechaRealizacion'),
      },
    });

    revalidatePath(`/pacientes/${pacienteId}/examenes`);
    return { ok: true as const, mensaje: 'Resultado registrado.' };
  });
}

export async function eliminarExamen(fd: FormData): Promise<void> {
  await exigirPermiso('historia_clinica', 'eliminar');
  const id = String(fd.get('id'));
  const examen = await prisma.examen.findUnique({ where: { id } });
  if (!examen) return;
  await prisma.examen.delete({ where: { id } });
  revalidatePath(`/pacientes/${examen.pacienteId}/examenes`);
}

// ═══════════════════════════════════════════════════════════════
//  Adjuntos (fotografías, documentos, radiografías…)
// ═══════════════════════════════════════════════════════════════

export async function subirArchivos(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('historia_clinica', 'crear');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const categoria = texto(fd, 'categoria') as CategoriaAdjunto;
    const descripcion = textoOpcional(fd, 'descripcion');
    const atencionId = textoOpcional(fd, 'atencionId');
    const examenId = textoOpcional(fd, 'examenId');

    const archivos = fd.getAll('archivos').filter((a): a is File => a instanceof File && a.size > 0);
    if (archivos.length === 0) throw new Error('Selecciona al menos un archivo.');

    for (const archivo of archivos) {
      await guardarAdjunto({
        archivo,
        categoria: CATEGORIAS_ADJUNTO.includes(categoria) ? categoria : ('DOCUMENTO' as CategoriaAdjunto),
        descripcion: descripcion ?? undefined,
        subidoPorId: sesion.usuarioId,
        vinculo: { pacienteId, atencionId: atencionId ?? undefined, examenId: examenId ?? undefined },
      });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'subir_adjunto',
      modulo: 'historia_clinica',
      entidad: 'Paciente',
      entidadId: pacienteId,
      detalle: { cantidad: archivos.length },
    });

    revalidatePath(`/pacientes/${pacienteId}/archivos`);
    revalidatePath(`/pacientes/${pacienteId}`);
    return { ok: true as const, mensaje: `${archivos.length} archivo(s) subido(s).` };
  });
}

export async function borrarArchivo(fd: FormData): Promise<void> {
  await exigirPermiso('historia_clinica', 'eliminar');
  const id = String(fd.get('id'));
  const adjunto = await prisma.adjunto.findUnique({ where: { id } });
  if (!adjunto) return;
  await eliminarAdjunto(id);
  if (adjunto.pacienteId) revalidatePath(`/pacientes/${adjunto.pacienteId}/archivos`);
}
