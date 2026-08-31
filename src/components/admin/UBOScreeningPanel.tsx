// src/components/admin/UBOScreeningPanel.tsx
// Issue: #5364 - Automated "Club Spending" Corporate Tax ID Scraper (OFAC Sanctions Beneficial Ownership)
// Description: Admin interface for UBO screening and sanctions checking

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Building,
  User,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  tax_id: string;
  legal_entity_type: string;
  jurisdiction: string;
  is_sanctioned: boolean;
  sanctions_blocked_at: string | null;
  sanctions_reason: string | null;
  created_at: string;
}

interface CorporateOwnership {
  id: string;
  vendor_id: string;
  owner_type: string;
  owner_name: string;
  owner_tax_id: string | null;
  ownership_percentage: number;
  is_ultimate_beneficial_owner: boolean;
  jurisdiction: string | null;
  address: string | null;
  nationality: string | null;
  source: string;
}

interface SanctionsScreening {
  id: string;
  vendor_id: string;
  screening_type: string;
  entity_name: string;
  entity_type: string;
  match_score: number;
  is_match: boolean;
  ofac_list: string | null;
  screening_timestamp: string;
}

interface LegalAlert {
  id: string;
  vendor_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  entity_name: string | null;
  alert_status: string;
  created_at: string;
}

export function UBOScreeningPanel() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [ownership, setOwnership] = useState<CorporateOwnership[]>([]);
  const [screenings, setScreenings] = useState<SanctionsScreening[]>([]);
  const [alerts, setAlerts] = useState<LegalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setVendors(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorDetails = async (vendor: Vendor) => {
    setSelectedVendor(vendor);

    try {
      const [ownershipData, screeningsData, alertsData] = await Promise.all([
        supabase
          .from("corporate_ownership")
          .select("*")
          .eq("vendor_id", vendor.id)
          .order("ownership_percentage", { ascending: false }),
        supabase
          .from("sanctions_screenings")
          .select("*")
          .eq("vendor_id", vendor.id)
          .order("screening_timestamp", { ascending: false }),
        supabase
          .from("legal_alerts")
          .select("*")
          .eq("vendor_id", vendor.id)
          .order("created_at", { ascending: false }),
      ]);

      setOwnership(ownershipData.data || []);
      setScreenings(screeningsData.data || []);
      setAlerts(alertsData.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch vendor details");
    }
  };

  const handleScreenVendor = async (vendorId: string, taxId: string, jurisdiction: string) => {
    setScreening(true);
    try {
      const response = await fetch("/functions/v1/ubo-screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, tax_id: taxId, jurisdiction }),
      });

      if (!response.ok) throw new Error("Screening failed");

      const result = await response.json();
      toast.success(
        `Screening complete. UBOs: ${result.ubos_count}, Sanctions: ${result.has_sanctions ? "Found" : "None"}`,
      );

      fetchVendors();
      if (selectedVendor?.id === vendorId) {
        fetchVendorDetails(selectedVendor);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to screen vendor");
    } finally {
      setScreening(false);
    }
  };

  const handleCreateVendor = async () => {
    const name = prompt("Enter vendor name:");
    if (!name) return;

    const taxId = prompt("Enter tax ID (optional):") || null;
    const jurisdiction = prompt("Enter jurisdiction (e.g., us, de):") || "us";

    try {
      const { data, error } = await supabase.rpc("create_vendor", {
        p_name: name,
        p_tax_id: taxId,
        p_jurisdiction: jurisdiction,
      });

      if (error) throw error;

      toast.success("Vendor created successfully");
      fetchVendors();

      // Automatically screen the new vendor if tax ID provided
      if (taxId) {
        handleScreenVendor(data, taxId, jurisdiction);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create vendor");
    }
  };

  const handleAddOwnership = async () => {
    if (!selectedVendor) return;

    const ownerName = prompt("Enter owner name:");
    if (!ownerName) return;

    const ownerType = prompt("Enter owner type (individual/corporation/trust):") || "individual";
    const ownershipPercentage = parseFloat(prompt("Enter ownership percentage (0-100):") || "0");

    try {
      const { error } = await supabase.rpc("add_corporate_ownership", {
        p_vendor_id: selectedVendor.id,
        p_owner_type: ownerType,
        p_owner_name: ownerName,
        p_ownership_percentage: ownershipPercentage,
      });

      if (error) throw error;

      toast.success("Ownership added successfully");
      fetchVendorDetails(selectedVendor);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to add ownership");
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const notes = prompt("Enter resolution notes:");
    if (!notes) return;

    try {
      const { error } = await supabase
        .from("legal_alerts")
        .update({
          alert_status: "reviewed",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq("id", alertId);

      if (error) throw error;

      toast.success("Alert resolved successfully");
      if (selectedVendor) {
        fetchVendorDetails(selectedVendor);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to resolve alert");
    }
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.tax_id && v.tax_id.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${colors[severity as keyof typeof colors] || colors.low}`}
      >
        {severity.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display uppercase">UBO Screening</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            Corporate ownership tracking and OFAC sanctions screening
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchVendors} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateVendor}>
            <Building className="w-4 h-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search vendors by name or tax ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendors List */}
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Vendors</h3>
          {filteredVendors.length === 0 ? (
            <p className="text-gray-600 font-mono">No vendors found</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    selectedVendor?.id === vendor.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => fetchVendorDetails(vendor)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {vendor.is_sanctioned ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-bold">{vendor.name}</span>
                      </div>
                      <div className="text-xs text-gray-600 font-mono mt-1">
                        {vendor.tax_id && <span>Tax ID: {vendor.tax_id}</span>}
                        {vendor.jurisdiction && <span> • {vendor.jurisdiction}</span>}
                      </div>
                    </div>
                    {vendor.tax_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleScreenVendor(vendor.id, vendor.tax_id, vendor.jurisdiction || "us");
                        }}
                        disabled={screening}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Screen
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vendor Details */}
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          {selectedVendor ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold font-display uppercase">Vendor Details</h3>
                {selectedVendor.is_sanctioned && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    SANCTIONED
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">Name</span>
                  <p className="font-bold">{selectedVendor.name}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Tax ID
                  </span>
                  <p>{selectedVendor.tax_id || "N/A"}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Entity Type
                  </span>
                  <p>{selectedVendor.legal_entity_type}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Jurisdiction
                  </span>
                  <p>{selectedVendor.jurisdiction || "N/A"}</p>
                </div>
                {selectedVendor.is_sanctioned && (
                  <div className="bg-red-50 p-3 rounded border border-red-200">
                    <span className="font-mono text-xs uppercase font-bold text-gray-500">
                      Sanctions Info
                    </span>
                    <p className="text-red-800">{selectedVendor.sanctions_reason}</p>
                    <p className="text-xs text-red-600">
                      Blocked:{" "}
                      {selectedVendor.sanctions_blocked_at
                        ? new Date(selectedVendor.sanctions_blocked_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddOwnership} variant="outline" size="sm">
                  <User className="w-4 h-4 mr-1" />
                  Add Ownership
                </Button>
              </div>

              {/* Corporate Ownership */}
              <div>
                <h4 className="font-bold font-display uppercase text-sm mb-2">
                  Corporate Ownership
                </h4>
                {ownership.length === 0 ? (
                  <p className="text-gray-600 font-mono text-sm">No ownership data</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {ownership.map((owner) => (
                      <div
                        key={owner.id}
                        className={`p-2 rounded border ${
                          owner.is_ultimate_beneficial_owner
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{owner.owner_name}</p>
                            <p className="text-xs text-gray-600">
                              {owner.owner_type} • {owner.ownership_percentage}%
                            </p>
                          </div>
                          {owner.is_ultimate_beneficial_owner && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                              UBO
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sanctions Screenings */}
              <div>
                <h4 className="font-bold font-display uppercase text-sm mb-2">
                  Sanctions Screenings
                </h4>
                {screenings.length === 0 ? (
                  <p className="text-gray-600 font-mono text-sm">No screenings performed</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {screenings.map((screening) => (
                      <div
                        key={screening.id}
                        className={`p-2 rounded border ${
                          screening.is_match
                            ? "bg-red-50 border-red-200"
                            : "bg-green-50 border-green-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{screening.entity_name}</p>
                            <p className="text-xs text-gray-600">
                              {screening.screening_type} • Score: {screening.match_score}
                            </p>
                          </div>
                          {screening.is_match ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Legal Alerts */}
              <div>
                <h4 className="font-bold font-display uppercase text-sm mb-2">Legal Alerts</h4>
                {alerts.length === 0 ? (
                  <p className="text-gray-600 font-mono text-sm">No alerts</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="p-3 rounded border bg-orange-50 border-orange-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="font-bold text-sm">{alert.title}</span>
                          </div>
                          {getSeverityBadge(alert.severity)}
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{alert.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                          {alert.alert_status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveAlert(alert.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-600 font-mono">
              Select a vendor to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
