import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { EquipmentScheduleGrid } from '@/components/labs/EquipmentScheduleGrid';
import { HardwareTelemetryDashboard } from '@/components/labs/HardwareTelemetryDashboard';
import {
  LabEquipment,
  EquipmentReservation,
  UserSafetyCertification,
} from '@/types/labEquipment';
import { validateReservationEligibility } from '@/lib/labs/scheduler';
import {
  Cpu,
  FlaskConical,
  Activity,
  Calendar,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle,
} from 'lucide-react';

export default function LabsAndEquipmentPage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'telemetry'>('schedule');

  const [studentCertifications] = useState<UserSafetyCertification[]>([
    {
      id: 'cert-hpc-1',
      title: 'HPC & Distributed GPU Cluster Safety',
      passedAt: '2026-08-10',
      expiresAt: '2027-08-10',
      scorePercent: 100,
    },
    {
      id: 'cert-3d-1',
      title: '3D Printer & MakerSpace Thermal Safety',
      passedAt: '2026-08-15',
      expiresAt: '2027-08-15',
      scorePercent: 95,
    },
  ]);

  const [equipmentList, setEquipmentList] = useState<LabEquipment[]>([
    {
      id: 'eq-1',
      name: 'NVIDIA DGX H100 Node #1',
      category: 'hpc_gpu',
      labLocation: 'High Performance Computing Center (Room 204)',
      status: 'operational',
      hourlyLimitPerWeek: 12,
      requiredCertificationId: 'cert-hpc-1',
      requiredCertificationName: 'HPC & Distributed GPU Cluster Safety',
      specs: { GPU: '8x NVIDIA H100 SXM5', VRAM: '640GB HBM3', Cores: '112 CPU' },
      telemetry: {
        utilizationPercent: 88,
        temperatureCelsius: 64,
        powerWattage: 6500,
        currentJobName: 'LLM Fine-Tuning Run (Prof. Aris Lab)',
      },
    },
    {
      id: 'eq-2',
      name: 'NVIDIA DGX A100 Cluster Node #4',
      category: 'hpc_gpu',
      labLocation: 'AI Research Lab (Room 302)',
      status: 'operational',
      hourlyLimitPerWeek: 16,
      requiredCertificationId: 'cert-hpc-1',
      requiredCertificationName: 'HPC & Distributed GPU Cluster Safety',
      specs: { GPU: '4x NVIDIA A100 80GB', VRAM: '320GB', Cores: '64 CPU' },
      telemetry: {
        utilizationPercent: 42,
        temperatureCelsius: 52,
        powerWattage: 2800,
        currentJobName: 'Bioinformatics Vector Search Pipeline',
      },
    },
    {
      id: 'eq-3',
      name: 'Bambu Lab X1-Carbon 3D Printer Suite',
      category: '3d_printer',
      labLocation: 'Engineering Makerspace (West Hall)',
      status: 'operational',
      hourlyLimitPerWeek: 8,
      requiredCertificationId: 'cert-3d-1',
      requiredCertificationName: '3D Printer & MakerSpace Thermal Safety',
      specs: { BuildVolume: '256x256x256mm', Nozzle: '0.4mm Hardened Steel' },
      telemetry: {
        utilizationPercent: 95,
        temperatureCelsius: 220,
        powerWattage: 350,
        currentJobName: 'Robotics Team Chassis Prototyping',
      },
    },
    {
      id: 'eq-4',
      name: 'Varjo XR-4 Virtual Reality Spatial Lab',
      category: 'vr_suite',
      labLocation: 'Human-Computer Interaction Studio',
      status: 'operational',
      hourlyLimitPerWeek: 6,
      specs: { Resolution: '4K per eye Photorealistic', Tracking: 'Inside-Out LiDAR' },
    },
  ]);

  const [reservations, setReservations] = useState<EquipmentReservation[]>([
    {
      id: 'res-1',
      equipmentId: 'eq-1',
      equipmentName: 'NVIDIA DGX H100 Node #1',
      studentId: 'stud-1',
      studentName: 'Maya Lin',
      startTime: '2026-08-27T09:00:00Z',
      endTime: '2026-08-27T11:00:00Z',
      purpose: 'Model training for graduate thesis',
      status: 'active',
    },
    {
      id: 'res-2',
      equipmentId: 'eq-3',
      equipmentName: 'Bambu Lab X1-Carbon 3D Printer Suite',
      studentId: 'stud-2',
      studentName: 'Marcus T.',
      startTime: '2026-08-27T13:00:00Z',
      endTime: '2026-08-27T15:00:00Z',
      purpose: 'Robotics team drone mount printing',
      status: 'confirmed',
    },
  ]);

  const handleBookSlot = (equipmentId: string, timeSlot: string) => {
    const eq = equipmentList.find((e) => e.id === equipmentId);
    if (!eq) return;

    const proposedStart = new Date(`2026-08-27T${timeSlot}:00Z`);
    const proposedEnd = new Date(proposedStart.getTime() + 2 * 60 * 60 * 1000); // 2 hour window

    const validation = validateReservationEligibility(
      eq,
      studentCertifications,
      reservations,
      proposedStart,
      proposedEnd
    );

    if (!validation.isEligible) {
      alert(`Booking Failed: ${validation.reason}`);
      return;
    }

    const newRes: EquipmentReservation = {
      id: `res-${Date.now()}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      studentId: 'self',
      studentName: 'Alex Johnson',
      startTime: proposedStart.toISOString(),
      endTime: proposedEnd.toISOString(),
      purpose: 'Coursework & Research Experiments',
      status: 'confirmed',
    };

    setReservations([...reservations, newRes]);
    alert(`Success: Reserved "${eq.name}" for ${timeSlot} on August 27.`);
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <FlaskConical size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Campus Lab & HPC Compute Grid
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Centralized equipment scheduling, safety certification gating & live telemetry monitoring.
              </p>
            </div>

            {/* View Switcher */}
            <div className="neu-border bg-white p-1.5 flex items-center gap-2">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'schedule'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Calendar size={16} /> Reservation Matrix
              </button>
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'telemetry'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Activity size={16} /> Live Hardware Telemetry
              </button>
            </div>
          </div>

          {/* Active Certifications Status Strip */}
          <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span className="font-bold text-black">Active Safety Certifications:</span>
              <div className="flex gap-2">
                {studentCertifications.map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded font-bold"
                  >
                    {c.title} (Score: {c.scorePercent}%)
                  </span>
                ))}
              </div>
            </div>

            <div className="text-gray-500">
              Weekly Quota: <strong className="text-black">12.0 / 20.0 Hours Remaining</strong>
            </div>
          </div>

          {/* Active View */}
          {activeTab === 'schedule' ? (
            <EquipmentScheduleGrid
              equipmentList={equipmentList}
              reservations={reservations}
              onBookSlot={handleBookSlot}
            />
          ) : (
            <HardwareTelemetryDashboard equipmentList={equipmentList} />
          )}
        </div>
      </div>
    </SiteShell>
  );
}
