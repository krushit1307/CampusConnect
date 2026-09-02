import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DeepfakePhishingDebriefPortal } from './DeepfakePhishingDebriefPortal';
import { DeepfakePhishingSimulationService } from '../../services/deepfakePhishingSimulationService';

describe('DeepfakePhishingSimulationService & Debrief Portal (#5146)', () => {
  let service: DeepfakePhishingSimulationService;

  beforeEach(() => {
    service = DeepfakePhishingSimulationService.getInstance();
  });

  it('generates personalized deepfake video script and launches simulation campaign', async () => {
    const campaign = await service.launchPhishingSimulation({
      targetClubId: 'club-chess',
      targetClubName: 'Chess Club',
      targetPresidentName: 'Sarah Jenkins',
      targetPhoneNumber: '+1 (555) 999-0000',
      authorityAvatarId: 'avatar-dean-smith',
      transferAmount: 5000,
      urgencyReason: 'venue deposit fee',
    });

    expect(campaign.syntheticScript).toContain('Sarah Jenkins');
    expect(campaign.syntheticScript).toContain('Chess Club');
    expect(campaign.syntheticScript).toContain('$5,000');
    expect(campaign.status).toBe('SMS_DISPATCHED');
    expect(campaign.generatedVideoUrl).toBeDefined();
  });

  it('records failed simulation when user initiates transfer and triggers mandatory debrief', async () => {
    const campaign = await service.launchPhishingSimulation({
      targetClubId: 'club-math',
      targetClubName: 'Math Club',
      targetPresidentName: 'John Doe',
      targetPhoneNumber: '+1 (555) 888-1111',
      authorityAvatarId: 'avatar-president-jones',
      transferAmount: 2500,
      urgencyReason: 'conference travel wire',
    });

    const res = await service.recordPhishingInteraction(campaign.campaignId, 'INITIATED_TRANSFER');
    expect(res.attemptedFakeTransfer).toBe(true);
    expect(res.riskScore).toBe(95);

    service.completeDebrief(campaign.campaignId);
    const updated = service.getCampaign(campaign.campaignId);
    expect(updated?.status).toBe('DEBRIEFED');
  });

  it('renders debrief portal UI and dispatches deepfake simulation campaign', async () => {
    render(<DeepfakePhishingDebriefPortal />);

    expect(screen.getByText(/Automated Deepfake Video Phishing Simulation & Debriefing/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthesize & Send Deepfake SMS/i)).toBeInTheDocument();

    const dispatchBtn = screen.getByRole('button', { name: /Synthesize & Send Deepfake SMS/i });
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Fall for Scam/i)).toBeInTheDocument();
    });

    const scamBtn = screen.getByRole('button', { name: /Fall for Scam/i });
    fireEvent.click(scamBtn);

    await waitFor(() => {
      expect(screen.getByText(/CRITICAL DEBRIEFING: Deepfake Social Engineering/i)).toBeInTheDocument();
    });
  });
});
