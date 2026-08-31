/**
 * University Campus Transit Shuttle Fleet Command Center Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateShuttleRouteDispatch,
  calculateShuttleFleetOccupancy,
  generateShuttleMaintenanceAlertReport,
  CAMPUS_SHUTTLE_ROUTES,
} from '../services/campusTransitService';

export default function CampusTransitDashboard() {
  const [shuttle, setShuttle] = useState({
    shuttleId: 'EV-BUS-902',
    driverName: 'Officer Daniel Jackson',
    routeId: 'R-BLUE-EXPRESS',
    routeName: CAMPUS_SHUTTLE_ROUTES.BLUE_LINE_EXPRESS,
    maxPassengerCapacity: 35,
    currentPassengerCount: 28,
    currentLatitude: 37.7752,
    currentLongitude: -122.4180,
    batteryPercent: 92,
    lastMaintenanceISO: new Date().toISOString(),
  });

  const dispatch = evaluateShuttleRouteDispatch(shuttle, 2.4);
  const occupancy = calculateShuttleFleetOccupancy(shuttle.maxPassengerCapacity, shuttle.currentPassengerCount);
  const maintenance = generateShuttleMaintenanceAlertReport(shuttle.shuttleId, 8400, shuttle.batteryPercent);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#2563EB', margin: 0 }}>🚌 Campus Transit Shuttle Fleet Command Center</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Live GPS vehicle tracking, route ETAs, electric bus battery telemetry, and passenger occupancy status.
        </p>
      </header>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Next Stop ETA</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>{dispatch.estimatedEtaMinutes} Minutes</h2>
          <small style={{ color: dispatch.isDispatchActive ? '#16A34A' : '#DC2626' }}>
            Status: {dispatch.routeStatus}
          </small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Passenger Occupancy</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>{occupancy.occupancyRatePercent}% Rate</h2>
          <small style={{ color: '#64748B' }}>Seats Open: {occupancy.availableSeatsCount} / {shuttle.maxPassengerCapacity}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #059669' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>EV Battery Charge</span>
          <h2 style={{ color: '#059669', margin: '4px 0 0 0' }}>{shuttle.batteryPercent}% Charged</h2>
          <small style={{ color: '#64748B' }}>Zero-Emission Electric Bus</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Fleet Maintenance Alert</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>{maintenance.maintenanceAlertLevel}</h2>
          <small style={{ color: '#64748B' }}>Odometer: {maintenance.odometerMiles} Miles</small>
        </div>
      </div>

      {/* Live Route Status Box */}
      <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>📍 Active Vehicle Route Telemetry</h3>

        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>Vehicle ID:</strong> {shuttle.shuttleId} | <strong>Driver:</strong> {shuttle.driverName}
        </p>
        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>Route:</strong> {shuttle.routeName}
        </p>
        <p style={{ margin: '4px 0', color: '#334155' }}>
          <strong>GPS Coordinates:</strong> {shuttle.currentLatitude.toFixed(4)} N, {shuttle.currentLongitude.toFixed(4)} W
        </p>
      </div>
    </div>
  );
}
