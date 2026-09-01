import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DynamicDutchAuctionDashboard } from './DynamicDutchAuctionDashboard';
import { DutchAuctionRlYieldAgent, AuctionState } from '../../services/dutchAuctionRlYieldAgent';

describe('DutchAuctionRlYieldAgent & Dynamic Dutch Auction Dashboard (#5145)', () => {
  let agent: DutchAuctionRlYieldAgent;

  beforeEach(() => {
    agent = DutchAuctionRlYieldAgent.getInstance();
  });

  it('pauses auction clock when purchase velocity spikes above threshold', () => {
    const state: AuctionState = {
      auctionId: 'auc-1',
      eventName: 'DJ Gala',
      initialPrice: 100,
      currentPrice: 75,
      floorPrice: 30,
      remainingTickets: 100,
      totalTickets: 200,
      purchaseVelocityPerSec: 6.0, // High velocity
      timeElapsedSec: 300,
      totalDurationSec: 1800,
      isClockPaused: false,
      hybridModeActive: false,
    };

    const dec = agent.evaluateState(state);
    expect(dec.action).toBe('PAUSE_CLOCK');
    expect(dec.isClockPaused).toBe(true);
    expect(dec.adjustedPrice).toBe(75);
  });

  it('triggers hybrid micro-boost when explosive purchase velocity (>=15 t/s) is detected', () => {
    const state: AuctionState = {
      auctionId: 'auc-2',
      eventName: 'DJ Headline Concert',
      initialPrice: 100,
      currentPrice: 50,
      floorPrice: 20,
      remainingTickets: 80,
      totalTickets: 200,
      purchaseVelocityPerSec: 20.0, // Explosive burst
      timeElapsedSec: 400,
      totalDurationSec: 1800,
      isClockPaused: false,
      hybridModeActive: false,
    };

    const dec = agent.evaluateState(state);
    expect(dec.action).toBe('MICRO_BOOST_PRICE');
    expect(dec.isClockPaused).toBe(true);
    expect(dec.adjustedPrice).toBeGreaterThan(50);
  });

  it('simulates auction comparison and demonstrates positive revenue lift over linear Dutch auction', () => {
    const res = agent.simulateAuctionComparison({
      ticketCount: 200,
      initialPrice: 100,
      floorPrice: 30,
      durationSec: 1800,
      velocitySpikesAtSec: [300, 600, 900],
    });

    expect(res.rlRevenue).toBeGreaterThan(res.linearRevenue);
    expect(res.revenueLift).toBeGreaterThan(0);
    expect(res.liftPercentage).toBeGreaterThan(0);
  });

  it('renders auction dashboard UI and triggers burst simulation', async () => {
    render(<DynamicDutchAuctionDashboard />);

    expect(screen.getByText(/Real-Time Dynamic Pricing Dutch Auction/i)).toBeInTheDocument();
    expect(screen.getByText(/Explosive Demand Burst/i)).toBeInTheDocument();

    const burstBtn = screen.getByRole('button', { name: /Explosive Demand Burst/i });
    fireEvent.click(burstBtn);

    await waitFor(() => {
      expect(screen.getByText(/MICRO_BOOST_PRICE/i)).toBeInTheDocument();
    });
  });
});
