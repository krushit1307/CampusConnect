import React, { useState } from 'react';
import { LabEquipment, EquipmentReservation } from '@/types/labEquipment';
import { Clock, ShieldCheck, AlertCircle, Plus, Check } from 'lucide-react';

interface EquipmentScheduleGridProps {
  equipmentList: LabEquipment[];
  reservations: EquipmentReservation[];
  onBookSlot: (equipmentId: string, timeSlot: string) => void;
}

export function EquipmentScheduleGrid({
  equipmentList,
  reservations,
  onBookSlot,
}: EquipmentScheduleGridProps) {
  const timeSlots = [
    '09:00',
    '11:00',
    '13:00',
    '15:00',
    '17:00',
    '19:00',
  ];

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h3 className="font-display font-black text-xl text-black">
            Hardware & Lab Reservation Matrix
          </h3>
          <p className="font-mono text-xs text-gray-600">
            Daily scheduling matrix • Click any available green block to reserve equipment time.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-lime border border-black rounded" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-slate-200 border border-black rounded" />
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-red-200 border border-black rounded" />
            <span>Maintenance</span>
          </div>
        </div>
      </div>

      {/* Grid Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b-2 border-black bg-slate-50">
              <th className="p-3 font-black text-black">Resource / Lab Machine</th>
              {timeSlots.map((slot) => (
                <th key={slot} className="p-3 text-center font-bold text-gray-600">
                  {slot}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {equipmentList.map((eq) => {
              const isMaintenance = eq.status === 'maintenance' || eq.status === 'offline';

              return (
                <tr key={eq.id} className="hover:bg-slate-50/50">
                  <td className="p-3">
                    <div className="font-bold text-black text-sm">{eq.name}</div>
                    <div className="text-[11px] text-gray-500">{eq.labLocation}</div>
                    {eq.requiredCertificationName && (
                      <div className="text-[10px] text-purple-700 font-bold flex items-center gap-1 mt-0.5">
                        <ShieldCheck size={11} /> Cert Required
                      </div>
                    )}
                  </td>

                  {timeSlots.map((slot, idx) => {
                    // Check if reserved
                    const isReserved = reservations.some(
                      (r) => r.equipmentId === eq.id && r.startTime.includes(slot)
                    );

                    if (isMaintenance) {
                      return (
                        <td key={slot} className="p-2 text-center">
                          <div className="p-2.5 bg-red-100 border border-red-300 rounded text-[10px] text-red-700 font-bold">
                            Offline
                          </div>
                        </td>
                      );
                    }

                    if (isReserved) {
                      return (
                        <td key={slot} className="p-2 text-center">
                          <div className="p-2.5 bg-slate-200 border border-slate-300 rounded text-[10px] text-gray-600 font-bold">
                            Reserved
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={slot} className="p-2 text-center">
                        <button
                          onClick={() => onBookSlot(eq.id, slot)}
                          className="w-full p-2 bg-lime/30 hover:bg-lime border border-black rounded font-mono text-[10px] font-black uppercase text-black transition-all"
                        >
                          Book
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
