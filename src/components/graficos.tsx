'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETA = ['#3384fb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

function clpCorto(valor: number) {
  if (Math.abs(valor) >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1)}M`;
  if (Math.abs(valor) >= 1_000) return `$${Math.round(valor / 1_000)}k`;
  return `$${valor}`;
}

function clpCompleto(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor);
}

const ejeComun = {
  tick: { fill: '#64748b', fontSize: 12 },
  axisLine: { stroke: '#e2e8f0' },
  tickLine: false,
};

const tooltipComun = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
  },
};

/** Ingresos vs. gastos por período. */
export function GraficoIngresosGastos({
  datos,
}: {
  datos: { periodo: string; ingresos: number; gastos: number; resultado: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="periodo" {...ejeComun} />
        <YAxis tickFormatter={clpCorto} {...ejeComun} width={60} />
        <Tooltip formatter={(v: number) => clpCompleto(v)} {...tooltipComun} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Evolución de una serie en el tiempo. */
export function GraficoLinea({
  datos,
  etiqueta,
  color = '#3384fb',
}: {
  datos: { periodo: string; valor: number }[];
  etiqueta: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="periodo" {...ejeComun} />
        <YAxis tickFormatter={clpCorto} {...ejeComun} width={60} />
        <Tooltip formatter={(v: number) => clpCompleto(v)} {...tooltipComun} />
        <Line
          type="monotone"
          dataKey="valor"
          name={etiqueta}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Distribución por categoría. */
export function GraficoTorta({ datos }: { datos: { nombre: string; valor: number }[] }) {
  if (datos.length === 0) {
    return <p className="py-12 text-center text-sm text-tinta-400">Sin datos en el período.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={datos}
          dataKey="valor"
          nameKey="nombre"
          cx="50%"
          cy="50%"
          outerRadius={95}
          innerRadius={55}
          paddingAngle={2}
        >
          {datos.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => clpCompleto(v)} {...tooltipComun} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Ranking horizontal (servicios más vendidos, profesionales, etc.). */
export function GraficoBarrasHorizontal({
  datos,
  color = '#3384fb',
  formatoMoneda = true,
}: {
  datos: { nombre: string; valor: number }[];
  color?: string;
  formatoMoneda?: boolean;
}) {
  if (datos.length === 0) {
    return <p className="py-12 text-center text-sm text-tinta-400">Sin datos en el período.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, datos.length * 38)}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tickFormatter={formatoMoneda ? clpCorto : undefined} {...ejeComun} />
        <YAxis type="category" dataKey="nombre" width={170} {...ejeComun} />
        <Tooltip formatter={(v: number) => (formatoMoneda ? clpCompleto(v) : v)} {...tooltipComun} />
        <Bar dataKey="valor" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
