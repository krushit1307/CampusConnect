import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EventInsuranceHedgingDashboard } from './EventInsuranceHedgingDashboard';
import { EventInsuranceHedgingService } from '../../services/eventInsuranceHedgingService';

describe('EventInsuranceHedgingService & Dashboard (#5144)', () => {
  let service: EventInsuranceHedgingService;

  beforeEach(() => {
    service = EventInsuranceHedgingService.getInstance();
  });

  it('underwrites policy and allocates 90% capital to prediction market YES shares', async () => {
    const res = await service.underwritePolicy({
      clubId: 'club-test',
      eventName: 'Hurricane Rainout Gala',
      city: 'Miami',
      eventDate: '2026-11-01',
      premiumPaid: 100,
      coverageAmount: 5000,
    });

    expect(res.policy.premiumPaid).toBe(100);
    expect(res.policy.coverageAmount).toBe(5000);
    expect(res.position.capitalAllocated).toBe(90);
    expect(res.position.potentialPayout).toBe(5000);
  });

  it('prevents pool bankruptcy during 50 simultaneous event cancellation claims via prediction market hedging', async () => {
    const sim = await service.simulateMassCatastrophe(50);
    expect(sim.totalDemand).toBe(250000);
    expect(sim.predictionMarketInflow).toBe(250000);
    expect(sim.bankruptcyAvoided).toBe(true);
    expect(sim.finalLiquidity).toBeGreaterThanOrEqual(0);
  });

  it('renders dashboard UI and allows catastrophe hedge simulation', async () => {
    render(<EventInsuranceHedgingDashboard />);

    expect(screen.getByText(/Decentralized Insurance Pool & Prediction Market Hedging/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Catastrophe Hedge Test/i)).toBeInTheDocument();

    const simButton = screen.getByRole('button', { name: /Run Catastrophe Hedge Test/i });
    fireEvent.click(simButton);

    await waitFor(() => {
      expect(screen.getByText(/Solvency Preserved! External Polymarket liquidity prevented pool bankruptcy./i)).toBeInTheDocument();
    });
  });
});
