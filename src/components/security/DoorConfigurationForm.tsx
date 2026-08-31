import React, { useEffect, useState } from "react";
import { Sliders, DoorOpen, Save, ShieldAlert, AlertCircle } from "lucide-react";
import { tailgatingService } from "../../services/tailgatingService";
import { AccessControlDoor, DoorConfiguration, SecuritySeverity } from "../../types/tailgating";
import { toast } from "sonner";

export const DoorConfigurationForm: React.FC = () => {
  const [doors, setDoors] = useState<AccessControlDoor[]>([]);
  const [selectedDoorId, setSelectedDoorId] = useState<string>("");
  const [config, setConfig] = useState<DoorConfiguration | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadDoors = async () => {
      setLoading(true);
      try {
        const list = await tailgatingService.getDoors();
        setDoors(list);
        if (list.length > 0) {
          setSelectedDoorId(list[0].id);
        }
      } catch {
        toast.error("Failed to load doors inventory.");
      } finally {
        setLoading(false);
      }
    };
    loadDoors();
  }, []);

  useEffect(() => {
    if (!selectedDoorId) return;

    const loadConfig = async () => {
      try {
        const configs = await tailgatingService.getDoorConfigurations();
        const active = configs.find((c) => c.doorId === selectedDoorId);
        if (active) {
          setConfig({ ...active });
        } else {
          // Default baseline config
          setConfig({
            doorId: selectedDoorId,
            cameraId: `cam-${selectedDoorId.substring(0, 5)}`,
            expectedCrossingCount: 1,
            detectionWindowSeconds: 5,
            confidenceThreshold: 0.7,
            alertSeverity: "HIGH",
            alarmSimulationMode: true,
            evidenceRetentionDays: 7,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        toast.error("Failed to load settings configuration.");
      }
    };
    loadConfig();
    setErrors({});
  }, [selectedDoorId]);

  const validate = (): boolean => {
    if (!config) return false;
    const tempErrors: Record<string, string> = {};

    if (!config.cameraId.trim()) {
      tempErrors.cameraId = "Camera association ID is required.";
    }
    if (config.expectedCrossingCount < 1) {
      tempErrors.expectedCrossingCount = "Expected crossing count must be at least 1.";
    }
    if (config.detectionWindowSeconds < 2 || config.detectionWindowSeconds > 30) {
      tempErrors.detectionWindowSeconds = "Window must be between 2 and 30 seconds.";
    }
    if (config.confidenceThreshold < 0.0 || config.confidenceThreshold > 1.0) {
      tempErrors.confidenceThreshold = "Confidence threshold must be between 0.0 and 1.0.";
    }
    if (config.evidenceRetentionDays < 1 || config.evidenceRetentionDays > 90) {
      tempErrors.evidenceRetentionDays = "Retention must be between 1 and 90 days.";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !validate()) return;

    try {
      const success = await tailgatingService.saveDoorConfiguration(config, "admin-user-01");
      if (success) {
        toast.success("Security configuration settings saved successfully.");
      }
    } catch {
      toast.error("Failed to save changes.");
    }
  };

  if (loading || !config) {
    return (
      <div className="border-2 border-black p-8 text-center text-xs font-mono">
        Loading configuration schemas...
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 font-mono text-zinc-900 dark:text-zinc-100 max-w-2xl">
      <div className="neu-border bg-white dark:bg-zinc-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
        <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2 border-b-2 border-black dark:border-zinc-700 pb-3 mb-6">
          <Sliders className="h-5 w-5 text-indigo-600" />
          Configure Door Security Rules
        </h2>

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* Door Select */}
          <div className="space-y-2">
            <label className="font-bold text-zinc-500 uppercase block">Selected Access Gate:</label>
            <div className="relative">
              <select
                value={selectedDoorId}
                onChange={(e) => setSelectedDoorId(e.target.value)}
                className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 text-xs font-bold pl-8 outline-none"
              >
                {doors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.building})
                  </option>
                ))}
              </select>
              <DoorOpen className="absolute left-2.5 top-3 h-4 w-4 text-zinc-500" />
            </div>
          </div>

          {/* Camera ID */}
          <div className="space-y-2">
            <label className="font-bold text-zinc-500 uppercase block">
              Associated Camera Device ID:
            </label>
            <input
              type="text"
              value={config.cameraId}
              onChange={(e) => setConfig({ ...config, cameraId: e.target.value })}
              className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 font-bold outline-none"
            />
            {errors.cameraId && (
              <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" /> {errors.cameraId}
              </span>
            )}
          </div>

          {/* Thresholds Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="font-bold text-zinc-500 uppercase block">
                Expected Passages (Badge):
              </label>
              <input
                type="number"
                value={config.expectedCrossingCount}
                onChange={(e) =>
                  setConfig({ ...config, expectedCrossingCount: Number(e.target.value) })
                }
                className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 font-bold outline-none"
              />
              {errors.expectedCrossingCount && (
                <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.expectedCrossingCount}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-bold text-zinc-500 uppercase block">
                Detection Window (Seconds):
              </label>
              <input
                type="number"
                value={config.detectionWindowSeconds}
                onChange={(e) =>
                  setConfig({ ...config, detectionWindowSeconds: Number(e.target.value) })
                }
                className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 font-bold outline-none"
              />
              {errors.detectionWindowSeconds && (
                <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.detectionWindowSeconds}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="font-bold text-zinc-500 uppercase block">
                Confidence Level (0.0 - 1.0):
              </label>
              <input
                type="number"
                step="0.05"
                value={config.confidenceThreshold}
                onChange={(e) =>
                  setConfig({ ...config, confidenceThreshold: Number(e.target.value) })
                }
                className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 font-bold outline-none"
              />
              {errors.confidenceThreshold && (
                <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.confidenceThreshold}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-bold text-zinc-500 uppercase block">
                Evidence Retention (Days):
              </label>
              <input
                type="number"
                value={config.evidenceRetentionDays}
                onChange={(e) =>
                  setConfig({ ...config, evidenceRetentionDays: Number(e.target.value) })
                }
                className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 font-bold outline-none"
              />
              {errors.evidenceRetentionDays && (
                <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.evidenceRetentionDays}
                </span>
              )}
            </div>
          </div>

          {/* Severity & Sim mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="font-bold text-zinc-500 uppercase block">Alert Severity:</label>
              <select
                value={config.alertSeverity}
                onChange={(e) =>
                  setConfig({ ...config, alertSeverity: e.target.value as SecuritySeverity })
                }
                className="w-full border-2 border-black p-2.5 bg-white dark:bg-zinc-800 text-xs font-bold outline-none"
              >
                <option value="INFO">INFO</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-zinc-500 uppercase block">Override Mode:</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="sim-mode"
                  checked={config.alarmSimulationMode}
                  onChange={(e) => setConfig({ ...config, alarmSimulationMode: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer border-2 border-black"
                />
                <label
                  htmlFor="sim-mode"
                  className="font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Simulation Only (Safe Mode)
                </label>
              </div>
            </div>
          </div>

          {/* Save trigger */}
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-black font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-4"
          >
            <Save className="h-4.5 w-4.5" /> Save Configuration Settings
          </button>
        </form>
      </div>
    </div>
  );
};
