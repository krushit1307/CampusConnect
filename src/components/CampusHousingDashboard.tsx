/**
 * University Campus Housing & Dormitory Command Center Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateHousingRoomAllocation,
  calculateDormitoryOccupancyRate,
  generateHousingMaintenanceWorkOrderReport,
  DORMITORY_BUILDING_TYPES,
} from '../services/campusHousingService';

export default function CampusHousingDashboard() {
  const [request, setRequest] = useState({
    requestId: 'REQ-HOUSING-771',
    studentId: 'STU-1104',
    studentName: 'Julian Vance',
    academicYear: 'Sophomore Year',
    preferredBuildingType: DORMITORY_BUILDING_TYPES.UPPERCLASSMAN_SUITES,
    requiresAdaAccessibility: false,
    requestedRoommateId: 'STU-1105',
    submittedAt: new Date().toISOString(),
  });

  const allocation = evaluateHousingRoomAllocation(request);
  const occupancy = calculateDormitoryOccupancyRate(500, 465);
  const workOrder = generateHousingMaintenanceWorkOrderReport('SUITE-304-A', 'Plumbing leak in bathroom shower fixture.', 'HIGH_PRIORITY');

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#9333EA', margin: 0 }}>🏠 Campus Housing & Dormitory Allocation Hub</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Dormitory room assignment telemetry, building occupancy rates, roommate matching, and maintenance work orders.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #9333EA' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Assigned Room</span>
          <h2 style={{ color: '#9333EA', margin: '4px 0 0 0' }}>Room {allocation.assignedRoomNumber}-{allocation.bedLetter}</h2>
          <small style={{ color: '#64748B' }}>{allocation.assignedBuildingName}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Dormitory Occupancy</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>{occupancy.occupancyRatePercent}%</h2>
          <small style={{ color: '#64748B' }}>{occupancy.occupiedBedsCount} / {occupancy.totalBedCapacity} Occupied Beds</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Available Housing Beds</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>{occupancy.availableBedsCount} Beds</h2>
          <small style={{ color: '#64748B' }}>Ready for Move-In</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Open Maintenance Dispatch</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>{workOrder.workOrderId.slice(0, 12)}</h2>
          <small style={{ color: '#64748B' }}>Est. Resolution: {workOrder.estimatedResolutionHours} hrs</small>
        </div>
      </div>

      {/* Maintenance Report Details */}
      <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>🔧 Active Facilities Maintenance Dispatch Work Order</h3>

        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>Location:</strong> {workOrder.roomIdentifier} | <strong>Priority:</strong> {workOrder.priorityLevel}
        </p>
        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>Issue:</strong> {workOrder.issueDescription}
        </p>
        <p style={{ margin: '4px 0', color: '#16A34A', fontWeight: 600 }}>
          <strong>Status:</strong> {workOrder.dispatchStatus}
        </p>
      </div>
    </div>
  );
}
