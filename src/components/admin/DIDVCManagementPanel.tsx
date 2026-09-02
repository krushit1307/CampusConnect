// src/components/admin/DIDVCManagementPanel.tsx
// Issue: #5467 - Interactive "Dietary Restriction" Live IoT Temp Logging (FDA Blockchain Compliance Export via Zero-Knowledge Proofs and Decentralized Identifiers)
// Description: Admin interface for DID/VC management and FDA compliance verification

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Shield,
  CheckCircle,
  XCircle,
  FileText,
  Key,
  Activity,
  RefreshCw,
  Award,
  Clock,
  Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface DIDRegistry {
  id: string;
  did: string;
  did_method: string;
  controller_id: string;
  did_document: any;
  is_active: boolean;
  is_revoked: boolean;
  created_at: string;
  updated_at: string;
  controller_name?: string;
  controller_email?: string;
}

interface VerifiableCredential {
  id: string;
  credential_id: string;
  did_id: string;
  issuer_did: string;
  credential_type: string[];
  credential_subject: any;
  credential_status: string;
  expires_at: string;
  issuance_date: string;
  proof: any;
  did?: string;
}

interface ZKProof {
  id: string;
  iot_log_id: string;
  did_id: string;
  credential_id: string;
  proof_a: string[];
  proof_b: string[][];
  proof_c: string[];
  public_inputs: string[];
  did_signature: string;
  verification_method: string;
  is_verified: boolean;
  verified_at: string;
  created_at: string;
  did?: string;
}

interface BlockchainSubmission {
  id: string;
  zk_snark_proof_id: string;
  blockchain: string;
  chain_id: number;
  transaction_hash: string;
  block_number: number;
  contract_address: string;
  status: string;
  submitted_at: string;
  confirmed_at: string;
}

export function DIDVCManagementPanel() {
  const supabase = createClient();
  const [dids, setDIDs] = useState<DIDRegistry[]>([]);
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [proofs, setProofs] = useState<ZKProof[]>([]);
  const [submissions, setSubmissions] = useState<BlockchainSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dids" | "credentials" | "proofs" | "blockchain">(
    "dids",
  );

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "dids") {
        await fetchDIDs();
      } else if (activeTab === "credentials") {
        await fetchCredentials();
      } else if (activeTab === "proofs") {
        await fetchProofs();
      } else if (activeTab === "blockchain") {
        await fetchSubmissions();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchDIDs = async () => {
    const { data, error } = await supabase
      .from("did_registry")
      .select(
        `
        *,
        profiles!inner(full_name, email)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      controller_name: item.profiles?.full_name,
      controller_email: item.profiles?.email,
    }));

    setDIDs(formattedData);
  };

  const fetchCredentials = async () => {
    const { data, error } = await supabase
      .from("verifiable_credentials")
      .select(
        `
        *,
        did_registry!inner(did)
      `,
      )
      .order("issuance_date", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      did: item.did_registry?.did,
    }));

    setCredentials(formattedData);
  };

  const fetchProofs = async () => {
    const { data, error } = await supabase
      .from("zk_snark_proofs")
      .select(
        `
        *,
        did_registry!inner(did)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      did: item.did_registry?.did,
    }));

    setProofs(formattedData);
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("blockchain_submissions")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    setSubmissions(data || []);
  };

  const verifyCredential = async (credentialId: string) => {
    try {
      const response = await fetch(
        `/functions/v1/did-vc-manager?action=verify-credential&credential_id=${credentialId}`,
      );
      const result = await response.json();

      if (result.success && result.verification.valid) {
        toast.success("Credential verified successfully");
      } else {
        toast.error("Credential verification failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to verify credential");
    }
  };

  const verifyProof = async (proofId: string) => {
    try {
      const response = await fetch(
        `/functions/v1/did-vc-manager?action=verify-proof&proof_id=${proofId}`,
      );
      const result = await response.json();

      if (result.success && result.verification.valid) {
        toast.success("Proof verified successfully");
      } else {
        toast.error("Proof verification failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to verify proof");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      valid: "bg-green-100 text-green-800",
      revoked: "bg-red-100 text-red-800",
      suspended: "bg-yellow-100 text-yellow-800",
      expired: "bg-gray-100 text-gray-800",
      true: "bg-green-100 text-green-800",
      false: "bg-red-100 text-red-800",
      pending: "bg-blue-100 text-blue-800",
      submitted: "bg-purple-100 text-purple-800",
      confirmed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      reverted: "bg-orange-100 text-orange-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status] || colors.pending}`}
      >
        {status}
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
          <h2 className="text-2xl font-bold font-display uppercase">DID/VC Management</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            FDA Blockchain Compliance via Zero-Knowledge Proofs and Decentralized Identifiers
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === "dids" ? "default" : "ghost"}
          onClick={() => setActiveTab("dids")}
        >
          <Fingerprint className="w-4 h-4 mr-2" />
          DIDs
        </Button>
        <Button
          variant={activeTab === "credentials" ? "default" : "ghost"}
          onClick={() => setActiveTab("credentials")}
        >
          <Award className="w-4 h-4 mr-2" />
          Credentials
        </Button>
        <Button
          variant={activeTab === "proofs" ? "default" : "ghost"}
          onClick={() => setActiveTab("proofs")}
        >
          <Shield className="w-4 h-4 mr-2" />
          zk-SNARK Proofs
        </Button>
        <Button
          variant={activeTab === "blockchain" ? "default" : "ghost"}
          onClick={() => setActiveTab("blockchain")}
        >
          <Activity className="w-4 h-4 mr-2" />
          Blockchain
        </Button>
      </div>

      {activeTab === "dids" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Decentralized Identifiers</h3>
          {dids.length === 0 ? (
            <p className="text-gray-600 font-mono">No DIDs registered</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dids.map((did) => (
                <div key={did.id} className="p-3 rounded border bg-gray-50 border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-gray-500" />
                      <span className="font-bold font-mono text-sm">{did.did}</span>
                      {getStatusBadge(did.is_active ? "active" : "inactive")}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(did.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1">
                    <p>Method: {did.did_method}</p>
                    <p>
                      Controller: {did.controller_name} ({did.controller_email})
                    </p>
                    <p>Verification Methods: {did.did_document?.verificationMethod?.length || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "credentials" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Verifiable Credentials</h3>
          {credentials.length === 0 ? (
            <p className="text-gray-600 font-mono">No credentials issued</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="p-3 rounded border bg-purple-50 border-purple-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-500" />
                      <span className="font-bold">{credential.credential_type.join(", ")}</span>
                      {getStatusBadge(credential.credential_status)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(credential.issuance_date).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    <p>ID: {credential.credential_id}</p>
                    <p>Issuer: {credential.issuer_did}</p>
                    <p>Subject DID: {credential.did}</p>
                    {credential.expires_at && (
                      <p>Expires: {new Date(credential.expires_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyCredential(credential.id)}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "proofs" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">zk-SNARK Proofs</h3>
          {proofs.length === 0 ? (
            <p className="text-gray-600 font-mono">No zk-SNARK proofs</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {proofs.map((proof) => (
                <div key={proof.id} className="p-3 rounded border bg-green-50 border-green-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      <span className="font-bold">zk-SNARK Proof</span>
                      {getStatusBadge(proof.is_verified ? "verified" : "unverified")}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(proof.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    <p>DID: {proof.did}</p>
                    <p>Verification Method: {proof.verification_method}</p>
                    <p>Public Inputs: {proof.public_inputs.length}</p>
                    {proof.credential_id && (
                      <p>Credential: {proof.credential_id.substring(0, 8)}...</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => verifyProof(proof.id)}>
                      Verify
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "blockchain" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Blockchain Submissions</h3>
          {submissions.length === 0 ? (
            <p className="text-gray-600 font-mono">No blockchain submissions</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {submissions.map((submission) => (
                <div key={submission.id} className="p-3 rounded border bg-blue-50 border-blue-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <span className="font-bold">{submission.blockchain.toUpperCase()}</span>
                      {getStatusBadge(submission.status)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(submission.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1">
                    <p>Chain ID: {submission.chain_id}</p>
                    <p>Contract: {submission.contract_address.substring(0, 10)}...</p>
                    {submission.transaction_hash && (
                      <p>TX: {submission.transaction_hash.substring(0, 10)}...</p>
                    )}
                    {submission.block_number && (
                      <p>Block: {submission.block_number.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
