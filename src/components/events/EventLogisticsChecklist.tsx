import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { ClipboardList, ChefHat, Accessibility, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EventLogisticsChecklistProps {
  eventId: string;
}

export function EventLogisticsChecklist({ eventId }: EventLogisticsChecklistProps) {
  const supabase = createClient();

  // Fetchaggregated logistics metrics
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["event-logistics-agg", eventId],
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("aggregate_event_logistics", {
        p_event_id: eventId
      });
      if (error) throw error;
      return res || { total_registered: 0, dietary: {}, accessibility: {} };
    }
  });

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-50 border border-gray-200 h-24 rounded-none flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
        <span className="font-mono text-xs text-gray-400">Aggregating logistics checklists...</span>
      </div>
    );
  }

  const totalRegistered = data?.total_registered || 0;
  const dietary = data?.dietary || {};
  const accessibility = data?.accessibility || {};

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Event Dietary Logistics Manifest</title>
          <style>
            body { font-family: monospace; padding: 40px; color: black; }
            h1 { text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 5px; }
            p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th, td { border: 1px solid black; padding: 12px; text-align: left; }
            th { background: #f2f2f2; text-transform: uppercase; font-weight: bold; }
            .footer { margin-top: 40px; font-size: 10px; color: #555; border-top: 1px dashed black; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Dietary Logistics Manifest</h1>
          <p><strong>Event ID:</strong> ${eventId}</p>
          <p><strong>Generated At:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total RSVPs Registered:</strong> ${totalRegistered}</p>
          
          <table>
            <thead>
              <tr>
                <th>Dietary Preference / Allergy</th>
                <th>Quantity Required</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(dietary)
                .map(([tag, count]) => `<tr><td>${tag}</td><td><strong>${count}</strong></td></tr>`)
                .join("")}
              ${Object.keys(dietary).length === 0 ? "<tr><td colspan='2'>No dietary requests reported.</td></tr>" : ""}
            </tbody>
          </table>

          <div class="footer">
            CONFIDENTIAL - Aggregated Event Logistics (PII stripped). Generated automatically by CampusConnect.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="neu-border bg-white p-6 text-black shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-black pb-4">
        <div className="space-y-1">
          <h3 className="font-display font-black text-lg uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            Organiser Logistics Manifest
          </h3>
          <p className="font-mono text-[10px] text-gray-500 uppercase">
            Total RSVPs Registered: {totalRegistered}
          </p>
        </div>
        <Button
          onClick={handleExportPDF}
          disabled={Object.keys(dietary).length === 0}
          className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 font-mono text-xs font-bold uppercase rounded-none py-2 px-3 shadow-[2px_2px_0_0_#000] inline-flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" /> Export for Caterer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dietary Requirements section */}
        <div className="space-y-3">
          <h4 className="font-mono text-xs font-black uppercase text-gray-400 flex items-center gap-1.5">
            <ChefHat className="w-4 h-4 text-orange-500" />
            Dietary Requirements
          </h4>
          <div className="space-y-2">
            {Object.keys(dietary).length > 0 ? (
              Object.entries(dietary).map(([tag, count]) => (
                <div key={tag} className="border border-black p-3 bg-gray-50 flex justify-between items-center font-mono text-xs">
                  <span className="font-bold text-gray-800">{tag}</span>
                  <span className="bg-black text-white px-2 py-0.5 font-bold">{count as number}</span>
                </div>
              ))
            ) : (
              <p className="font-mono text-xs text-gray-500 italic bg-gray-50 p-4 border border-dashed border-gray-300">
                No dietary requests submitted.
              </p>
            )}
          </div>
        </div>

        {/* Accessibility Accommodations section */}
        <div className="space-y-3">
          <h4 className="font-mono text-xs font-black uppercase text-gray-400 flex items-center gap-1.5">
            <Accessibility className="w-4 h-4 text-indigo-500" />
            Accessibility & Sensory
          </h4>
          <div className="space-y-2">
            {Object.keys(accessibility).length > 0 ? (
              Object.entries(accessibility).map(([type, count]) => (
                <div key={type} className="border border-black p-3 bg-gray-50 flex justify-between items-center font-mono text-xs">
                  <span className="font-bold text-gray-800">{type}</span>
                  <span className="bg-black text-white px-2 py-0.5 font-bold">{count as number}</span>
                </div>
              ))
            ) : (
              <p className="font-mono text-xs text-gray-500 italic bg-gray-50 p-4 border border-dashed border-gray-300">
                No access accommodations requested.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
