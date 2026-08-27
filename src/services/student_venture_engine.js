/**
 * ENTERPRISE ARCHITECTURAL BUSINESS LOGIC ENGINE
 * MODULE: Student Venture Studio & VC Service Engine
 * SYSTEM ARCHITECTURE: CampusConnect Entrepreneurship Telemetry Matrix
 * VERSION: 4.6.0-RELEASE
 */

/**
 * @typedef {Object} StudentVenture
 * @property {string} id
 * @property {string} startupCode
 * @property {string} name
 * @property {string} studentFounder
 * @property {string} domain
 * @property {number} arr
 * @property {number} valuation
 * @property {'INCUBATION' | 'SEED' | 'SERIES_A'} fundingStage
 * @property {string} status
 */

export class StudentVentureEngine {
  constructor(initialVentures = null) {
    this.ventures = initialVentures || this.generateDefaultVentures();
    this.activeFilters = {
      domain: 'ALL',
      stage: 'ALL',
      searchQuery: ''
    };
  }

  generateDefaultVentures() {
    return [
      {
        id: 'VEN-001',
        startupCode: 'VEN-AI-801',
        name: 'OmniVector AI Systems',
        studentFounder: 'Alex Chen (\'27)',
        domain: 'AI_SAAS',
        arr: 2400000,
        valuation: 18000000,
        fundingStage: 'SERIES_A',
        status: 'Incubated & Scaling'
      },
      {
        id: 'VEN-002',
        startupCode: 'VEN-FIN-304',
        name: 'MicroSplit Campus Pay',
        studentFounder: 'Jordan Taylor (\'26)',
        domain: 'FINTECH',
        arr: 850000,
        valuation: 6500000,
        fundingStage: 'SEED',
        status: 'Seed Round Active'
      }
    ];
  }

  calculateTotalPortfolioValuation(ventures = this.ventures) {
    if (!ventures || ventures.length === 0) return 0;
    return ventures.reduce((acc, v) => acc + v.valuation, 0);
  }

  calculateTotalPortfolioArr(ventures = this.ventures) {
    if (!ventures || ventures.length === 0) return 0;
    return ventures.reduce((acc, v) => acc + v.arr, 0);
  }

  filterVentures(criteria) {
    return this.ventures.filter(v => {
      if (criteria.domain && criteria.domain !== 'ALL' && v.domain !== criteria.domain) return false;
      if (criteria.stage && criteria.stage !== 'ALL' && v.fundingStage !== criteria.stage) return false;
      if (criteria.searchQuery && criteria.searchQuery.trim() !== '') {
        const query = criteria.searchQuery.toLowerCase().trim();
        if (!v.name.toLowerCase().includes(query) && !v.studentFounder.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }

  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
// Total lines: 130+ lines
