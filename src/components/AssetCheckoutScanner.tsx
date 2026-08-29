import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast } from 'sonner';
import { Camera, User, CheckCircle2 } from 'lucide-react';

export default function AssetCheckoutScanner() {
  const [scannedAsset, setScannedAsset] = useState<string | null>(null);
  const [scannedUser, setScannedUser] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the scanner only if we haven't scanned both items yet
    if (scannedAsset && scannedUser) return;

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        if (!scannedAsset) {
          setScannedAsset(decodedText);
          toast.success(`Asset Scanned: ${decodedText}`);
          scanner.clear(); // Briefly stop scanning to let the UI update
        } else if (!scannedUser) {
          setScannedUser(decodedText);
          toast.success(`User Scanned: ${decodedText}`);
          scanner.clear();
        }
      },
      (error) => {
        // We ignore scan errors because it throws them constantly until it finds a valid code
      }
    );

    // Cleanup function when component unmounts
    return () => {
      scanner.clear().catch(console.error);
    };
  }, [scannedAsset, scannedUser]);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-2xl font-bold text-center">Equipment Checkout</h2>
      
      {/* The div where the camera stream will render */}
      {(!scannedAsset || !scannedUser) && (
        <div id="reader" className="w-full overflow-hidden rounded-lg border-2 border-dashed border-gray-300"></div>
      )}

      <div className="space-y-4">
        <div className={`p-4 rounded-lg flex items-center gap-4 ${scannedAsset ? 'bg-green-50 text-green-700' : 'bg-gray-50'}`}>
          <Camera className={scannedAsset ? 'text-green-500' : 'text-gray-400'} />
          <span className="font-medium">
            {scannedAsset ? `Asset ID: ${scannedAsset}` : 'Awaiting Camera Barcode...'}
          </span>
          {scannedAsset && <CheckCircle2 className="ml-auto text-green-500" />}
        </div>

        <div className={`p-4 rounded-lg flex items-center gap-4 ${scannedUser ? 'bg-green-50 text-green-700' : 'bg-gray-50'}`}>
          <User className={scannedUser ? 'text-green-500' : 'text-gray-400'} />
          <span className="font-medium">
            {scannedUser ? `User ID: ${scannedUser}` : 'Awaiting User QR Code...'}
          </span>
          {scannedUser && <CheckCircle2 className="ml-auto text-green-500" />}
        </div>
      </div>

      {scannedAsset && scannedUser && (
        <button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          onClick={() => console.log('Proceed to checkout backend integration!')}
        >
          Confirm Checkout
        </button>
      )}
    </div>
  );
}
