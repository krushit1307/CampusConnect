import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface RevivalRequestData {
  studentId: string;
  motivation: string;
  leadershipPlan: string;
}

interface RevivalRequestFormProps {
  onSubmit: (data: RevivalRequestData) => void;
  isSubmitting: boolean;
}

export function RevivalRequestForm({ onSubmit, isSubmitting }: RevivalRequestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RevivalRequestData>();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="studentId">Student ID</Label>
        <Input
          id="studentId"
          placeholder="e.g. 12345678"
          {...register("studentId", { required: "Student ID is required" })}
          className="neu-border font-mono"
        />
        {errors.studentId && (
          <p className="text-red-500 text-sm font-mono">{errors.studentId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivation">Why do you want to revive this club?</Label>
        <Textarea
          id="motivation"
          placeholder="Explain your motivation..."
          {...register("motivation", { required: "Motivation is required" })}
          className="neu-border font-mono min-h-[100px]"
        />
        {errors.motivation && (
          <p className="text-red-500 text-sm font-mono">{errors.motivation.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="leadershipPlan">Leadership & Activity Plan</Label>
        <Textarea
          id="leadershipPlan"
          placeholder="What are your plans for the first semester?"
          {...register("leadershipPlan", { required: "Leadership plan is required" })}
          className="neu-border font-mono min-h-[100px]"
        />
        {errors.leadershipPlan && (
          <p className="text-red-500 text-sm font-mono">{errors.leadershipPlan.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full neu-border bg-brand-blue-base hover:bg-brand-blue-dark text-white font-mono uppercase tracking-wider font-bold"
      >
        {isSubmitting ? "Submitting..." : "Submit Petition"}
      </Button>
    </form>
  );
}
