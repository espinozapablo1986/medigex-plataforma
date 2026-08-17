import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Endpoint de salud para Uptime Kuma / healthcheck de Docker. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      estado: 'ok',
      db: 'ok',
      // Commit con el que se construyó esta imagen. Sirve para confirmar que
      // el contenedor en ejecución es realmente el del último despliegue.
      version: process.env.APP_VERSION ?? 'desconocida',
      hora: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ estado: 'degradado', db: 'error' }, { status: 503 });
  }
}
