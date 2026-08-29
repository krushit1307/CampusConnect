import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Calendar,
  Landmark,
  Check,
  X,
  ShieldAlert,
  ArrowRightLeft,
  HeartHandshake,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function EquipmentMarketplace() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [rentDays, setRentDays] = useState(2);
  const [myClubId, setMyClubId] = useState<string>("");
  const [isCheckingAirspace, setIsCheckingAirspace] = useState(false);
  const [airspaceError, setAirspaceError] = useState<string | null>(null);

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-for-rentals"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch user's first approved club where they are admin
      const { data: members } = await supabase
        .from("club_members")
        .select("club_id, clubs(name)")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .eq("status", "approved")
        .limit(1);

      if (members && members.length > 0) {
        setMyClubId(members[0].club_id);
      }
      return user;
    },
  });

  const checkAirspace = async (item: any) => {
    if (!item) return;
    const isDrone =
      item.category?.toLowerCase() === "drone" ||
      item.category?.toLowerCase() === "drones" ||
      item.name?.toLowerCase().includes("drone");

    if (!isDrone) {
      setAirspaceError(null);
      return;
    }

    setIsCheckingAirspace(true);
    setAirspaceError(null);

    const campusLat = 41.703;
    const campusLng = -86.239;
    const startDate = new Date();
    const dateStr = startDate.toISOString().split("T")[0];

    try {
      const url = `https://api.faa.gov/uas/b4ufly/v1/airspace?latitude=${campusLat}&longitude=${campusLng}&date=${dateStr}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("FAA API connection failed");
      }
      const data = await response.json();
      if (data.restricted) {
        setAirspaceError(
          data.reason ||
            "Airspace Restricted: A Temporary Flight Restriction is active on this date. Drones cannot be flown. Booking denied for legal compliance.",
        );
      } else {
        setAirspaceError(null);
      }
    } catch (err: any) {
      console.error("Failed to check airspace via FAA/B4UFLY API:", err);
    } finally {
      setIsCheckingAirspace(false);
    }
  };

  // Trigger check when selection changes
  useEffect(() => {
    if (selectedItem) {
      checkAirspace(selectedItem);
    } else {
      setAirspaceError(null);
    }
  }, [selectedItem, rentDays]);

  // Fetch gear catalog (is_rentable = true)
  const {
    data: catalog = [],
    isLoading: isCatalogLoading,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ["rentable-gear-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select(
          `
          *,
          clubs (
            id,
            name
          )
        `,
        )
        .eq("is_rentable", true)
        .eq("is_active", true);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch rentals logs (borrowed & lent)
  const {
    data: rentals = [],
    isLoading: isRentalsLoading,
    refetch: refetchRentals,
  } = useQuery({
    queryKey: ["equipment-rentals-logs", myClubId],
    queryFn: async () => {
      if (!myClubId) return [];
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select(
          `
          *,
          item:inventory_items (
            name,
            owner_club_id,
            clubs (name)
          ),
          renter:clubs!equipment_rentals_renter_club_id_fkey (name),
          contracts:equipment_rental_contracts (
            contract_text,
            created_at
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!myClubId,
  });

  // Filter catalog by search query
  const filteredCatalog = catalog.filter(
    (item: any) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Request Rent Mutation
  const requestRentMutation = useMutation({
    mutationFn: async () => {
      if (!myClubId) throw new Error("You must be an approved club admin to rent equipment.");
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + rentDays);

      // Propose request
      const { data: rentalId, error } = await supabase.rpc("request_equipment_rental", {
        p_item_id: selectedItem.id,
        p_renter_club_id: myClubId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });

      if (error) throw error;
      return rentalId;
    },
    onSuccess: () => {
      toast.success("Rental request submitted to owner club for approval!");
      setSelectedItem(null);
      refetchCatalog();
      refetchRentals();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process rental.");
    },
  });

  // Approve Rental Mutation
  const approveRentalMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      const { data, error } = await supabase.rpc("approve_equipment_rental", {
        p_rental_id: rentalId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rental request approved! Ledger balance transferred and contract signed.");
      refetchCatalog();
      refetchRentals();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve rental.");
    },
  });

  // Return Item / Capture Mutation
  const returnMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"}/functions/v1/process-rental-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "capture-payment",
            rentalId,
          }),
        },
      );

      const resJson = await response.json();
      if (!response.ok) throw new Error(resJson.error || "Payment capture failed");

      return resJson;
    },
    onSuccess: () => {
      toast.success("Item returned safely! Security deposit released and rental fee captured.");
      refetchCatalog();
      refetchRentals();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to complete return capture.");
    },
  });

  return (
    <SiteShell>
      {/* Hero Header */}
      <section className="border-b-2 border-black bg-[#a3e635] px-4 py-14 md:px-6 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow font-bold text-black flex items-center gap-1.5 uppercase font-mono">
                <HeartHandshake className="w-4 h-4" /> B2B Club Marketplace
              </p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl uppercase">
                P2P Equipment Rentals
              </h1>
              <p className="mt-4 max-w-2xl font-mono text-sm leading-6 text-gray-900">
                Share expensive gear between student clubs campus-wide. Book equipment dynamically,
                secure deposits via Stripe authorizations, and optimize club resources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Search & Grid */}
      <section className="bg-cream px-4 py-12 md:px-6 min-h-[400px] text-black border-b-2 border-black">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-8">
            <h2 className="font-display text-2xl font-black uppercase text-black">Gear Catalog</h2>
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search gear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="neu-border bg-white w-full p-2 pl-9 font-mono text-sm"
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {isCatalogLoading ? (
            <div className="text-center font-mono text-sm py-12">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading gear catalog...
            </div>
          ) : filteredCatalog.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredCatalog.map((item: any) => {
                const isOwner = item.owner_club_id === myClubId;
                return (
                  <div
                    key={item.id}
                    className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] flex flex-col justify-between"
                  >
                    <div className="space-y-3 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200 uppercase">
                          {item.category}
                        </span>
                        <span className="text-xs text-gray-500 font-bold uppercase">
                          {item.clubs?.name}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-black uppercase text-black">
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Condition:{" "}
                        <span className="font-bold uppercase text-black">{item.condition}</span>
                      </p>
                      <div className="text-sm font-black text-indigo-600">
                        ${(item.daily_rental_rate / 100).toFixed(2)} / Day
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100">
                      {isOwner ? (
                        <div className="text-center font-mono text-xs text-gray-500 italic bg-gray-50 p-2 border border-dashed border-gray-200">
                          Your Club's Item
                        </div>
                      ) : (
                        <Button
                          onClick={() => setSelectedItem(item)}
                          className="neu-border bg-indigo-600 text-white hover:bg-indigo-500 w-full rounded-none shadow-[2px_2px_0_0_#000]"
                        >
                          Rent Gear
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="neu-border bg-white p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="font-mono text-sm text-gray-500 italic">
                No rentable equipment found matching search parameters.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Rentals Transactions Panel */}
      {myClubId && (
        <section className="bg-cream px-4 py-12 md:px-6 min-h-[300px] text-black">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-display text-2xl font-black uppercase text-black mb-8">
              My Club's Transactions
            </h2>

            {isRentalsLoading ? (
              <div className="text-center py-6">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
              </div>
            ) : rentals.length > 0 ? (
              <div className="space-y-4">
                {rentals.map((r: any) => {
                  const isBorrower = r.renter_club_id === myClubId;
                  const otherClubName = isBorrower ? r.item?.clubs?.name : r.renter?.name;

                  return (
                    <div
                      key={r.id}
                      className="neu-border bg-white p-5 shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="space-y-2 font-mono text-xs text-gray-700">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              r.status === "authorized"
                                ? "bg-green-100 border-green-200 text-green-800"
                                : r.status === "captured"
                                  ? "bg-indigo-100 border-indigo-200 text-indigo-800"
                                  : "bg-gray-100 border-gray-200 text-gray-800"
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="font-bold text-gray-500 uppercase">
                            {isBorrower ? "Borrowed" : "Lent / Offered"}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-black uppercase">
                          {r.item?.name}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          <div>
                            <span className="font-bold">Other Club:</span> {otherClubName}
                          </div>
                          <div>
                            <span className="font-bold">Rental Term:</span>{" "}
                            {new Date(r.start_date).toLocaleDateString()} -{" "}
                            {new Date(r.end_date).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-bold">Rental Fee:</span> $
                            {(r.rental_fee_cents / 100).toFixed(2)}
                          </div>
                          <div>
                            <span className="font-bold">Security Deposit:</span> $
                            {(r.security_deposit_cents / 100).toFixed(2)} (Authorized)
                          </div>
                        </div>

                        {r.contracts && r.contracts.length > 0 && (
                          <div className="mt-3 p-3 bg-yellow-50 border-2 border-dashed border-yellow-300 font-mono text-[10px] text-yellow-800 rounded shadow-[1px_1px_0_0_#000]">
                            <p className="font-bold uppercase mb-1">📜 Signed Digital Contract:</p>
                            <p>{r.contracts[0].contract_text}</p>
                          </div>
                        )}
                      </div>

                      {/* Approval or Return Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {!isBorrower && r.status === "requested" && (
                          <Button
                            onClick={() => approveRentalMutation.mutate(r.id)}
                            disabled={approveRentalMutation.isPending}
                            className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 rounded-none shadow-[2px_2px_0_0_#000] font-bold uppercase text-xs"
                          >
                            {approveRentalMutation.isPending
                              ? "Approving..."
                              : "Approve Rental Request"}
                          </Button>
                        )}
                        {!isBorrower && r.status === "authorized" && (
                          <Button
                            onClick={() => returnMutation.mutate(r.id)}
                            disabled={returnMutation.isPending}
                            className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 rounded-none shadow-[2px_2px_0_0_#000] font-bold uppercase text-xs"
                          >
                            Item Returned Safely
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="neu-border bg-white p-8 text-center shadow-[4px_4px_0_0_#000] italic font-mono text-sm text-gray-500">
                No active rental contracts recorded for your organization.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Booking date-picker dialog popup */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="neu-border border-black bg-cream rounded-none p-6 text-black">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold uppercase text-indigo-900">
              Rent {selectedItem?.name}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-gray-700">
              Rent this equipment from {selectedItem?.clubs?.name}. Authorizes the rental fee plus a
              $500 safety security deposit on your credit card.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 font-mono text-sm my-4 border-2 border-black p-4 bg-white shadow-[2px_2px_0_0_#000]">
              {isCheckingAirspace && (
                <div className="bg-blue-50 text-blue-800 border border-blue-200 p-2 text-xs font-bold font-mono">
                  Checking FAA/B4UFLY airspace status...
                </div>
              )}
              {airspaceError && (
                <div className="bg-red-50 text-red-800 border border-red-200 p-3 text-xs font-bold font-mono whitespace-pre-wrap">
                  {airspaceError}
                </div>
              )}
              <div className="flex justify-between">
                <span>Daily Rental Rate:</span>
                <span className="font-bold">
                  ${(selectedItem.daily_rental_rate / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase">Duration (Days)</label>
                <select
                  value={rentDays}
                  onChange={(e) => setRentDays(parseInt(e.target.value))}
                  className="neu-border bg-white p-1.5 font-mono text-sm w-full"
                >
                  {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                    <option key={n} value={n}>
                      {n} Day(s)
                    </option>
                  ))}
                </select>
              </div>
              <hr className="border-black border" />
              <div className="flex justify-between">
                <span>Total Rental Fee:</span>
                <span className="font-bold">
                  ${((selectedItem.daily_rental_rate * rentDays) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-yellow-600">
                <span>Security Deposit:</span>
                <span className="font-bold">$500.00</span>
              </div>
              <div className="bg-yellow-50 p-2 text-xs text-yellow-800 border border-yellow-200">
                The $500 deposit is only authorized (held). It will be released when the owner club
                marks the item as returned safely.
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedItem(null)}
              className="neu-border bg-white text-black font-bold uppercase rounded-none"
            >
              Cancel
            </Button>
            <Button
              onClick={() => requestRentMutation.mutate()}
              disabled={requestRentMutation.isPending || isCheckingAirspace || !!airspaceError}
              className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 font-bold uppercase rounded-none shadow-[2px_2px_0_0_#000]"
            >
              Authorize & Rent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
