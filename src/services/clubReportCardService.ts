import { supabase } from "@/lib/supabase";

export interface ClubReportCard {
  id: string;
  club_id: string;
  academic_year: number;
  total_events: number;
  avg_attendance: number;
  total_revenue_cents: number;
  total_budget_spent_cents: number;
  member_churn_rate: number;
  computed_grade: "A" | "B" | "C" | "D" | "F";
  rubric_breakdown: {
    attendanceScore: number;
    eventsScore: number;
    budgetUtilizationScore: number;
    churnPenalty: number;
    totalScore: number;
    grade: "A" | "B" | "C" | "D" | "F";
  };
  pdf_storage_path: string;
  created_at: string;
}

export const clubReportCardService = {
  async generateReportCard(clubId: string, year?: number) {
    const { data, error } = await supabase.functions.invoke("generate-club-report-card", {
      body: { club_id: clubId, year },
    });
    if (error) throw error;
    return data;
  },

  async getClubReportCards(clubId: string) {
    const { data, error } = await supabase
      .from("club_report_cards")
      .select("*")
      .eq("club_id", clubId)
      .order("academic_year", { ascending: false });
    if (error) throw error;
    return data as ClubReportCard[];
  },

  downloadMockPdf(report: ClubReportCard, clubName: string) {
    // Generates a formal printable report payload for Student Union audit compliance
    const content = `
=====================================================
          STUDENT UNION ANNUAL AUDIT REPORT CARD
=====================================================
Club Name: ${clubName}
Academic Year: ${report.academic_year}
Computed Grade: ${report.computed_grade} (Score: ${report.rubric_breakdown.totalScore}/100)

---------------- PERFORMANCE SUMMARY ----------------
* Total Events Hosted: ${report.total_events}
* Average Attendance Per Event: ${report.avg_attendance} attendees
* Total Revenue Generated: $${(report.total_revenue_cents / 100).toFixed(2)}
* Total Budget Expended: $${(report.total_budget_spent_cents / 100).toFixed(2)}
* Member Churn Rate: ${report.member_churn_rate}%

------------------ RUBRIC BREAKDOWN -----------------
- Attendance Metric Score: ${report.rubric_breakdown.attendanceScore} / 35
- Event Frequency Score: ${report.rubric_breakdown.eventsScore} / 25
- Budget Execution Score: ${report.rubric_breakdown.budgetUtilizationScore} / 25
- Member Retention Adjustment: ${report.rubric_breakdown.churnPenalty} / 15

AUDIT STATUS: APPROVED & CERTIFIED
Generated on: ${new Date().toLocaleDateString()}
=====================================================
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${clubName.replace(/\s+/g, "_")}_Annual_Report_${report.academic_year}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
