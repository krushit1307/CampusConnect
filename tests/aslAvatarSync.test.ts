import { describe, it, expect } from 'vitest';
import {
  translateTextToAslGloss,
  generateAslAnimationKeyframes,
  processVttToAslTranslation,
  getActiveAslKeyframeAtTime,
} from '../src/services/aslTranslationEngine';
import { VttCaptionSegment } from '../src/types/aslAvatar';

describe('Real-Time Closed Captioning ASL Avatar Sync Engine (#5135)', () => {
  const sampleVttSegment: VttCaptionSegment = {
    id: 'seg-1',
    startTimeSeconds: 10.0,
    endTimeSeconds: 15.0,
    text: 'Welcome to CampusConnect student pizza party today!',
    speakerLabel: 'Speaker 1',
  };

  it('should correctly translate English sentence into ASL Gloss sequence', () => {
    const gloss = translateTextToAslGloss('Welcome to CampusConnect student pizza party today');
    expect(gloss).toContain('WELCOME');
    expect(gloss).toContain('CAMPUS');
    expect(gloss).toContain('STUDENT');
    expect(gloss).toContain('PIZZA');
  });

  it('should generate skeletal animation keyframes for ASL gloss', () => {
    const keyframes = generateAslAnimationKeyframes('WELCOME', 10.0, 2.5);
    expect(keyframes.length).toBe(15);
    expect(keyframes[0].handShapeLeft).toBe('open_palm');
    expect(keyframes[0].leftArmRotations.length).toBeGreaterThan(0);
  });

  it('should process full VTT caption segment into time-synced ASL translation output', () => {
    const output = processVttToAslTranslation(sampleVttSegment);
    expect(output.vttSegmentId).toBe('seg-1');
    expect(output.startTimeSeconds).toBe(10.0);
    expect(output.endTimeSeconds).toBe(15.0);
    expect(output.glossTokens.length).toBeGreaterThan(0);
  });

  it('should retrieve accurate keyframe corresponding to video currentTime', () => {
    const output = processVttToAslTranslation(sampleVttSegment);
    const result = getActiveAslKeyframeAtTime([output], 12.0); // 12 seconds in

    expect(result.activeSegment).toBeDefined();
    expect(result.activeSegment?.vttSegmentId).toBe('seg-1');
  });
});
