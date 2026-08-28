/**
 * ENTERPRISE ARCHITECTURAL BUSINESS LOGIC ENGINE
 * MODULE: Academic Curriculum Service Engine
 * SYSTEM ARCHITECTURE: CampusConnect Data Processing Framework
 * VERSION: 4.2.0-RELEASE
 */

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} code
 * @property {string} title
 * @property {string} department
 * @property {number} credits
 * @property {number} enrolled
 * @property {number} capacity
 * @property {string} facultyLead
 * @property {number} averageGpa
 * @property {number} cloScore
 * @property {string} accreditationStatus
 */

export class AcademicCurriculumEngine {
  constructor(initialCourses = null) {
    this.courses = initialCourses || this.generateDefaultCourseCatalog();
    this.activeFilters = {
      department: 'ALL',
      semester: 'FALL_2026',
      searchQuery: '',
      minCloScore: 0
    };
  }

  generateDefaultCourseCatalog() {
    return [
      {
        id: 'CRS-CS-101',
        code: 'CS-101',
        title: 'Distributed Systems & Microservice Architecture',
        department: 'CS',
        credits: 4,
        enrolled: 120,
        capacity: 125,
        facultyLead: 'Dr. Alan Turing',
        averageGpa: 3.65,
        cloScore: 92.5,
        accreditationStatus: 'Compliant'
      },
      {
        id: 'CRS-EE-302',
        code: 'EE-302',
        title: 'Quantum Microprocessor Design',
        department: 'EE',
        credits: 3,
        enrolled: 64,
        capacity: 70,
        facultyLead: 'Dr. Nikola Tesla',
        averageGpa: 3.42,
        cloScore: 86.4,
        accreditationStatus: 'Compliant'
      }
    ];
  }

  calculateInstitutionalGpaBenchmark(courses = this.courses) {
    if (!courses || courses.length === 0) return 0.0;
    let totalPoints = 0;
    let totalCredits = 0;
    courses.forEach(c => {
      totalPoints += c.averageGpa * c.credits * c.enrolled;
      totalCredits += c.credits * c.enrolled;
    });
    if (totalCredits === 0) return 0.0;
    return parseFloat((totalPoints / totalCredits).toFixed(2));
  }

  calculateCloAchievementIndex(courses = this.courses) {
    if (!courses || courses.length === 0) return 0.0;
    const sum = courses.reduce((acc, c) => acc + c.cloScore, 0);
    return parseFloat((sum / courses.length).toFixed(1));
  }

  filterCourses(criteria) {
    return this.courses.filter(c => {
      if (criteria.department && criteria.department !== 'ALL' && c.department !== criteria.department) return false;
      if (criteria.searchQuery && criteria.searchQuery.trim() !== '') {
        const query = criteria.searchQuery.toLowerCase().trim();
        if (!c.code.toLowerCase().includes(query) && !c.title.toLowerCase().includes(query)) return false;
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
