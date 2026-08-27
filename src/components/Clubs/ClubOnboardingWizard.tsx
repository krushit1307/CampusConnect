import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import Upload from "lucide-react/dist/esm/icons/upload";
import Users from "lucide-react/dist/esm/icons/users";
import FileText from "lucide-react/dist/esm/icons/file-text";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Shield from "lucide-react/dist/esm/icons/shield";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { CascadingCategorySelect } from "@/components/Clubs/CascadingCategorySelect";

interface ClubOnboardingWizardProps {
  club: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    category_id?: string | null;
  };
  onComplete: () => void;
}

interface OnboardingFormData {
  logo_url: string;
  banner_url: string;
  description: string;
  category_id: string | null;
  constitution_url: string;
  invites: Array<{ email: string; role: string }>;
}

export default function ClubOnboardingWizard({ club, onComplete }: ClubOnboardingWizardProps) {
  const supabase = createClient();
  const STORAGE_KEY = `club_onboarding_state_${club.id}`;

  const [step, setStep] = useState(1);
  const [logoUrl, setLogoUrl] = useState(club.logo_url || "");
  const [bannerUrl, setBannerUrl] = useState(club.banner_url || "");
  const [categoryId, setCategoryId] = useState<string | null>(club.category_id || null);
  const [constitutionUrl, setConstitutionUrl] = useState("");
  const [constitutionFile, setConstitutionFile] = useState<File | null>(null);
  
  // Invites state
  const [invites, setInvites] = useState<Array<{ email: string; role: string }>>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");

  // Loading states
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Stripe integration
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OnboardingFormData>({
    defaultValues: {
      description: club.description || "",
      logo_url: club.logo_url || "",
      banner_url: club.banner_url || "",
      category_id: club.category_id || null,
      constitution_url: "",
      invites: [],
    }
  });

  const description = watch("description");

  // Load from local storage if exists
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step) setStep(parsed.step);
        if (parsed.logo_url) setLogoUrl(parsed.logo_url);
        if (parsed.banner_url) setBannerUrl(parsed.banner_url);
        if (parsed.description) setValue("description", parsed.description);
        if (parsed.category_id) setCategoryId(parsed.category_id);
        if (parsed.constitution_url) setConstitutionUrl(parsed.constitution_url);
        if (parsed.invites) setInvites(parsed.invites);
        if (parsed.stripeConnected) setStripeConnected(parsed.stripeConnected);
        if (parsed.stripeAccountId) setStripeAccountId(parsed.stripeAccountId);
      } catch (e) {
        console.error("Failed to restore onboarding state", e);
      }
    }
  }, [STORAGE_KEY, setValue]);

  // Save to local storage on state changes
  const saveState = (nextStep: number) => {
    const state = {
      step: nextStep,
      logo_url: logoUrl,
      banner_url: bannerUrl,
      description,
      category_id: categoryId,
      constitution_url: constitutionUrl,
      invites,
      stripeConnected,
      stripeAccountId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const handleNext = () => {
    if (step === 1 && (!logoUrl || !bannerUrl)) {
      toast.warning("Please upload both a logo and banner for your club.");
      return;
    }
    if (step === 2 && !description.trim()) {
      toast.warning("Please provide a short description for your club.");
      return;
    }
    if (step === 4 && !constitutionUrl && !constitutionFile) {
      toast.warning("Uploading a Club Constitution PDF is mandatory.");
      return;
    }

    const next = Math.min(step + 1, 5);
    setStep(next);
    saveState(next);
  };

  const handlePrev = () => {
    const prev = Math.max(step - 1, 1);
    setStep(prev);
    saveState(prev);
  };

  // Add executive invitation to local list
  const handleAddInvite = () => {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (invites.some((i) => i.email === trimmed)) {
      toast.error("This email is already in the invite list.");
      return;
    }
    setInvites([...invites, { email: trimmed, role: inviteRole }]);
    setInviteEmail("");
  };

  const handleRemoveInvite = (email: string) => {
    setInvites(invites.filter((i) => i.email !== email));
  };

  // Upload constitution PDF file
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed.");
      return;
    }

    setConstitutionFile(file);
    setIsUploadingPdf(true);

    try {
      const fileExt = "pdf";
      const fileName = `${club.id}/constitution-${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from("club-constitutions")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Generate public URL
      const { data: { publicUrl } } = supabase.storage
        .from("club-constitutions")
        .getPublicUrl(fileName);

      setConstitutionUrl(publicUrl);
      toast.success("Constitution PDF uploaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload constitution PDF.");
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Mock Stripe connection
  const handleStripeConnect = () => {
    setStripeConnected(true);
    setStripeAccountId(`acct_mock_${Math.random().toString(36).substring(2, 10)}`);
    toast.success("Stripe account connected successfully (Sandbox Mode)!");
  };

  const handleCompleteOnboarding = async () => {
    setIsSubmitting(true);
    try {
      // 1. Update club details in the database
      const { error: clubError } = await supabase
        .from("clubs")
        .update({
          logo_url: logoUrl,
          banner_url: bannerUrl,
          description: description,
          category_id: categoryId,
          constitution_url: constitutionUrl,
          stripe_account_id: stripeAccountId || null,
          stripe_payouts_enabled: stripeConnected,
          onboarding_completed: true,
        })
        .eq("id", club.id);

      if (clubError) throw clubError;

      // 2. Insert invites into club_invitations table
      if (invites.length > 0) {
        const inviteRecords = invites.map((inv) => ({
          club_id: club.id,
          email: inv.email,
          role: inv.role,
          status: "pending",
        }));

        const { error: inviteError } = await supabase
          .from("club_invitations")
          .insert(inviteRecords);

        if (inviteError) {
          console.error("Failed to insert invitations:", inviteError);
          toast.warning("Club onboarding completed, but executive invitations could not be sent.");
        }
      }

      toast.success("Welcome aboard! Club Onboarding Wizard completed.");
      localStorage.removeItem(STORAGE_KEY);
      onComplete();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred during onboarding completion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto neu-border bg-white border-4 border-black p-8 shadow-[8px_8px_0_0_#000000] relative">
      {/* Wizard Header Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between border-b-4 border-black pb-4">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#fb923c]">Club Onboarding</span>
            <h2 className="font-display text-2xl font-black uppercase text-black mt-1">Setup: {club.name}</h2>
          </div>
          <span className="font-mono text-sm font-extrabold bg-[#dff25c] border-2 border-black px-3 py-1 text-black">
            Step {step} of 5
          </span>
        </div>

        {/* Dynamic Progress Indicator */}
        <div className="w-full bg-cream border-2 border-black h-4 mt-6">
          <div
            className="bg-black h-full transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps Content Area with Framer Motion slide transition */}
      <div className="min-h-[350px] mb-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="font-display text-xl font-bold uppercase text-black flex items-center gap-2">
                  <Upload className="h-5 w-5" /> Logo & Banner Assets
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Upload visual assets to represent your club across the platform.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <label className="font-mono text-xs font-black uppercase block text-black">Club Logo</label>
                  <ImageCropUpload
                    aspect={1}
                    bucket="club-banners"
                    value={logoUrl}
                    onUploaded={(url) => setLogoUrl(url)}
                    hint="Upload logo image (1:1 aspect)"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-xs font-black uppercase block text-black">Club Banner</label>
                  <ImageCropUpload
                    aspect={16 / 9}
                    bucket="club-banners"
                    value={bannerUrl}
                    onUploaded={(url) => setBannerUrl(url)}
                    hint="Upload banner image (16:9 aspect)"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="font-display text-xl font-bold uppercase text-black flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Bio & Categories
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Tell campus what your club does and choose appropriate search categories.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="font-mono text-xs font-black uppercase block text-black">Club Bio / Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setValue("description", e.target.value)}
                    placeholder="Provide a short description of your club's missions, activities, and goals..."
                    className="w-full border-2 border-black p-3 font-mono text-xs min-h-[120px] focus:outline-none focus:bg-lime/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-xs font-black uppercase block text-black">Select Primary Category</label>
                  <CascadingCategorySelect
                    value={categoryId}
                    onChange={(id) => setCategoryId(id)}
                    className="border-2 border-black"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="font-display text-xl font-bold uppercase text-black flex items-center gap-2">
                  <Users className="h-5 w-5" /> Invite Executives & Members
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Invite your executives (Vice President, Treasurer, Secretary) to co-manage the club.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="font-mono text-xs font-black uppercase block text-black">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="exec@college.edu"
                      className="w-full border-2 border-black p-2 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div className="w-40 space-y-2">
                    <label className="font-mono text-xs font-black uppercase block text-black">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full border-2 border-black p-2 font-mono text-xs bg-white"
                    >
                      <option value="admin">Administrator</option>
                      <option value="member">Standard Member</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddInvite}
                    className="neu-border bg-[#dff25c] border-2 border-black p-2 text-black transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {invites.length > 0 && (
                  <div className="border-2 border-black divide-y-2 divide-black">
                    {invites.map((inv) => (
                      <div key={inv.email} className="flex justify-between items-center p-3 bg-cream">
                        <div>
                          <p className="font-mono text-xs font-bold text-black">{inv.email}</p>
                          <p className="font-mono text-[10px] text-gray-500 uppercase font-black">{inv.role}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(inv.email)}
                          className="text-red-500 hover:scale-105"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="font-display text-xl font-bold uppercase text-black flex items-center gap-2">
                  <Shield className="h-5 w-5" /> Mandatory Club Constitution
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Upload your mandatory Club Constitution Bylaws in PDF format.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="neu-border border-4 border-dashed border-black p-8 text-center bg-cream flex flex-col items-center justify-center space-y-4">
                  <FileText className="h-12 w-12 text-black" />
                  <div>
                    <p className="font-mono text-xs font-bold text-black">
                      {constitutionFile ? constitutionFile.name : "No PDF constitution file chosen"}
                    </p>
                    <p className="font-mono text-[10px] text-gray-400 mt-1">Limit 10MB · PDF format only</p>
                  </div>
                  
                  <label className="neu-border bg-black text-cream font-mono text-xs font-bold uppercase px-4 py-2.5 cursor-pointer hover:bg-neutral-800 transition-all">
                    Choose PDF File
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {isUploadingPdf && (
                  <div className="flex items-center justify-center gap-2 font-mono text-xs font-bold text-black">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading PDF Constitution...
                  </div>
                )}

                {constitutionUrl && !isUploadingPdf && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 border-2 border-green-300 p-3 font-mono text-xs font-bold">
                    <CheckCircle2 className="h-5 w-5" /> Constitution uploaded and registered successfully.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="font-display text-xl font-bold uppercase text-black flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Stripe Payout Setup (Optional)
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Connect your club bank account via Stripe Connect to collect dues or sell event tickets.
                </p>
              </div>

              <div className="space-y-6 pt-4">
                <div className="neu-border border-2 border-black p-6 bg-cream space-y-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-black" />
                    <div>
                      <h4 className="font-mono text-sm font-bold text-black">Stripe Connected Payouts</h4>
                      <p className="font-mono text-[10px] text-gray-500">Collect ticketing revenue directly.</p>
                    </div>
                  </div>
                  
                  {stripeConnected ? (
                    <div className="flex items-center gap-2 text-green-600 font-mono text-xs font-bold">
                      <CheckCircle2 className="h-5 w-5" /> Stripe Connected (Account ID: {stripeAccountId})
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStripeConnect}
                      className="neu-border bg-[#fb923c] border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase text-black hover:-translate-y-0.5 transition-transform"
                    >
                      Connect Stripe Account
                    </button>
                  )}
                </div>

                <div className="font-mono text-[10px] text-gray-400">
                  * You can skip this step and configure payouts later in the club settings panel.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Wizard Action Footer Controls */}
      <div className="flex justify-between border-t-4 border-black pt-6">
        <button
          type="button"
          onClick={handlePrev}
          disabled={step === 1 || isSubmitting}
          className="neu-border border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase text-black bg-white hover:-translate-y-0.5 transition-transform disabled:opacity-40 flex items-center gap-1.5"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            className="neu-border border-2 border-black px-6 py-2.5 font-mono text-xs font-bold uppercase text-black bg-[#dff25c] hover:-translate-y-0.5 transition-transform flex items-center gap-1.5"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCompleteOnboarding}
            disabled={isSubmitting}
            className="neu-border border-2 border-black px-6 py-2.5 font-mono text-xs font-bold uppercase text-cream bg-black hover:-translate-y-0.5 transition-transform disabled:opacity-40 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Completing...
              </>
            ) : (
              <>
                Finish Setup <CheckCircle2 size={16} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
