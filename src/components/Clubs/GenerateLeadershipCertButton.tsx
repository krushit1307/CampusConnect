import { useState } from "react";
import Award from "lucide-react/dist/esm/icons/award";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import X from "lucide-react/dist/esm/icons/x";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { downloadCertificatePdf } from "@/lib/certificateUtils";
import { useConfetti } from "@/hooks/useConfetti";
import { toast } from "sonner";

interface GenerateLeadershipCertButtonProps {
  memberId: string;
  userId: string;
  clubId: string;
  memberName: string;
  roleTitle?: string;
  joinedAt?: string | null;
  createdAt?: string;
  removedAt?: string | null;
  terminationReason?: string | null;
  buttonVariant?: "default" | "outline" | "compact";
}

interface EligibilityResult {
  eligible: boolean;
  reason: string;
  user_id?: string;
  club_id?: string;
  role_title?: string;
  tenure_start?: string;
  tenure_end?: string;
  tenure_days?: number;
  termination_reason?: string | null;
}

interface IssuedCertificateData {
  id: string;
  certificateUrl: string;
  verifyUrl: string;
  verificationHash: string;
  roleTitle: string;
  tenureDays: number;
}

export function GenerateLeadershipCertButton({
  memberId,
  userId,
  clubId,
  memberName,
  roleTitle,
  terminationReason,
  buttonVariant = "default",
}: GenerateLeadershipCertButtonProps) {
  const supabase = createClient();
  const { fireCannon } = useConfetti();

  const [isLoading, setIsLoading] = useState(false);
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null);
  const [isIneligibleDialogOpen, setIsIneligibleDialogOpen] = useState(false);
  const [issuedCert, setIssuedCert] = useState<IssuedCertificateData | null>(null);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);

  const isImpeached = Boolean(terminationReason && terminationReason.toLowerCase() === "impeached");

  const handleGenerateCertificate = async () => {
    setIsLoading(true);
    setIneligibleReason(null);

    try {
      // 1. Query backend as final authority for eligibility
      const { data: eligibilityData, error: eligibilityError } = await supabase.rpc(
        "check_leadership_certificate_eligibility",
        { p_member_id: memberId },
      );

      if (eligibilityError) {
        throw new Error(eligibilityError.message);
      }

      const result = eligibilityData as unknown as EligibilityResult;

      if (!result || !result.eligible) {
        const reasonMsg = result?.reason || "User does not meet the 90-day minimum tenure requirement or eligibility criteria.";
        setIneligibleReason(reasonMsg);
        setIsIneligibleDialogOpen(true);
        toast.error(reasonMsg);
        setIsLoading(false);
        return;
      }

      // 2. Invoke leadership certificate issuance via Supabase RPC or Edge Function
      const { data: certId, error: issueError } = await supabase.rpc(
        "generate_leadership_certificate",
        { p_user_id: userId, p_club_id: clubId },
      );

      if (issueError) {
        throw new Error(issueError.message);
      }

      // 3. Fetch generated certificate record metadata
      const { data: certRow, error: fetchCertError } = await supabase
        .from("certificates")
        .select("id, certificate_url, verify_url, verification_hash, role_title, tenure_start, tenure_end")
        .eq("id", certId)
        .single();

      if (fetchCertError || !certRow) {
        throw new Error("Certificate issued, but metadata could not be fetched.");
      }

      const hashParam = certRow.verification_hash || certRow.id;
      const verifyUrl = certRow.verify_url || `${window.location.origin}/verify-leadership?hash=${encodeURIComponent(hashParam)}`;
      const certData: IssuedCertificateData = {
        id: certRow.id,
        certificateUrl: certRow.certificate_url,
        verifyUrl,
        verificationHash: certRow.verification_hash || certRow.id,
        roleTitle: certRow.role_title || roleTitle || "Leader",
        tenureDays: result.tenure_days || 90,
      };

      setIssuedCert(certData);
      setIsSuccessDialogOpen(true);
      fireCannon();
      toast.success("Leadership Certificate generated successfully! 🎓");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to generate leadership certificate";
      setIneligibleReason(errMsg);
      setIsIneligibleDialogOpen(true);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Validating...</span>
        </>
      );
    }
    return (
      <>
        <Award className="h-4 w-4 text-amber-600" />
        <span>Generate Leadership Cert</span>
      </>
    );
  };

  return (
    <>
      {buttonVariant === "compact" ? (
        <button
          onClick={handleGenerateCertificate}
          disabled={isLoading || isImpeached}
          title={isImpeached ? "Ineligible: Member was impeached" : "Generate Certificate of Leadership"}
          className="neu-border bg-amber-200 px-2.5 py-1 font-mono text-xs font-bold uppercase transition-all hover:bg-amber-300 disabled:opacity-50 flex items-center gap-1.5"
        >
          {renderButtonContent()}
        </button>
      ) : buttonVariant === "outline" ? (
        <button
          onClick={handleGenerateCertificate}
          disabled={isLoading || isImpeached}
          className="neu-border bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all hover:bg-amber-100 disabled:opacity-50 flex items-center gap-2"
        >
          {renderButtonContent()}
        </button>
      ) : (
        <button
          onClick={handleGenerateCertificate}
          disabled={isLoading || isImpeached}
          className="neu-border neu-press bg-amber-300 px-4 py-2 font-mono text-xs font-bold uppercase transition-all hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2"
        >
          {renderButtonContent()}
        </button>
      )}

      {/* Ineligible Explanation Modal */}
      <Dialog open={isIneligibleDialogOpen} onOpenChange={setIsIneligibleDialogOpen}>
        <DialogContent className="neu-border max-w-md bg-peach p-6">
          <div className="flex items-start gap-3">
            <div className="neu-border bg-red-100 p-2 text-red-600 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-black mb-1">
                Certificate Ineligible
              </DialogTitle>
              <p className="font-mono text-xs text-gray-800 leading-relaxed mt-2">
                {ineligibleReason || "This user does not meet the minimum requirements for a Certificate of Leadership."}
              </p>
              <div className="mt-4 neu-border bg-white p-3 font-mono text-xs text-gray-700 space-y-1.5">
                <p className="font-bold text-black">Requirements for Leadership Certificates:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Minimum 90 days of completed leadership tenure</li>
                  <li>Official officer or leadership role designation</li>
                  <li>No termination due to impeachment</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setIsIneligibleDialogOpen(false)}
              className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal - Reusing Certificate UI Patterns from Issue #2910 */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="neu-border max-w-lg bg-amber-50 p-6 md:p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto neu-border bg-amber-300 w-12 h-12 flex items-center justify-center">
              <Award className="h-7 w-7 text-black" />
            </div>

            <div>
              <span className="eyebrow font-bold text-xs uppercase bg-black text-amber-300 px-2 py-0.5 neu-border">
                Leadership Certificate Verified
              </span>
              <DialogTitle className="font-display text-2xl font-bold text-black mt-2">
                Certificate of Leadership
              </DialogTitle>
              <p className="font-mono text-xs text-gray-700 mt-1">
                Issued to <span className="font-bold text-black">{memberName}</span> for serving as{" "}
                <span className="font-bold text-black">{issuedCert?.roleTitle}</span> ({issuedCert?.tenureDays} Days Tenure).
              </p>
            </div>

            {/* QR Code Container */}
            {issuedCert?.verifyUrl && (
              <div className="neu-border bg-white p-4 inline-block mx-auto shadow-sm">
                <QRCodeSVG
                  value={issuedCert.verifyUrl}
                  size={140}
                  level="M"
                  includeMargin={true}
                />
                <p className="font-mono text-[10px] text-gray-500 mt-2 flex items-center justify-center gap-1">
                  <QrCode className="h-3 w-3" /> Scan to verify authenticity
                </p>
              </div>
            )}

            {/* Certificate Hash & Link */}
            {issuedCert?.verificationHash && (
              <div className="neu-border bg-white p-3 font-mono text-[11px] text-gray-700 text-left space-y-1">
                <p className="font-bold text-black">Verification Hash:</p>
                <p className="break-all text-xs font-bold text-amber-700">{issuedCert.verificationHash}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() =>
                  downloadCertificatePdf({
                    certId: issuedCert!.id,
                    certificateUrl: issuedCert!.certificateUrl,
                    studentName: memberName,
                    eventTitle: `Certificate of Leadership - ${issuedCert?.roleTitle}`,
                  })
                }
                className="neu-border neu-press flex-1 bg-lime p-3 font-mono text-xs font-bold uppercase flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <a
                href={issuedCert?.verifyUrl}
                target="_blank"
                rel="noreferrer"
                className="neu-border flex-1 bg-sky p-3 font-mono text-xs font-bold uppercase flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Verification Page
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
