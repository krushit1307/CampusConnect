/**
 * University Campus Recreation Center & Fitness Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateGymEquipmentReservation,
  calculateFitnessCenterOccupancy,
  generateWellnessClassBookingReport,
  FITNESS_CLASS_TYPES,
} from '../services/campusRecreationService';

export default function CampusRecreationDashboard() {
  const [reservation, setReservation] = useState({
    reservationId: 'RES-SQUAT-102',
    studentId: 'STU-9941',
    studentName: 'Bruce Wayne',
    equipmentType: 'Olympic Deadlift Platform',
    requestedDurationMinutes: 60,
    startTimeISO: new Date().toISOString(),
  });

  const confirm = evaluateGymEquipmentReservation(reservation);
  const occupancy = calculateFitnessCenterOccupancy(300, 220);
  const wellnessReport = generateWellnessClassBookingReport('C-SPIN-04', FITNESS_CLASS_TYPES.SPIN_CYCLES_EXPRESS, 'Instructor Barry Allen', 30, 28);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#16A34A', margin: 0 }}>🏋️ Campus Recreation & Fitness Wellness Hub</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Gym equipment time slot booking, fitness center live occupancy rates, group wellness classes, and intramural league schedules.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Equipment Time Slot</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>{confirm.reservationStatus}</h2>
          <small style={{ color: '#64748B' }}>Locker Assigned: #{confirm.assignedLockerNumber}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Gym Live Occupancy</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>{occupancy.occupancyRatePercent}% Rate</h2>
          <small style={{ color: '#64748B' }}>{occupancy.currentCount} / {occupancy.totalCapacity} Athletes</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Wellness Class Booking</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>{wellnessReport.bookedAttendeesCount} / {wellnessReport.maxAttendeesCount} Seats</h2>
          <small style={{ color: '#64748B' }}>Class: {wellnessReport.className}</small>
        </div>
      </div>

      {/* Wellness Class Roster */}
      <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>🧘 Active Group Wellness Class Roster</h3>

        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>Instructor:</strong> {wellnessReport.instructorName} | <strong>Status:</strong> {wellnessReport.isClassFull ? 'CLASS_FULL' : 'SEATS_AVAILABLE'}
        </p>
        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>Waitlist Count:</strong> {wellnessReport.waitlistCount} Candidates
        </p>
      </div>
    </div>
  );
}
