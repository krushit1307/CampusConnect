import { describe, it, expect } from "vitest";
import { calculateDonationThermometerState, DonationGoalTier } from "./donationStretchMilestones";

describe("Build Real-Time Donation Goal Stretch Milestone Suite (#4480)", () => {
  const sampleGoals: DonationGoalTier[] = [
    {
      id: "g1",
      eventId: "evt_robotics_fund",
      tierOrder: 1,
      targetAmount: 5000,
      title: "Base Equipment",
      isUnlocked: false,
    },
    {
      id: "g2",
      eventId: "evt_robotics_fund",
      tierOrder: 2,
      targetAmount: 7000,
      title: "Upgrade Motors & Sensors",
      isUnlocked: false,
    },
  ];

  it("calculates accurate fill percentage for primary goal before target is hit", () => {
    const result = calculateDonationThermometerState(2500, sampleGoals);

    expect(result.fillPercentage).toBe(50);
    expect(result.activeTargetGoal).toBe(5000);
    expect(result.triggerCelebrationAnimation).toBe(false);
    expect(result.statusMessage).toContain("Goal: $5,000 - Base Equipment");
  });

  it("triggers celebration animation and re-scales Y-axis to reveal stretch goal when primary target is hit", () => {
    const result = calculateDonationThermometerState(5000, sampleGoals);

    expect(result.triggerCelebrationAnimation).toBe(true);
    expect(result.activeTargetGoal).toBe(7000);
    expect(result.statusMessage).toContain(
      "GOAL MET! Help us hit our Stretch Goal ($7,000) to Upgrade Motors & Sensors!",
    );
  });

  it("re-calculates fill percentage against $7k stretch goal when donations exceed initial $5k target", () => {
    const result = calculateDonationThermometerState(5250, sampleGoals);

    expect(result.activeTargetGoal).toBe(7000);
    expect(result.yAxisMaxScale).toBe(7000);
    expect(result.fillPercentage).toBe(75); // $5250 / $7000 = 75%
  });
});
