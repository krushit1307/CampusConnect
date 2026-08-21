import { useState, useEffect } from "react";

interface DynamicQRCodeProps {
  eventId: string;
}

export default function DynamicQRCode({ eventId }: DynamicQRCodeProps) {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    // Generate a rotating token every 10 seconds based on current time block
    const generateToken = () => {
      const timeBlock = Math.floor(Date.now() / 10000); // 10-second block
      setToken(`${eventId}-${timeBlock}`);
    };

    generateToken();
    const interval = setInterval(generateToken, 10000);
    return () => clearInterval(interval);
  }, [eventId]);

  // Using a mock QR Code API for visual demonstration
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(token)}`;

  return (
    <div className="flex flex-col items-center gap-4 neu-border p-6 bg-white dark:bg-zinc-900 rounded-lg">
      <h3 className="font-display text-xl font-bold uppercase">Check-In QR Code</h3>
      <p className="font-mono text-xs text-gray-500 max-w-[250px] text-center">
        This QR code refreshes every 10 seconds to prevent screenshot sharing.
      </p>

      <div className="border-4 border-black p-2 bg-white">
        <img
          src={qrUrl}
          alt="Dynamic QR Code"
          width={250}
          height={250}
          className="w-[250px] h-[250px]"
        />
      </div>

      <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-lime-700 dark:text-lime-400">
        <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
        Live Updating
      </div>
    </div>
  );
}
