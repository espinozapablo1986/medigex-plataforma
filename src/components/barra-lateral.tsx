'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileCheck,
  FileText,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pill,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Target,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { Logotipo } from './marca';
import type { GrupoNav } from '@/lib/navegacion';

const ICONOS: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Users,
  ArrowLeftRight,
  Pill,
  FileText,
  ShoppingCart,
  CreditCard,
  Handshake,
  FileCheck,
  Target,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  Stethoscope,
  ClipboardList,
  DoorOpen,
  Truck,
  UserCog,
  ShieldCheck,
  Settings,
};

export function BarraLateral({
  grupos,
  usuario,
  nombreClinica,
}: {
  grupos: GrupoNav[];
  usuario: { nombre: string; rol: string; iniciales: string };
  nombreClinica: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const contenido = (
    <>
      <div className="flex h-16 flex-col justify-center gap-0.5 border-b border-brand-800 px-4">
        <Logotipo tamano="sm" variante="oscuro" />
        <span className="truncate pl-[30px] text-xs text-brand-400">{nombreClinica}</span>
      </div>

      <nav className="scroll-fino flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-400">
              {grupo.titulo}
            </p>
            <ul className="space-y-0.5">
              {grupo.items.map((item) => {
                const Icono = ICONOS[item.icono] ?? LayoutDashboard;
                const activo = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setAbierto(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition',
                        activo
                          ? 'bg-brand-600 font-medium text-white'
                          : 'text-brand-200 hover:bg-brand-800 hover:text-white',
                      )}
                    >
                      <Icono className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.texto}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-brand-800 p-3">
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            {usuario.iniciales}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{usuario.nombre}</p>
            <p className="truncate text-xs text-brand-400">{usuario.rol}</p>
          </div>
        </div>
        <form action="/api/salir" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-brand-200 transition hover:bg-brand-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior móvil */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-tinta-200 bg-white px-4 lg:hidden no-imprimir">
        <button onClick={() => setAbierto(true)} className="rounded-lg p-1.5 text-tinta-600 hover:bg-tinta-100">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-tinta-900">{nombreClinica}</span>
      </div>

      {/* Panel móvil */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-imprimir">
          <div className="absolute inset-0 bg-brand-900/50" onClick={() => setAbierto(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-brand-900">
            <button
              onClick={() => setAbierto(false)}
              className="absolute right-2 top-3.5 rounded p-1 text-brand-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {contenido}
          </aside>
        </div>
      )}

      {/* Barra fija en escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-brand-900 lg:flex no-imprimir">
        {contenido}
      </aside>
    </>
  );
}
