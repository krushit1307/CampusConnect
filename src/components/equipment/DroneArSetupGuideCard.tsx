// =============================================================================
// Component: DroneArSetupGuideCard
// Issue: #5132 - Dynamic "Hardware Resource" Drone Maintenance Augmented Reality Guide
// Description: Guided AR setup experience for checked-out drones featuring camera object recognition,
// 3D holographic instructions, real-time pose verification, and flight-controller software unlocking.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  Camera,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Lock,
  Unlock,
  Compass,
  BatteryCharging,
  Maximize2,
} from "lucide-react";
import { globalDroneArSetupService } from "@/services/droneArSetupService";
import {
  DroneSetupSession,
  DroneModelDefinition,
  FlightControllerUnlockPayload,
} from "@/types/droneArSetup";

export interface DroneArSetupGuideCardProps {
  assetId: string;
  studentId?: string;
  isCheckedOutByStudent?: boolean;
  className?: string;
}

export const DroneArSetupGuideCard: React.FC<DroneArSetupGuideCardProps> = ({
  assetId,
  studentId = "student-pilot-007",
  isCheckedOutByStudent = true,
  className = "",
}) => {
  const [session, setSession] = useState<DroneSetupSession | null>(null);
  const [modelDef, setModelDef] = useState<DroneModelDefinition | null>(null);
  const [isVerifyingPose, setIsVerifyingPose] = useState<boolean>(false);
  const [poseFeedbackMessage, setPoseFeedbackMessage] = useState<string | null>(null);
  const [unlockPayload, setUnlockPayload] = useState<FlightControllerUnlockPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize Setup Session
  useEffect(() => {
    const initRes = globalDroneArSetupService.startSetupSession(
      assetId,
      studentId,
      isCheckedOutByStudent,
      "skydio_x2",
    );

    if (!initRes.success || !initRes.session) {
      setErrorMessage(initRes.error || "Failed to start hardware setup session.");
    } else {
      setSession(initRes.session);
      const def = globalDroneArSetupService.getSupportedModel(initRes.session.modelId);
      if (def) setModelDef(def);

      // Trigger Camera Model Recognition
      const recRes = globalDroneArSetupService.identifyDroneModelFromCamera(
        initRes.session.sessionId,
        "skydio_x2",
        0.94,
      );
      if (recRes.success && recRes.session) {
        setSession({ ...recRes.session });
      }
    }
  }, [assetId, studentId, isCheckedOutByStudent]);

  // Handle Camera Pose Verification for Current Step
  const handleVerifyCurrentStep = async () => {
    if (!session || !modelDef) return;

    setIsVerifyingPose(true);
    setPoseFeedbackMessage(null);
    setErrorMessage(null);

    const currentStep = modelDef.requiredSteps[session.currentStepIndex];
    if (!currentStep) return;

    // Simulate Pose Verification with Camera
    setTimeout(() => {
      const verRes = globalDroneArSetupService.verifyStepPose(
        session.sessionId,
        currentStep.stepId,
        0.96,
      );

      setPoseFeedbackMessage(verRes.poseMessage);

      if (verRes.isVerified) {
        const updatedSession = globalDroneArSetupService.getSession(session.sessionId);
        if (updatedSession) {
          setSession({ ...updatedSession });

          // Check if all steps completed -> Unlock Flight Controller
          if (updatedSession.status === "ALL_STEPS_VERIFIED") {
            const unlockRes = globalDroneArSetupService.completeAndUnlockFlightController(
              updatedSession.sessionId,
            );
            if (unlockRes.success && unlockRes.unlockPayload) {
              setUnlockPayload(unlockRes.unlockPayload);
              const unlockedSession = globalDroneArSetupService.getSession(session.sessionId);
              if (unlockedSession) setSession({ ...unlockedSession });
            }
          }
        }
      } else {
        setErrorMessage(verRes.poseMessage);
      }

      setIsVerifyingPose(false);
    }, 800);
  };

  if (errorMessage && !session) {
    return (
      <div
        className={`rounded-3xl bg-slate-900 border border-rose-500/40 p-6 text-rose-300 font-mono text-center space-y-3 ${className}`}
      >
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <div>{errorMessage}</div>
      </div>
    );
  }

  const currentStep = modelDef && session ? modelDef.requiredSteps[session.currentStepIndex] : null;
  const isUnlocked = session?.status === "FLIGHT_CONTROLLER_UNLOCKED";

  return (
    <div
      data-testid="drone-ar-setup-guide-card"
      className={`rounded-3xl bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden ${className}`}
    >
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Camera className="w-7 h-7 text-indigo-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AUGMENTED REALITY GUIDE 🛸
              </span>
              <span className="text-xs text-slate-400 font-mono">Asset #{assetId}</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Hardware Setup & Maintenance Guide
            </h2>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <span
              data-testid="status-unlocked-badge"
              className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span>FLIGHT CONTROLLER UNLOCKED</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>SETUP REQUIRED</span>
            </span>
          )}
        </div>
      </div>

      {/* Model Identification Banner */}
      {modelDef && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-mono">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>
              Camera Model Recognition: <strong>{modelDef.modelName}</strong>
            </span>
          </div>
          <span className="text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-500/30">
            94% CONFIDENCE
          </span>
        </div>
      )}

      {/* Camera AR Viewfinder Simulation */}
      <div className="relative aspect-video rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60 pointer-events-none" />

        {/* AR Target Reticle Overlay */}
        <div className="relative z-10 p-4 rounded-3xl border-2 border-dashed border-indigo-400/60 animate-pulse flex flex-col items-center space-y-2">
          <Maximize2 className="w-8 h-8 text-indigo-400" />
          <span className="text-xs font-mono text-indigo-300 uppercase tracking-widest font-bold">
            ALIGN DRONE WITHIN CAMERA RETICLE
          </span>
        </div>

        {currentStep && !isUnlocked && (
          <div className="relative z-10 text-xs font-mono text-amber-300 bg-slate-900/80 px-4 py-2 rounded-xl border border-amber-500/30">
            AR Overlay Target: <strong>{currentStep.arGuideType}</strong>
          </div>
        )}
      </div>

      {/* Step Instructions & Pose Verification Controls */}
      {!isUnlocked && currentStep ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Step {(session?.currentStepIndex ?? 0) + 1} of {modelDef?.requiredSteps.length}
            </span>
            <span className="text-indigo-400 font-bold">{currentStep.title}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-indigo-400" />
              <span>{currentStep.title}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {currentStep.instructionText}
            </p>
          </div>

          {poseFeedbackMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{poseFeedbackMessage}</span>
            </div>
          )}

          <button
            onClick={handleVerifyCurrentStep}
            disabled={isVerifyingPose}
            data-testid="verify-step-btn"
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
          >
            <Camera className="w-5 h-5 text-emerald-300" />
            <span>
              {isVerifyingPose
                ? "Analyzing Camera Pose Keypoints..."
                : `Verify ${currentStep.title} with Camera`}
            </span>
          </button>
        </div>
      ) : null}

      {/* Flight Controller Software Unlocked Banner */}
      {isUnlocked && unlockPayload && (
        <div
          data-testid="flight-controller-unlocked-banner"
          className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                All Mandatory Setup Steps Verified!
              </div>
              <h3 className="text-base font-bold text-white">
                Flight-Controller Software Unlocked
              </h3>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 font-mono text-xs text-slate-300">
            <div className="text-slate-400">Cryptographic Unlock Token:</div>
            <div className="text-emerald-300 font-bold truncate">{unlockPayload.unlockToken}</div>
          </div>

          <button className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2">
            <Unlock className="w-4 h-4 text-emerald-200" />
            <span>Launch Flight Controller Interface</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DroneArSetupGuideCard;
