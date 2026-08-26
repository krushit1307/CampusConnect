import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  EventRoiSankeyDashboard,
  MOCK_EVENT_TRANSACTIONS,
} from "./EventRoiSankeyDashboard";
import { EventFinancialTransaction } from "@/lib/eventRoiVisualization";

describe("EventRoiSankeyDashboard Component (#4280)", () => {
  const lossTransactions: EventFinancialTransaction[] = [
    { id: "tx-1", eventId: "evt-loss", type: "revenue", category: "Ticket Sales", amount: 500 },
    { id: "tx-2", eventId: "evt-loss", type: "expense", category: "Catering", amount: 1500 },
    { id: "tx-3", eventId: "evt-loss", type: "expense", category: "Venue Hire", amount: 800 },
  ];

  it("renders Event ROI Dashboard header, metric cards, and capital flow diagram", () => {
    render(
      <EventRoiSankeyDashboard
        eventTitle="Annual Tech Gala"
        initialTransactions={MOCK_EVENT_TRANSACTIONS}
      />
    );

    expect(screen.getByText(/Interactive "Event ROI" Visualization Dashboard — Annual Tech Gala/i)).toBeInTheDocument();
    expect(screen.getByText("Total Revenue Inflows")).toBeInTheDocument();
    expect(screen.getByText("Total Expense Outflows")).toBeInTheDocument();
    expect(screen.getByText("Financial ROI Rate")).toBeInTheDocument();
    expect(screen.getByText("Capital Flow Diagram (Revenue → Pool → Expenses & Net Outcome)")).toBeInTheDocument();
  });

  it("displays Net Profit and positive ROI when revenue exceeds expenses", () => {
    render(
      <EventRoiSankeyDashboard
        eventTitle="Annual Tech Gala"
        initialTransactions={MOCK_EVENT_TRANSACTIONS}
      />
    );

    expect(screen.getByText("Net Profit")).toBeInTheDocument();
    expect(screen.getByTestId("net-outcome-amount")).toHaveTextContent("$1,000.00");
  });

  it("displays Net Loss badge and highlights net outcome node in bold red when in deficit", () => {
    render(
      <EventRoiSankeyDashboard
        eventTitle="Stargazing Event"
        initialTransactions={lossTransactions}
      />
    );

    expect(screen.getByText("Net Loss")).toBeInTheDocument();
    expect(screen.getByTestId("net-outcome-amount")).toHaveTextContent("-$1,800.00");

    const netNode = screen.getByTestId("net-outcome-node");
    expect(netNode).toBeInTheDocument();
    expect(netNode).toHaveClass("border-red-600");
  });

  it("filters transaction breakdown by Inflows and Outflows", () => {
    render(
      <EventRoiSankeyDashboard
        eventTitle="Annual Tech Gala"
        initialTransactions={MOCK_EVENT_TRANSACTIONS}
      />
    );

    const inflowsBtn = screen.getByRole("button", { name: "Inflows" });
    fireEvent.click(inflowsBtn);

    // When filtering by Inflows, Catering & Refreshments disappears from the transaction breakdown list
    const cateringElements = screen.getAllByText("Catering & Refreshments");
    // Only 1 instance remains (in the Sankey node column), whereas in 'all' view there were 2 (node + ledger item)
    expect(cateringElements.length).toBe(1);
  });
});
