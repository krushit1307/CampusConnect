import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Device = {
  id: string;
  browser: string;
  os: string;
  last_login_at: string;
  created_at: string;
};

export function SecuritySection() {
  const supabase = createClient();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("list-user-devices");

    if (error) {
      toast.error("Failed to load devices.");
    } else {
      setDevices(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const revokeDevice = async (deviceId: string) => {
    const { error } = await supabase.functions.invoke("revoke-device", {
      body: { deviceId },
    });

    if (error) {
      toast.error("Failed to revoke device.");
      return;
    }

    toast.success("Device revoked successfully.");
    fetchDevices();
  };

  return (
    <section className="mt-8 rounded-xl border p-6">
      <h2 className="text-xl font-semibold">Security</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Manage devices that are currently recognized for your account.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trusted devices found.</p>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                {device.os.toLowerCase().includes("ios") ||
                device.os.toLowerCase().includes("android") ? (
                  <Smartphone className="h-5 w-5" />
                ) : (
                  <Monitor className="h-5 w-5" />
                )}

                <div>
                  <p className="font-medium">
                    {device.os} • {device.browser}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Last active {new Date(device.last_login_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => revokeDevice(device.id)}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
