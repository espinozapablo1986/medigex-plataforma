import { NextResponse } from 'next/server';
import { cerrarSesion } from '@/lib/auth';

export async function POST(request: Request) {
  await cerrarSesion();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
