import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useIdempotentPayment } from "@/hooks/useIdempotentPayment";
import { useIdempotentPreorder } from "@/hooks/useIdempotentPreorder";
import { useMerchCartStore } from "@/store/useMerchCartStore";
import { Database } from "@/types/database.types";
import { formatCurrency } from "@/lib/ticketing/discountCalculator";
import { Loader2, CheckCircle, XCircle, Clipboard, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { useCallback } from "react";

import { Html5Qrcode } from "html5-qrcode";

type MerchOrderRow = {
  id: string;
  userId: string;
  clubId: string;
  paymentStatus: "pending" | "captured" | "failed";
  fulfillmentStatus: "pending" | "picked_up" | "cancelled";
  totalAmount: number;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  pickupCode: string | null;
  userName: string | null;
};

type MerchOrderItemRow = {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
};

interface FulfillmentDashboardProps {
  clubId: string;
}

/**
 * QR Scanner using html5-qrcode library (already installed as dependency).
 * Adapted from the existing TicketScanner component pattern in this repo.
 */
function useBarcodeScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraId, setCameraId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Initialize cameras on mount
  useEffect(() => {
    const initializeCameras = async () => {
      try {
        const devices = await import("html5-qrcode").Html5Qrcode.getCameras();
        if (devices && devices.length) {
          // Filter for rear/environment facing cameras if possible
          const rearCameras = devices.filter(
            (device) =>
              device.label.toLowerCase().includes("back") ||
              device.label.toLowerCase().includes("rear") ||
              device.label.toLowerCase().includes("environment"),
          );
          const camerasToUse = rearCameras.length > 0 ? rearCameras : devices;
          setAvailableCameras(camerasToUse);
          setCameraId(camerasToUse[0].id);
        }
      } catch (err) {
        console.error("Error fetching cameras:", err);
        setScannerError("Camera access is required for QR scanning. Please grant permissions.");
      }
    };
    initializeCameras();

    // Cleanup scanner on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = useCallback(async () => {
    if (!cameraId || isProcessing) return;

    try {
      setIsProcessing(true);
      // Start the scanner
      scannerRef.current = new (import("html5-qrcode").Html5Qrcode)("qr-reader-container", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      });

      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // Pause scanner on successful decode
          if (scannerRef.current) {
            await scannerRef.current.pause();
          }
          setIsProcessing(false);
          setScanResult(decodedText);
          setIsScanning(false);
        },
        (errorMessage) => {
          // Ignore continuous scan errors, they are normal
        },
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setScannerError("Failed to access camera. Please check permissions.");
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
    }
  }, [cameraId, isProcessing]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
      setScanResult(null);
    }
  }, [isScanning]);

  const switchCamera = useCallback(async () => {
    if (availableCameras.length <= 1) return;

    const currentIndex = availableCameras.findIndex((cam) => cam.id === cameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCameraId = availableCameras[nextIndex].id;

    setCameraId(nextCameraId);
    if (isScanning) {
      await stopScanning();
      // Small delay to ensure clean stop before restarting
      setTimeout(() => startScanning(), 500);
    }
  }, [availableCameras, cameraId, isScanning, stopScanning, startScanning]);

  return {
    isScanning,
    cameraId,
    availableCameras,
    scanResult,
    scannerError,
    isProcessing,
    startScanning,
    stopScanning,
    switchCamera,
  };
}

export function FulfillmentDashboard({ clubId }: FulfillmentDashboardProps) {
  const [orders, setOrders] = useState<MerchOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { isProcessing: isPaying } = useIdempotentPayment();
  const { isProcessing: isPreordering } = useIdempotentPreorder();
  const { clearCart } = useMerchCartStore();

  const {
    isScanning,
    cameraId,
    availableCameras,
    scanResult,
    scannerError,
    isProcessing,
    startScanning,
    stopScanning,
  } = useBarcodeScanner();

  useEffect(() => {
    fetchOrders();
  }, [clubId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("merch_orders")
        .select(
          `
                    *,
                    user:profiles!merch_orders_user_id_full_name(!full_name)
                `,
        )
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load orders: " + error.message);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // Resolve order by pickup_code from the orders list
  const resolveOrderByPickupCode = useCallback(
    (pickupCode: string) => {
      // Find order by pickup_code in the current orders list
      const order = orders.find((o) => o.pickupCode === pickupCode);
      return order || null;
    },
    [orders],
  );

  const handlePickup = async (orderId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in");
      return;
    }

    const { data: member } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .single();

    if (
      !member ||
      !["treasurer", "admin", "president", "vice_president", "secretary"].includes(member.role)
    ) {
      toast.error("You are not authorized to mark orders as picked up");
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      toast.error("Order not found");
      return;
    }

    if (order.paymentStatus !== "captured") {
      toast.error("Only paid orders can be marked as picked up");
      return;
    }

    if (order.fulfillmentStatus === "picked_up") {
      toast.error("This order has already been picked up");
      return;
    }

    const { error } = await supabase
      .from("merch_orders")
      .update({ fulfillment_status: "picked_up" })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order: " + error.message);
    } else {
      toast.success("Order marked as picked up");
      fetchOrders();
    }
  };

  // Handle scanned QR code - resolve order and pick up
  const handleScannedPickup = useCallback(
    async (pickupCode: string) => {
      // Resolve order by pickup_code
      const order = resolveOrderByPickupCode(pickupCode);
      if (!order) {
        toast.error("Order not found with this QR code");
        return;
      }

      // Reuse the existing handlePickup logic by calling it with the order ID
      // But we need to verify authorization first since we're doing it from QR scan
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in");
        return;
      }

      const { data: member } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();

      if (
        !member ||
        !["treasurer", "admin", "president", "vice_president", "secretary"].includes(member.role)
      ) {
        toast.error("You are not authorized to mark orders as picked up");
        return;
      }

      // Now use the existing pickup logic
      handlePickup(order.id);
    },
    [clubId, orders, resolveOrderByPickupCode, handlePickup],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Fulfillment Dashboard
        </h2>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Only paid orders can be marked as picked up. Scan a customer's order QR code to quickly
          identify and mark the order as picked up.
        </p>

        {/* QR Scan Controls */}
        <div className="mb-4 flex gap-2">
          {isScanning ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-600">Scanning...</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={stopScanning}
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </Button>
            </div>
          ) : (
            <Button
              onClick={startScanning}
              disabled={isProcessing}
              className="w-auto flex items-center gap-1"
            >
              <Scanner className="h-4 w-4 mr-1" />
              Scan Order QR
            </Button>
          )}
          {scannerError && <p className="mt-1 text-sm text-red-600">{scannerError}</p>}
        </div>

        {/* Scan Result Display */}
        {scanResult && !isScanning && (
          <div
            className="mb-4 p-4 rounded-lg"
            style={{ borderColor: "#10b981", backgroundColor: "#f0fdf4" }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-700">QR Code Scanned</p>
                <p className="text-sm text-green-600 break-all">{scanResult}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => handleScannedPickup(scanResult)}
                className="text-green-600 hover:text-green-700"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Mark Picked Up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={}
                className="text-gray-500 hover:text-gray-400"
              >
                <XCircle className="w-3.5 h-3.5" /> Close
              </Button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th
                  scope="col"
                  className="p-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Order ID
                </th>
                <th
                  scope="col"
                  className="p-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Customer
                </th>
                <th
                  scope="col"
                  className="p-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Payment Status
                </th>
                <th
                  scope="col"
                  className="p-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Fulfillment Status
                </th>
                <th
                  scope="col"
                  className="p-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Items & Qty
                </th>
                <th
                  scope="col"
                  className="p-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((order) => {
                const variantLines =
                  order.fulfillmentStatus === "picked_up"
                    ? []
                    : order.items
                        ?.map((item) => `${item.variant?.name || "Unknown"} × ${item.quantity}`)
                        .join(" • ");
                return (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="p-6 text-sm text-gray-900 dark:text-white">
                      {order.id.substring(0, 8)}
                    </td>
                    <td className="p-6 text-sm text-gray-900 dark:text-white">
                      {order.userName || "Unknown"}
                    </td>
                    <td className="p-6 text-sm">
                      {order.paymentStatus === "captured" ? (
                        <span className="text-green-600">Paid</span>
                      ) : order.paymentStatus === "pending" ? (
                        <span className="text-yellow-600">Pending</span>
                      ) : (
                        <span className="text-red-600">Failed</span>
                      )}
                    </td>
                    <td className="p-6 text-sm">
                      {order.fulfillmentStatus === "picked_up" ? (
                        <span className="text-green-600">Picked Up</span>
                      ) : order.fulfillmentStatus === "pending" ? (
                        <span className="text-yellow-600">Pending</span>
                      ) : (
                        <span className="text-red-600">Cancelled</span>
                      )}
                    </td>
                    <td className="p-6 text-sm text-gray-500 dark:text-gray-400">
                      {variantLines || "—"}
                    </td>
                    <td className="p-6">
                      {order.paymentStatus === "captured" &&
                        order.fulfillmentStatus !== "picked_up" && (
                          <Button
                            size="sm"
                            onClick={() => handlePickup(order.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Mark Picked Up
                          </Button>
                        )}
                      <div className="mt-2 text-xs text-gray-500">
                        QR Code: {order.pickupCode || "—"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* CSV Export Section */}
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-semibold text-gray-900 dark:text-white mb-4">
            Export Manufacturing CSV
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Exports paid orders aggregated by variant for manufacturing quantities. Only paid orders
            are counted.
          </p>
          <Button onClick={handleExportCSV} disabled={isPaying || isPreordering} className="w-full">
            {isPaying || isPreordering ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Clipboard className="w-4 h-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
