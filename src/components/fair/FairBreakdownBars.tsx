import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FairDashboardBreakdown } from '@/lib/fair-dashboard-types';

type Props = {
  breakdown: FairDashboardBreakdown;
};

export function FairBreakdownBars({ breakdown }: Props) {
  const data = [
    { name: 'Frete peso', pct: breakdown.freightWeight, fill: '#2E5AAC' },
    { name: 'Pedágio est.', pct: breakdown.tollEstimated, fill: '#F5A623' },
    { name: 'Taxas', pct: breakdown.fees, fill: '#6B7280' },
  ];

  return (
    <Card className="border-[#0B1D3A]/15 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[#0B1D3A]">Composição média</CardTitle>
      </CardHeader>
      <CardContent className="h-44 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={92}
              tick={{ fontSize: 12, fill: '#0B1D3A' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [`${v}%`, '']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={18}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
