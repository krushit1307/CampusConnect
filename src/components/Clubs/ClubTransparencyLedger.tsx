import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ShieldCheck } from "lucide-react";

export function ClubTransparencyLedger({ clubId }: { clubId: string }) {
  const supabase = createClient();

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["club_transparency_ledger", clubId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_club_ledger", {
        p_club_id: clubId,
      });

      // If the ledger is not public or there's an error, data will be null/empty
      if (error) {
        console.error("Error fetching ledger:", error);
        return null;
      }
      return data;
    },
    enabled: !!clubId,
  });

  // If no data is returned, it means the ledger is private or there are no expenses.
  if (isLoading || !ledgerData || ledgerData.length === 0) {
    return null;
  }

  // Format data for Recharts
  const chartData = ledgerData.map((item: any) => ({
    name: item.category,
    value: Number(item.total_amount),
  }));

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#ffc658"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white neu-border p-3 shadow-lg">
          <p className="font-bold text-sm mb-1">{payload[0].name}</p>
          <p className="font-mono text-lg font-black text-emerald-600">
            ${payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="px-4 py-12 md:px-6 bg-cream border-t-2 border-black">
      <div className="mx-auto max-w-6xl">
        <div className="neu-border bg-white p-6 md:p-8 relative overflow-hidden">
          {/* Badge */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full border-2 border-emerald-300 shadow-sm animate-in fade-in zoom-in">
            <ShieldCheck size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Verified Transparent</span>
          </div>

          <h2 className="mb-2 text-2xl md:text-3xl font-display font-black text-black">
            Financial Transparency Ledger
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl text-sm leading-relaxed">
            This club has opted into the Public Transparency Ledger. Below is a high-level breakdown of how member dues and funding have been utilized over the lifetime of the club. 
          </p>

          <div className="w-full h-[350px] md:h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius="80%"
                  fill="#8884d8"
                  dataKey="value"
                  stroke="#000"
                  strokeWidth={2}
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
