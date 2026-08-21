# GitHub Issue & PR Audit Ledger

## Feature: Interactive Event Budget vs Actual Sankey Diagram
- **Issue Number**: #3947
- **Feature Title**: `feat(data-viz): build interactive event budget vs actual sankey diagram`
- **Domain**: Financial Transparency & Data Visualization
- **Status**: Implemented & Deployed
- **Components & Services**:
  - `src/components/budget/EventBudgetSankeyDiagram.tsx`
  - `src/services/budgetSankeyService.ts`
  - `src/routes/clubs.$slug.budget-sankey.tsx`
  - `src/types/budgetSankey.ts`
  - `supabase/migrations/20261231000022_event_budget_sankey.sql`
- **Summary**:
  Interactive 3-tier Sankey diagram visualizer mapping funding sources (grants, ticket sales, sponsorships) to expenditure categories (catering, venue, marketing) and downstream vendors with real-time variance calculations, inspector drawers, and CSV ledger exports.
