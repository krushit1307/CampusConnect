import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// 1. Define the mandatory inputs using Zod for strict validation
const handoverSchema = z.object({
  driveLink: z.string().url("Please enter a valid Google Drive URL."),
  cashBoxLocation: z.string().min(1, "Physical cash box location is required."),
  stripeConfirmed: z
    .boolean()
    .refine((val) => val === true, "You must confirm the Stripe handover to proceed."),
});

type HandoverFormValues = z.infer<typeof handoverSchema>;

export const HandoverChecklist = ({ clubId }: { clubId: string }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  // 2. Initialize the form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<HandoverFormValues>({
    resolver: zodResolver(handoverSchema),
  });

  // 3. Handle the submission to Supabase
  const onSubmit = async (data: HandoverFormValues) => {
    setIsSubmitting(true);
    try {
      // Get the currently logged-in user (the Outgoing President)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Insert the checklist into the database
      const { error } = await supabase.from("handover_tasks").insert({
        club_id: clubId,
        completed_by: userData.user.id,
        drive_link: data.driveLink,
        cash_box_location: data.cashBoxLocation,
        stripe_confirmed: data.stripeConfirmed,
        status: "pending", // Defaults to pending until the new President approves it
      });

      if (error) throw error;

      toast.success("Handover Protocol submitted for review!");
      reset(); // Clear the form on success
    } catch (error: any) {
      toast.error(error.message || "Failed to submit handover protocol.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-semibold mb-2">Executive Transition Handover</h2>
      <p className="text-sm text-gray-500 mb-6">
        Complete this checklist to transfer your Admin role to the incoming President.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Drive Link Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Link to Club Google Drive <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            {...register("driveLink")}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            placeholder="https://drive.google.com/drive/folders/..."
          />
          {errors.driveLink && (
            <span className="text-red-500 text-xs mt-1">{errors.driveLink.message}</span>
          )}
        </div>

        {/* Cash Box Location Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Location of Physical Cash Box <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register("cashBoxLocation")}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            placeholder="e.g., Bottom drawer of the Student Union desk"
          />
          {errors.cashBoxLocation && (
            <span className="text-red-500 text-xs mt-1">{errors.cashBoxLocation.message}</span>
          )}
        </div>

        {/* Stripe Confirmation Checkbox */}
        <div className="flex items-start bg-gray-50 p-3 rounded-md border border-gray-200 mt-4">
          <div className="flex h-5 items-center">
            <input
              type="checkbox"
              {...register("stripeConfirmed")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label className="font-medium text-gray-700">
              Stripe Account Handover <span className="text-red-500">*</span>
            </label>
            <p className="text-gray-500">
              I confirm that I have added the incoming President as an Admin on the club's Stripe
              account.
            </p>
          </div>
        </div>
        {errors.stripeConfirmed && (
          <p className="text-red-500 text-xs mt-1">{errors.stripeConfirmed.message}</p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mt-6 disabled:opacity-50"
        >
          {isSubmitting ? "Submitting Protocol..." : "Submit Handover Protocol"}
        </button>
      </form>
    </div>
  );
};
