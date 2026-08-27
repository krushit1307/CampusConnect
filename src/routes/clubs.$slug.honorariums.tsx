import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, FileWarning, Receipt, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { HonorariumLedgerTable } from "@/components/finance/HonorariumLedgerTable";
import { honorariumService, type ClubLedger, type LedgerRow } from "@/services/honorariumService";
import {
  REPORTING_THRESHOLD_CENTS,
  formatCents,
  type ResidencyStatus,
  type TaxFormType,
} from "@/lib/honorariumCompliance";

const RESIDENCY_OPTIONS: Array<{ value: ResidencyStatus; label: string }> = [
  { value: "domestic", label: "Domestic (W-9)" },
  { value: "foreign_treaty", label: "Foreign, treaty claim (W-8BEN)" },
  { value: "foreign_non_treaty", label: "Foreign, no treaty (W-8BEN)" },
];

const FORM_OPTIONS: Array<{ value: TaxFormType; label: string }> = [
  { value: "none", label: "Nothing on file" },
  { value: "w9", label: "W-9 received" },
  { value: "w8ben", label: "W-8BEN received" },
];

/**
 * Treasurer view of every honorarium the club has committed to, with the tax
 * position of each speaker alongside it.
 */
export default function ClubHonorariumsRoute() {
  const { slug = "" } = useParams();
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string>("");
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [ledger, setLedger] = useState<ClubLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  // New payee form
  const [fullName, setFullName] = useState("");
  const [residency, setResidency] = useState<ResidencyStatus>("domestic");
  const [formType, setFormType] = useState<TaxFormType>("none");
  const [formSignedOn, setFormSignedOn] = useState("");
  const [treatyRate, setTreatyRate] = useState("");

  // New payment form
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [engagementDate, setEngagementDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadClub = async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("slug", slug)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      setClubId(data.id);
      setClubName(data.name);
    };

    loadClub();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    const loadLedger = async () => {
      setLoading(true);
      try {
        const result = await honorariumService.getClubLedger(clubId, taxYear);
        if (!cancelled) setLedger(result);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load the ledger");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLedger();
    return () => {
      cancelled = true;
    };
  }, [clubId, taxYear]);

  const payeeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of ledger?.rows ?? []) {
      seen.set(row.payee.id, row.payee.fullName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [ledger]);

  const refresh = async () => {
    if (!clubId) return;
    setLedger(await honorariumService.getClubLedger(clubId, taxYear));
  };

  const handleCreatePayee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      toast.error("The speaker needs a name.");
      return;
    }
    if (formType !== "none" && !formSignedOn) {
      toast.error("Record the date the form was signed.");
      return;
    }

    try {
      const id = await honorariumService.createPayee({
        fullName: fullName.trim(),
        residency,
        formType,
        formSignedOn: formType === "none" ? null : formSignedOn,
        treatyRatePercent: treatyRate ? Number(treatyRate) : undefined,
      });
      setPayeeId(id);
      setFullName("");
      setFormSignedOn("");
      setTreatyRate("");
      toast.success("Speaker registered. They can now be paid.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register the speaker");
    }
  };

  const handleCreatePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clubId || !payeeId) {
      toast.error("Pick a speaker first.");
      return;
    }

    const grossCents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(grossCents) || grossCents <= 0) {
      toast.error("Enter an honorarium amount.");
      return;
    }
    if (!engagementDate) {
      toast.error("Enter the engagement date.");
      return;
    }

    try {
      await honorariumService.createPayment({ payeeId, clubId, grossCents, engagementDate });
      setAmount("");
      setEngagementDate("");
      await refresh();
      toast.success("Honorarium recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the honorarium");
    }
  };

  const handleRelease = async (row: LedgerRow) => {
    setBusyPaymentId(row.payment.id);
    try {
      await honorariumService.releasePayment(row.payment, row.payee);
      await refresh();
      toast.success(`Released ${formatCents(row.evaluation.netCents)} to ${row.payee.fullName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not release the payment");
    } finally {
      setBusyPaymentId(null);
    }
  };

  const handleCancel = async (row: LedgerRow) => {
    setBusyPaymentId(row.payment.id);
    try {
      await honorariumService.cancelPayment(row.payment.id);
      await refresh();
      toast.success("Honorarium cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel the honorarium");
    } finally {
      setBusyPaymentId(null);
    }
  };

  const pack = ledger?.pack;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        to={`/clubs/${slug}/manage`}
        className="mb-4 inline-flex items-center gap-1 font-mono text-xs uppercase text-gray-600 hover:text-black"
      >
        <ChevronLeft className="h-4 w-4" /> Back to club management
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Receipt className="h-6 w-6" /> Speaker honorariums
          </h1>
          <p className="font-mono text-sm text-gray-600">
            {clubName || "Club"} — tax year {taxYear}
          </p>
        </div>
        <label className="font-mono text-xs uppercase">
          Tax year
          <select
            value={taxYear}
            onChange={(event) => setTaxYear(Number(event.target.value))}
            className="neu-border ml-2 bg-white px-3 py-2"
          >
            {[0, 1, 2].map((offset) => {
              const year = new Date().getFullYear() - offset;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </label>
      </header>

      {pack && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Gross committed" value={formatCents(pack.totalGrossCents)} />
          <SummaryCard label="Withheld" value={formatCents(pack.totalWithheldCents)} />
          <SummaryCard
            label="Awaiting paperwork"
            value={`${pack.payeesMissingForms.length}`}
            tone={pack.payeesMissingForms.length > 0 ? "warn" : "plain"}
            icon={<FileWarning className="h-4 w-4" />}
          />
          <SummaryCard
            label={`Over ${formatCents(REPORTING_THRESHOLD_CENTS)}`}
            value={`${pack.payeesOverThreshold.length}`}
            tone={pack.payeesOverThreshold.length > 0 ? "warn" : "plain"}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        </section>
      )}

      <section className="neu-border mb-6 bg-white p-4 sm:p-6">
        <h2 className="mb-4 border-b-2 border-black pb-2 text-lg font-bold">Ledger</h2>
        {loading ? (
          <div className="h-32 animate-pulse bg-gray-100" />
        ) : (
          <HonorariumLedgerTable
            rows={ledger?.rows ?? []}
            busyPaymentId={busyPaymentId}
            onRelease={handleRelease}
            onCancel={handleCancel}
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleCreatePayee} className="neu-border bg-white p-4 sm:p-6">
          <h2 className="mb-4 border-b-2 border-black pb-2 text-lg font-bold">
            Register a speaker
          </h2>
          <div className="space-y-3 font-mono text-xs">
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="neu-border w-full px-3 py-2"
                placeholder="Dr Ada Okafor"
              />
            </Field>
            <Field label="Residency">
              <select
                value={residency}
                onChange={(event) => setResidency(event.target.value as ResidencyStatus)}
                className="neu-border w-full bg-white px-3 py-2"
              >
                {RESIDENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tax form">
              <select
                value={formType}
                onChange={(event) => setFormType(event.target.value as TaxFormType)}
                className="neu-border w-full bg-white px-3 py-2"
              >
                {FORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {formType !== "none" && (
              <Field label="Form signed on">
                <input
                  type="date"
                  value={formSignedOn}
                  onChange={(event) => setFormSignedOn(event.target.value)}
                  className="neu-border w-full px-3 py-2"
                />
              </Field>
            )}
            {residency === "foreign_treaty" && (
              <Field label="Treaty rate (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={treatyRate}
                  onChange={(event) => setTreatyRate(event.target.value)}
                  className="neu-border w-full px-3 py-2"
                  placeholder="15"
                />
              </Field>
            )}
            <button
              type="submit"
              className="neu-border bg-lime px-4 py-2 font-bold uppercase hover:bg-peach"
            >
              Register speaker
            </button>
          </div>
        </form>

        <form onSubmit={handleCreatePayment} className="neu-border bg-white p-4 sm:p-6">
          <h2 className="mb-4 border-b-2 border-black pb-2 text-lg font-bold">
            Record an honorarium
          </h2>
          <div className="space-y-3 font-mono text-xs">
            <Field label="Speaker">
              <select
                value={payeeId}
                onChange={(event) => setPayeeId(event.target.value)}
                className="neu-border w-full bg-white px-3 py-2"
              >
                <option value="">Select a registered speaker…</option>
                {payeeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gross amount (USD)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="neu-border w-full px-3 py-2"
                placeholder="250.00"
              />
            </Field>
            <Field label="Engagement date">
              <input
                type="date"
                value={engagementDate}
                onChange={(event) => setEngagementDate(event.target.value)}
                className="neu-border w-full px-3 py-2"
              />
            </Field>
            <button
              type="submit"
              className="neu-border bg-lime px-4 py-2 font-bold uppercase hover:bg-peach"
            >
              Record honorarium
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "plain",
  icon,
}: {
  label: string;
  value: string;
  tone?: "plain" | "warn";
  icon?: React.ReactNode;
}) {
  return (
    <div className={`neu-border p-4 ${tone === "warn" ? "bg-peach/40" : "bg-white"}`}>
      <p className="flex items-center gap-1 font-mono text-[11px] uppercase text-gray-600">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block uppercase text-gray-600">{label}</span>
      {children}
    </label>
  );
}
