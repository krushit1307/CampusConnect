import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Location 2: Initialize device fingerprint on component mount
  const { visitorId, isLoading: isFpLoading } = useDeviceFingerprint();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    if (isFpLoading || !visitorId) {
      toast.error("Security verification in progress. Please wait.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Location 1: API request initiated here.
      // The apiClient interceptor automatically attaches the X-Device-Fingerprint header.
      const response = await apiClient.post("/auth/login", {
        email: data.email,
        password: data.password,
      });

      if (response.status === 200) {
        toast.success("Login successful!");
        // Handle successful login (e.g., redirect, set auth state)
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        toast.error("Too many attempts. Please try again later or contact support.");
      } else if (error.response?.status === 401) {
        toast.error("Invalid email or password.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
      console.error("Login failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFpLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-sm text-gray-600">Verifying device security...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md mx-auto p-6">
      <div>
        <Input {...register("email")} placeholder="Email" type="email" />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <Input {...register("password")} placeholder="Password" type="password" />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || isFpLoading}>
        {isSubmitting ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
};
