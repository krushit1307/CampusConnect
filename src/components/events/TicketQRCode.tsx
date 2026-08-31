import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface TicketQRCodeProps {
  jwtToken: string;
  eventName: string;
  userName: string;
}

export const TicketQRCode: React.FC<TicketQRCodeProps> = ({ jwtToken, eventName, userName }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-xl font-bold mb-2 text-gray-800">{eventName}</h2>
      <p className="text-sm text-gray-500 mb-6">Admit One: {userName}</p>
      
      <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <QRCodeSVG 
          value={jwtToken} 
          size={256} 
          level="H" // High error correction so it scans easily even if slightly damaged
          includeMargin={true}
        />
      </div>
      
      <p className="text-xs text-gray-400 mt-4 text-center">
        Present this secure QR code at the door. <br/> Screenshots may be rejected.
      </p>
    </div>
  );
};
