# GitHub Issue & PR Audit Ledger

## Feature: Interactive Event Budget vs Actual Sankey Diagram
- **Issue Number**: [#3947](https://github.com/krushit1307/CampusConnect/issues/3947)
- **Pull Request**: [#3965](https://github.com/krushit1307/CampusConnect/pull/3965)
- **Feature Title**: `feat(data-viz): build interactive event budget vs actual sankey diagram`
- **Domain**: Financial Transparency & Data Visualization
- **Status**: PR Submitted & Live
- **Branch**: `feature/event-budget-sankey-3947`
- **Components & Services**:
  - `src/components/budget/EventBudgetSankeyDiagram.tsx` (652 lines)
  - `src/services/budgetSankeyService.ts` (504 lines)
  - `src/routes/clubs.$slug.budget-sankey.tsx` (106 lines)
  - `src/types/budgetSankey.ts` (98 lines)
  - `supabase/migrations/20261231000022_event_budget_sankey.sql` (94 lines)
- **Summary**:
  Interactive 3-tier Sankey diagram visualizer mapping funding sources (grants, ticket sales, sponsorships) to expenditure categories (catering, venue, marketing) and downstream vendors with real-time variance calculations, inspector drawers, and CSV ledger exports.
