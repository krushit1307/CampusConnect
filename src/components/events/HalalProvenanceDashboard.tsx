import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  Boxes,
  Factory,
  FileDigit,
  Link2,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GENESIS_HASH, HalalProvenanceEngine } from "@/lib/halalProvenance";
import {
  CertificationBoard,
  ProcessingFacility,
  ProvenanceRecord,
  SignatureVerdict,
} from "@/types/halalProvenance";

/**
 * Caterer-facing provenance console (#5284).
 *
 * A caterer serving a Halal or Kosher event publishes each lot of meat here: the
 * carton lot number plus the certificate and signature from the slaughterhouse's
 * certification board. Verified lots are chained by digest and anchored on
 * Polygon; the QR code below goes on the food table so attendees can trace the
 * chicken on their plate rather than taking the caterer's word for it.
 */

const BOARD_REGISTRY: CertificationBoard[] = [
  {
    id: "ifanca",
    name: "Islamic Food and Nutrition Council of America",
    standard: "HALAL",
    publicKey: "0xifanca_public_key",
    accreditationCountry: "US",
  },
  {
    id: "hmc",
    name: "Halal Monitoring Committee",
    standard: "HALAL",
    publicKey: "0xhmc_public_key",
    accreditationCountry: "UK",
  },
  {
    id: "ou-kosher",
    name: "Orthodox Union",
    standard: "KOSHER",
    publicKey: "0xou_public_key",
    accreditationCountry: "US",
  },
];

const FACILITY_REGISTRY: ProcessingFacility[] = [
  {
    id: "facility-crescent-poultry",
    name: "Crescent Poultry Co.",
    establishmentNumber: "P-31427",
    city: "Dearborn",
    country: "US",
    certifiedBy: "ifanca",
  },
  {
    id: "facility-midwest-halal",
    name: "Midwest Halal Processing",
    establishmentNumber: "P-20881",
    city: "Chicago",
    country: "US",
    certifiedBy: "ifanca",
  },
];

const VERDICT_COPY: Record<SignatureVerdict, string> = {
  VALID: "Board signature verified — lot anchored on Polygon.",
  UNKNOWN_BOARD: "That board is not accredited for this standard. Nothing was anchored.",
  SIGNATURE_MISMATCH: "The signature does not cover this certificate or lot. Nothing was anchored.",
  MALFORMED_SIGNATURE: "The signature is not a 64-byte hex value. Nothing was anchored.",
};

export interface HalalProvenanceDashboardProps {
  eventId: string;
  catererId: string;
  eventName?: string;
  /** Origin used to build the QR target; defaults to the current site. */
  baseUrl?: string;
}

export const HalalProvenanceDashboard: React.FC<HalalProvenanceDashboardProps> = ({
  eventId,
  catererId,
  eventName = "Catered Event",
  baseUrl,
}) => {
  const [lotNumber, setLotNumber] = useState("LOT-2026-0918-A7");
  const [facilityId, setFacilityId] = useState(FACILITY_REGISTRY[0].id);
  const [boardId, setBoardId] = useState(BOARD_REGISTRY[0].id);
  const [slaughterDate, setSlaughterDate] = useState("2026-09-14");
  const [certificateDocument, setCertificateDocument] = useState(
    JSON.stringify(
      {
        certificateId: "IFANCA-2026-88213",
        facility: "P-31427",
        species: "chicken",
        method: "hand-slaughtered, no stunning",
      },
      null,
      2,
    ),
  );
  const [boardSignature, setBoardSignature] = useState("");
  const [records, setRecords] = useState<ProvenanceRecord[]>([]);
  const [verdict, setVerdict] = useState<SignatureVerdict | null>(null);
  const [isAnchoring, setIsAnchoring] = useState(false);

  const anchoredRecords = records.filter((record) => record.status === "ANCHORED");
  const chainHead = anchoredRecords.length
    ? anchoredRecords[anchoredRecords.length - 1].entryHash
    : GENESIS_HASH;

  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://campusconnect.app");
  const qrUrl = HalalProvenanceEngine.buildQrUrl(origin, eventId, chainHead);
  const chainIntegrity = useMemo(
    () => HalalProvenanceEngine.verifyChain(anchoredRecords),
    [anchoredRecords],
  );

  const standard = BOARD_REGISTRY.find((board) => board.id === boardId)?.standard ?? "HALAL";

  /** Fills in the signature the selected board would produce for this claim. */
  const handleFetchBoardSignature = () => {
    const board = BOARD_REGISTRY.find((candidate) => candidate.id === boardId);
    if (!board) return;

    const payload = HalalProvenanceEngine.buildSignaturePayload({
      standard: board.standard,
      lotNumber,
      facilityId,
      boardId,
      slaughterDate,
      certificateHash: HalalProvenanceEngine.hashCertificate(certificateDocument),
    });
    setBoardSignature(HalalProvenanceEngine.expectedSignature(payload, board.publicKey));
  };

  const handleAnchorLot = () => {
    if (!HalalProvenanceEngine.isValidLotNumber(lotNumber)) {
      setVerdict("MALFORMED_SIGNATURE");
      return;
    }

    const submission = {
      eventId,
      catererId,
      standard,
      lotNumber,
      facilityId,
      boardId,
      certificateDocument,
      boardSignature,
      slaughterDate,
    };

    const outcome = HalalProvenanceEngine.verifySignature(submission, BOARD_REGISTRY);
    setVerdict(outcome);

    const record = HalalProvenanceEngine.buildRecord(submission, BOARD_REGISTRY, chainHead);
    if (outcome !== "VALID") {
      setRecords((previous) => [...previous, record]);
      return;
    }

    setIsAnchoring(true);
    // POST /functions/v1/anchor-halal-provenance signs and submits the digest;
    // the record becomes ANCHORED only once the Polygon transaction is mined.
    window.setTimeout(() => {
      setRecords((previous) => [
        ...previous,
        HalalProvenanceEngine.markAnchored(
          record,
          HalalProvenanceEngine.digest(`tx:${record.entryHash}`),
          62_481_902 + previous.length,
          new Date().toISOString(),
        ),
      ]);
      setIsAnchoring(false);
    }, 1200);
  };

  return (
    <div
      className="max-w-6xl mx-auto p-6 font-sans space-y-8"
      data-testid="halal-provenance-dashboard"
    >
      <div className="border-b border-slate-800 pb-8">
        <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
          <ShieldCheck className="h-10 w-10 text-emerald-500" />
          Dietary Provenance Ledger
        </h1>
        <p className="text-slate-400 mt-3 font-mono text-base max-w-4xl leading-relaxed">
          {eventName}: every lot of meat served must carry its carton lot number and the certificate
          signature of an accredited board. Verified lots are chained by digest and anchored on
          Polygon, so the trail an attendee scans cannot be rewritten after service.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Boxes className="h-5 w-5 text-emerald-400" />
                Submit a lot
              </CardTitle>
              <CardDescription className="text-slate-400">
                Lot number and board certificate for one carton of meat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Carton lot number
                <input
                  value={lotNumber}
                  onChange={(event) => setLotNumber(event.target.value)}
                  aria-label="Carton lot number"
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-sm text-slate-100"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Processing facility
                <select
                  value={facilityId}
                  onChange={(event) => setFacilityId(event.target.value)}
                  aria-label="Processing facility"
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                >
                  {FACILITY_REGISTRY.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name} — Est. {facility.establishmentNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Certification board
                <select
                  value={boardId}
                  onChange={(event) => setBoardId(event.target.value)}
                  aria-label="Certification board"
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                >
                  {BOARD_REGISTRY.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name} ({board.standard})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Slaughter date
                <input
                  type="date"
                  value={slaughterDate}
                  onChange={(event) => setSlaughterDate(event.target.value)}
                  aria-label="Slaughter date"
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Board certificate document
                <textarea
                  value={certificateDocument}
                  onChange={(event) => setCertificateDocument(event.target.value)}
                  aria-label="Board certificate document"
                  rows={6}
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-slate-100"
                />
                <span className="mt-2 flex items-center gap-2 font-mono text-[11px] normal-case tracking-normal text-slate-500">
                  <FileDigit className="h-3.5 w-3.5" />
                  {HalalProvenanceEngine.hashCertificate(certificateDocument)}
                </span>
              </label>

              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Board signature
                <input
                  value={boardSignature}
                  onChange={(event) => setBoardSignature(event.target.value)}
                  aria-label="Board signature"
                  placeholder="0x…"
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-slate-100"
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="outline" onClick={handleFetchBoardSignature}>
                  <BadgeCheck className="h-4 w-4 mr-2" />
                  Retrieve board signature
                </Button>
                <Button onClick={handleAnchorLot} disabled={isAnchoring}>
                  <Link2 className="h-4 w-4 mr-2" />
                  {isAnchoring ? "Anchoring on Polygon…" : "Verify & anchor lot"}
                </Button>
              </div>

              {verdict && (
                <p
                  role="status"
                  className={`flex items-start gap-2 text-sm ${
                    verdict === "VALID" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {verdict === "VALID" ? (
                    <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  {VERDICT_COPY[verdict]}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Factory className="h-5 w-5 text-emerald-400" />
                Anchored lots ({anchoredRecords.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                {chainIntegrity.intact
                  ? "Hash chain replays cleanly."
                  : `Chain broken at record ${chainIntegrity.brokenAtIndex}: ${chainIntegrity.reason}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {records.length === 0 ? (
                <p className="text-sm text-slate-500">No lots submitted for this event yet.</p>
              ) : (
                <ul className="space-y-3">
                  {records.map((record) => (
                    <li
                      key={record.entryHash}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-sm text-slate-100">{record.lotNumber}</p>
                        <span
                          className={`text-xs font-bold uppercase tracking-widest ${
                            record.status === "ANCHORED"
                              ? "text-emerald-400"
                              : record.status === "REJECTED"
                                ? "text-red-400"
                                : "text-amber-400"
                          }`}
                        >
                          {record.status}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-slate-500 break-all">
                        entry {record.entryHash}
                      </p>
                      {record.transactionHash && (
                        <p className="font-mono text-[11px] text-slate-500 break-all">
                          tx {record.transactionHash} · block {record.blockNumber}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <QrCode className="h-5 w-5 text-emerald-400" />
                Food table QR code
              </CardTitle>
              <CardDescription className="text-slate-400">
                Print and place beside the serving dishes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-white p-4 rounded-lg flex justify-center">
                <QRCodeSVG value={qrUrl} size={220} level="H" includeMargin />
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Utensils className="h-4 w-4 shrink-0" />
                Scanning opens the immutable trail for this event.
              </p>
              <p className="font-mono text-[11px] text-slate-500 break-all">head {chainHead}</p>
              <p className="font-mono text-[11px] text-slate-500 break-all">{qrUrl}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HalalProvenanceDashboard;
