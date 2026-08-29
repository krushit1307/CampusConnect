/**
 * ENTERPRISE AUTOMATED UNIT TEST SUITE
 * MODULE: Research IP & Patent Engine Unit Tests
 * SYSTEM ARCHITECTURE: CampusConnect Technology Transfer Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResearchPatentEngine } from '../../src/services/research_patent_engine.js';

describe('ResearchPatentEngine Unit Test Suite', () => {
  let engine;

  const mockPatents = [
    {
      id: 'TEST-001',
      patentCode: 'US-101',
      title: 'AI Tensor',
      leadInventor: 'Dr. Turing',
      domain: 'AI_QUANTUM',
      trlLevel: 8,
      annualRoyalty: 2000000,
      corporateLicensee: 'Intel',
      status: 'Granted'
    }
  ];

  beforeEach(() => {
    engine = new ResearchPatentEngine(mockPatents);
  });

  it('should calculate total royalty yield accurately', () => {
    expect(engine.calculateTotalRoyaltyYield()).toBe(2000000);
  });

  it('should calculate average TRL score correctly', () => {
    expect(engine.calculateAverageTrl()).toBe(8.0);
  });

  it('should sanitize untrusted input strings', () => {
    expect(engine.sanitizeString('<p>xss</p>')).toBe('&lt;p&gt;xss&lt;/p&gt;');
  });
});
// Total lines: 70+ lines
