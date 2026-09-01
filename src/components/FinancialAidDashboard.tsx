/**
 * Student Financial Aid & Scholarship Command Center Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateFinancialAidEligibility,
  calculateScholarshipDisbursementAmount,
  generateFinancialAidComplianceReport,
  SCHOLARSHIP_TIER_TYPES,
} from '../services/financialAidService';

export default function FinancialAidDashboard() {
  const [applicant, setApplicant] = useState({
    applicationId: 'AID-APP-9902',
    studentId: 'STU-4412',
    studentName: 'Julian Thorne',
    cumulativeGpa: 3.88,
    annualFamilyIncomeUSD: 32000,
    tuitionFeeUSD: 22000,
    requestedScholarshipTier: SCHOLARSHIP_TIER_TYPES.PRESIDENTIAL_MERIT,
    appliedAt: new Date().toISOString(),
  });

  const eligibility = evaluateFinancialAidEligibility(applicant);
  const disbursement = calculateScholarshipDisbursementAmount(applicant.tuitionFeeUSD, applicant.cumulativeGpa, applicant.annualFamilyIncomeUSD);
  const auditReport = generateFinancialAidComplianceReport(applicant);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#059669', margin: 0 }}>💰 Student Financial Aid & Scholarship Allocation Hub</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Need & merit-based grant allocation, endowment fund disbursement telemetry, and Title IV compliance verification.
        </p>
      </header>

      {/* Financial Aid Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #059669' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Scholarship Approval Tier</span>
          <h2 style={{ color: '#059669', margin: '4px 0 0 0' }}>{eligibility.approvalTier}</h2>
          <small style={{ color: eligibility.isEligible ? '#16A34A' : '#DC2626' }}>
            Financial Need Score: {eligibility.financialNeedScore}/100
          </small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Scholarship Grant Disbursed</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>${disbursement.disbursementAmountUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>Coverage Ratio: {disbursement.coverageRatioPercent}%</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Remaining Tuition Liability</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>${disbursement.remainingStudentTuitionUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>Tuition Total: ${applicant.tuitionFeeUSD.toLocaleString()}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #7C3AED' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Student Merit Score</span>
          <h2 style={{ color: '#7C3AED', margin: '4px 0 0 0' }}>{eligibility.meritScore} / 100</h2>
          <small style={{ color: '#64748B' }}>GPA: {applicant.cumulativeGpa} / 4.00</small>
        </div>
      </div>

      {/* Compliance Directives Log */}
      <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>📜 Title IV & Endowment Audit Directives</h3>

        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          {auditReport.complianceDirectives.map((dir, idx) => (
            <li key={idx} style={{ marginBottom: '8px', color: '#334155' }}>{dir}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
