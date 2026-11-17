"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function OrdersChart({ data, label }: { data: { day: string; orders: number; collected: number }[]; label: string }) {
  return (
    <article className="border border-line bg-ivory p-4">
      <h2 className="mb-4 text-sm">{label}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid stroke="#E7E1D6" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#8A847A" />
            <YAxis tick={{ fontSize: 11 }} stroke="#8A847A" />
            <Tooltip contentStyle={{ background: "#F5F1E9", border: "1px solid #DDD6C8" }} />
            <Area dataKey="orders" stroke="#171717" fill="#C6B69B" fillOpacity={0.45} />
            <Area dataKey="collected" stroke="#A58B62" fill="#A58B62" fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
