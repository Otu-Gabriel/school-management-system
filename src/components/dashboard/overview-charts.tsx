"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["var(--brand-primary)", "var(--brand-accent)"];

export function OverviewCharts({
  enrollmentByLevel,
  genderSplit,
}: {
  enrollmentByLevel: { name: string; students: number }[];
  genderSplit: { name: string; value: number }[];
}) {
  return (
    <div className="grid gap-2.5 xl:grid-cols-2">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Students by level
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enrollmentByLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="students" fill="var(--brand-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Gender distribution
        </h3>
        <div className="flex h-52 items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genderSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={3}
              >
                {genderSplit.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 pr-3 text-xs">
            {genderSplit.map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COLORS[index % COLORS.length] }}
                />
                <span className="text-[var(--muted-foreground)]">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
