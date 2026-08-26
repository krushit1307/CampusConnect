import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import SignatureCanvas from "react-signature-canvas";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Upload from "lucide-react/dist/esm/icons/upload";
import { createBrowserClient } from "@supabase/ssr";

interface RenewalFormData {
  executives: string;
  budgetFile: FileList;
}

export default function ClubRenewalWizard({ clubId }: { clubId: string }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sigCanvas = useRef<SignatureCanvas>(null);

  // Initialize Supabase client
  const supabase = createBrowserClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RenewalFormData>();

  const handleNext = () => setStep((prev) => Math.min(prev + 1, 3));
  const handlePrev = () => setStep((prev) => Math.max(prev - 1, 1));

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const onSubmit = async (data: RenewalFormData) => {
    if (step !== 3) {
      handleNext();
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      setError("Please sign the legal waiver before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Get Signature as Base64 Image
      const signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");

      // 2. Upload Budget File to Supabase Storage
      const budgetFile = data.budgetFile[0];
      const filePath = `budgets/${clubId}/${new Date().getTime()}-${budgetFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("club-budgets")
        .upload(filePath, budgetFile);

      if (uploadError) throw uploadError;

      // 3. Update the database to 'in_review' status
      const { error: dbError } = await supabase
        .from("clubs")
        .update({ status: "in_review" })
        .eq("id", clubId);

      if (dbError) throw dbError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-xl border border-green-200">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-green-800">Renewal Submitted!</h2>
        <p className="text-green-600 mt-2 text-center">
          Your club's renewal is now in review by the Student Union.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Yearly Club Renewal</h2>
        <div className="flex items-center mt-4 text-sm font-medium text-gray-500">
          <span className={step >= 1 ? "text-blue-600" : ""}>1. Executives</span>
          <ChevronRight className="w-4 h-4 mx-2" />
          <span className={step >= 2 ? "text-blue-600" : ""}>2. Waiver</span>
          <ChevronRight className="w-4 h-4 mx-2" />
          <span className={step >= 3 ? "text-blue-600" : ""}>3. Budget</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Verify Executive Roster</h3>
            <textarea
              {...register("executives", { required: "Executive list is required" })}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="President: John Doe&#10;Treasurer: Jane Smith"
            />
            {errors.executives && (
              <span className="text-red-500 text-sm">{errors.executives.message}</span>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Legal Waiver & Signature</h3>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              <p>
                By signing this document, I acknowledge that our club will abide by all university
                regulations.
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg relative">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{ className: "w-full h-48 rounded-lg cursor-crosshair" }}
              />
              <button
                type="button"
                onClick={clearSignature}
                className="absolute top-2 right-2 text-xs bg-gray-200 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Proposed Budget Upload</h3>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50">
              <Upload className="w-8 h-8 mb-3 text-gray-400" />
              <span className="text-sm text-gray-500">Click to upload budget file</span>
              <input
                type="file"
                className="hidden"
                {...register("budgetFile", { required: "Budget file is required" })}
              />
            </label>
            {errors.budgetFile && (
              <span className="text-red-500 text-sm">{errors.budgetFile.message}</span>
            )}
          </div>
        )}

        <div className="flex justify-between pt-6 mt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 1 || isSubmitting}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : step === 3 ? "Submit Renewal" : "Next Step"}
          </button>
        </div>
      </form>
    </div>
  );
}
