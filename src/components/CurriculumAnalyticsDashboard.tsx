/**
 * Enterprise Academic Curriculum Analytics Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateCurriculumCreditDistribution,
  calculateStudentGraduationProgress,
  generateAcademicDepartmentRemediationPlan,
  DEGREE_PROGRAM_TYPES,
} from '../services/curriculumAnalyticsService';

export default function CurriculumAnalyticsDashboard() {
  const [departmentData, setDepartmentData] = useState({
    departmentId: 'DEPT-ENG-401',
    departmentName: 'Department of Electrical & Computer Engineering',
    programType: DEGREE_PROGRAM_TYPES.BACHELOR_OF_SCIENCE,
    totalRequiredCredits: 128,
    coreCourseCreditsCompleted: 64,
    electiveCreditsCompleted: 32,
    labCreditsCompleted: 20,
    enrolledStudentsCount: 620,
    atRiskStudentsCount: 52,
    evaluatedAt: new Date().toISOString(),
  });

  const evaluation = evaluateCurriculumCreditDistribution(departmentData);
  const totalCompleted = departmentData.coreCourseCreditsCompleted + departmentData.electiveCreditsCompleted + departmentData.labCreditsCompleted;
  const progress = calculateStudentGraduationProgress(departmentData.totalRequiredCredits, totalCompleted);
  const remediation = generateAcademicDepartmentRemediationPlan(departmentData);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#4F46E5', margin: 0 }}>🎓 Enterprise Academic Curriculum & Credit Command Center</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Degree program credit completion telemetry, ABET/NAAC accreditation compliance audit, and faculty advising logistics.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #4F46E5' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Credit Completion Rate</span>
          <h2 style={{ color: '#4F46E5', margin: '4px 0 0 0' }}>{evaluation.creditCompletionRatioPercent}%</h2>
          <small style={{ color: evaluation.isAccreditationCompliant ? '#16A34A' : '#DC2626' }}>
            Status: {evaluation.complianceStatus}
          </small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Remaining Graduation Load</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>{progress.creditsRemaining} Credits</h2>
          <small style={{ color: '#64748B' }}>Est. Semesters: {progress.estimatedSemestersToGraduation}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>At-Risk Student Ratio</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>{remediation.atRiskStudentRatioPercent}%</h2>
          <small style={{ color: '#64748B' }}>{departmentData.atRiskStudentsCount} / {departmentData.enrolledStudentsCount} Students</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Faculty Advisors Needed</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>{remediation.recommendedFacultyAdvisorsToAssign} Advisors</h2>
          <small style={{ color: '#64748B' }}>Core/Elective Ratio: {evaluation.coreToElectiveRatio}</small>
        </div>
      </div>

      {/* Remediation Action Directives */}
      <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>📜 Departmental Remediation & Advising Directives</h3>

        <ol>
          {remediation.remediationDirectives.map((dir, idx) => (
            <li key={idx} style={{ marginBottom: '8px', color: '#334155' }}>{dir}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
