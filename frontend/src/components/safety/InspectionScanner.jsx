import React, { useState, useRef } from 'react';

export default function InspectionScanner({ orderId, catererId, reportedSensorTemp }) {
  const [capturing, setCapturing] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const fileInputRef = useRef(null);

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleCaptureAndValidate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCapturing(true);
    setScanResult(null);

    try {
      const base64Data = await convertFileToBase64(file);

      const response = await fetch(`/api/orders/${orderId}/verify-biological-safety`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          reportedTemp: reportedSensorTemp,
          catererId
        })
      });

      const data = await response.json();
      setScanResult(data.sessionRecord);
    } catch (err) {
      console.error('Error issuing physical scanning telemetry package:', err);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
      <h3 className="text-md font-bold text-white mb-1">Biological Verification Gateway</h3>
      <p className="text-xs text-slate-400 mb-6">Physical asset verification is mandatory to unlock escrow funds. Temperature telemetry profiles must align with visual protein matrix state checks.</p>

      <div className="space-y-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={capturing}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 text-white rounded-xl text-sm font-semibold transition tracking-wide shadow-lg"
        >
          {capturing ? 'Analyzing Protein Matrix...' : '📷 Capture Macro Inspection Photo'}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={handleCaptureAndValidate} 
        />

        {scanResult && (
          <div className={`p-4 rounded-xl border transition ${scanResult.safetyStatus === 'CONDEMNED_HAZARD' ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
            <h4 className={`text-sm font-bold uppercase tracking-wider ${scanResult.safetyStatus === 'CONDEMNED_HAZARD' ? 'text-red-400' : 'text-emerald-400'}`}>
              {scanResult.safetyStatus === 'CONDEMNED_HAZARD' ? '🛑 Food Asset Condemned' : '✅ Biological State Clear'}
            </h4>
            <div className="mt-3 space-y-1 text-xs text-slate-300 font-mono">
              <p>Microbial Proliferation Index: {scanResult.cvAnalysisResults.microbialProliferationIndex}</p>
              <p>Protein Oxidation Confidence: {(scanResult.cvAnalysisResults.proteinOxidationConfidence * 100).toFixed(0)}%</p>
              <p>Stripe Escrow Account Action: <span className="font-bold underline">{scanResult.stripeEscrowState}</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
