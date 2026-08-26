import React, { useEffect, useState, useMemo } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, m, LazyMotion } from "framer-motion";
import { loadDomMax } from "@/lib/motionFeatures";
import Check from "lucide-react/dist/esm/icons/check";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Building from "lucide-react/dist/esm/icons/building";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Upload from "lucide-react/dist/esm/icons/upload";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CascadingCategorySelect } from "./CascadingCategorySelect";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

export const SESSION_STORAGE_KEY = "campusconnect.club-registration-draft";

export const clubRegistrationSchema = z.object({
  // Step 1: Basic Info
  name: z.string().min(2, "Club name must be at least 2 characters."),
  slug: z.string().min(2, "Slug must be at least 2 characters."),
  category_id: z.string().min(1, "Please select a club category."),
  tagline: z.string().min(5, "Tagline must be at least 5 characters."),

  // Step 2: Social Links & Contact
  contact_email: z.string().email("Please enter a valid contact email."),
  website: z.string().optional().or(z.literal("")),
  instagram: z.string().optional().or(z.literal("")),
  twitter: z.string().optional().or(z.literal("")),
  discord: z.string().optional().or(z.literal("")),

  // Step 3: Advisor Details
  advisor_name: z.string().min(2, "Advisor name is required."),
  advisor_email: z.string().email("Please enter a valid advisor email."),
  advisor_department: z.string().min(2, "Advisor department is required."),
  advisor_title: z.string().min(2, "Advisor title/role is required."),

  // Step 4: Constitution & Document Upload
  description: z.string().min(20, "Constitution/description must be at least 20 characters."),
  charter_statement: z.string().min(10, "Charter statement is required."),
  member_agreement: z.boolean().refine((val) => val === true, {
    message: "You must agree to the club member code of conduct.",
  }),
});

export type ClubRegistrationFormValues = z.infer<typeof clubRegistrationSchema>;

export interface ClubRegistrationWizardProps {
  initialValues?: Partial<ClubRegistrationFormValues>;
  onSubmit?: (data: ClubRegistrationFormValues) => Promise<void>;
  isSubmitting?: boolean;
}

export function ClubRegistrationWizard({
  initialValues,
  onSubmit,
  isSubmitting = false,
}: ClubRegistrationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isHydrated, setIsHydrated] = useState(false);

  const form = useForm<ClubRegistrationFormValues>({
    resolver: zodResolver(clubRegistrationSchema),
    defaultValues: {
      name: "",
      slug: "",
      category_id: "",
      tagline: "",
      contact_email: "",
      website: "",
      instagram: "",
      twitter: "",
      discord: "",
      advisor_name: "",
      advisor_email: "",
      advisor_department: "",
      advisor_title: "",
      description: "",
      charter_statement: "",
      member_agreement: false,
      ...initialValues,
    },
    mode: "onBlur",
  });

  // Rehydrate form values from sessionStorage on mount (#1742)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        form.reset({ ...form.getValues(), ...parsed });
      }
    } catch {
      // Ignore corrupt session cache
    } finally {
      setIsHydrated(true);
    }
  }, [form]);

  // Sync form edits to sessionStorage on every change (#1742)
  useEffect(() => {
    if (!isHydrated) return;
    const subscription = form.watch((values) => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form, isHydrated]);

  // Auto-generate slug from club name
  const nameValue = form.watch("name");
  useEffect(() => {
    const isSlugDirty = form.getFieldState("slug").isDirty;
    if (!isSlugDirty && nameValue) {
      const slugified = nameValue
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/[\s_]+/g, "-");
      form.setValue("slug", slugified, { shouldValidate: true });
    }
  }, [nameValue, form]);

  const stepFieldsMap: Record<number, Array<keyof ClubRegistrationFormValues>> = {
    1: ["name", "slug", "category_id", "tagline"],
    2: ["contact_email"],
    3: ["advisor_name", "advisor_email", "advisor_department", "advisor_title"],
    4: ["description", "charter_statement", "member_agreement"],
  };

  const handleNext = async () => {
    const fieldsToValidate = stepFieldsMap[currentStep] || [];
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFormSubmit = async (data: ClubRegistrationFormValues) => {
    if (onSubmit) {
      await onSubmit(data);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  };

  const steps = [
    { id: 1, title: "Basic Details", icon: Building },
    { id: 2, title: "Social Links", icon: Share2 },
    { id: 3, title: "Advisor Details", icon: UserCheck },
    { id: 4, title: "Constitution", icon: FileText },
  ];

  const progressPercent = (currentStep / 4) * 100;

  return (
    <LazyMotion features={loadDomMax}>
      <div className="w-full max-w-3xl mx-auto space-y-6 font-mono">
        {/* Step Progress Bar & SVG Line (#1742) */}
        <div className="neu-border bg-white p-5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-black">
              Step {currentStep} of 4: <span className="text-lime-700 font-extrabold">{steps[currentStep - 1].title}</span>
            </span>
            <span className="font-bold text-xs text-muted-foreground">{Math.round(progressPercent)}%</span>
          </div>

          {/* SVG Progress Line */}
          <div className="relative w-full h-3 neu-border border-black bg-gray-100 rounded-full overflow-hidden">
            <svg className="w-full h-full">
              <rect
                x="0"
                y="0"
                width={`${progressPercent}%`}
                height="100%"
                className="fill-lime transition-all duration-500 ease-out"
              />
            </svg>
          </div>

          {/* Step Badges Header */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {steps.map((s) => {
              const Icon = s.icon;
              const isDone = s.id < currentStep;
              const isCurrent = s.id === currentStep;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={async () => {
                    if (s.id < currentStep) {
                      setCurrentStep(s.id);
                    } else if (s.id > currentStep) {
                      const valid = await form.trigger(stepFieldsMap[currentStep] as any);
                      if (valid) setCurrentStep(s.id);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 neu-border rounded-lg border-black text-[11px] font-bold transition-all",
                    isCurrent
                      ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : isDone
                      ? "bg-lime/30 text-black hover:bg-lime/50"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100",
                  )}
                >
                  <div className="flex items-center gap-1">
                    {isDone ? <Check className="w-3.5 h-3.5 text-lime-700" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Container with Framer Motion Slide Transitions (#1742) */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="neu-border bg-white p-6 rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] min-h-[360px] relative overflow-hidden">
              <m.div
                key={currentStep}
                initial={{ x: 25, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                  {/* STEP 1: Basic Details */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="border-b-2 border-black pb-3">
                        <h2 className="text-xl font-bold uppercase tracking-wider text-black">
                          1. Basic Club Details
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Set your club name, custom web URL slug, category, and tagline.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Club Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="AI Research Society" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Web URL Slug *</FormLabel>
                              <FormControl>
                                <Input placeholder="ai-research-society" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="category_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase">Club Category *</FormLabel>
                            <FormControl>
                              <CascadingCategorySelect
                                value={field.value || null}
                                onChange={(val) => form.setValue("category_id", val || "", { shouldValidate: true })}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tagline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase">Club Tagline / One-liner *</FormLabel>
                            <FormControl>
                              <Input placeholder="Empowering campus innovators in artificial intelligence" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* STEP 2: Social Links & Contact */}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div className="border-b-2 border-black pb-3">
                        <h2 className="text-xl font-bold uppercase tracking-wider text-black">
                          2. Contact & Social Links
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Provide your official contact email and social media handles.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="contact_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase">Official Contact Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="contact@aisociety.edu" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Website URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://aisociety.org" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="instagram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Instagram Handle / URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://instagram.com/aisociety" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="twitter"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Twitter / X URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://x.com/aisociety" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="discord"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Discord Invite Link</FormLabel>
                              <FormControl>
                                <Input placeholder="https://discord.gg/aisociety" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Advisor Details */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="border-b-2 border-black pb-3">
                        <h2 className="text-xl font-bold uppercase tracking-wider text-black">
                          3. Faculty Advisor Details
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Every official student club requires a recognized faculty or staff advisor.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="advisor_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Advisor Full Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Dr. Alan Turing" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="advisor_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Advisor Email Address *</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="turing@cs.campus.edu" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="advisor_department"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Department *</FormLabel>
                              <FormControl>
                                <Input placeholder="Computer Science & Engineering" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="advisor_title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold text-xs uppercase">Academic Title / Role *</FormLabel>
                              <FormControl>
                                <Input placeholder="Associate Professor" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Constitution & Review */}
                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <div className="border-b-2 border-black pb-3">
                        <h2 className="text-xl font-bold uppercase tracking-wider text-black">
                          4. Constitution & Charter Agreement
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Write your club's constitution, charter statement, and accept the code of conduct.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase">Club Constitution & Mission *</FormLabel>
                            <FormControl>
                              <MarkdownEditor
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Article I: Name & Purpose&#10;Article II: Membership Requirements&#10;Article III: Officer Responsibilities..."
                                rows={6}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="charter_statement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase">Charter Statement *</FormLabel>
                            <FormControl>
                              <Input placeholder="We hereby request official recognition as an active campus club..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="member_agreement"
                        render={({ field }) => (
                          <FormItem className="neu-border bg-lime/20 p-3 rounded-lg flex items-start gap-3">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                className="mt-1 w-4 h-4 accent-black border-2 border-black rounded"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-bold text-xs uppercase cursor-pointer">
                                Campus Club Code of Conduct Agreement *
                              </FormLabel>
                              <p className="text-[11px] text-gray-600 leading-tight">
                                I confirm all information provided is accurate and agree that our club will abide by university guidelines.
                              </p>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </m.div>

              {/* Navigation Controls */}
              <div className="mt-8 flex items-center justify-between border-t-2 border-black pt-4">
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="neu-border bg-white text-black font-mono font-bold text-xs uppercase px-5 py-2 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                ) : (
                  <div />
                )}

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="neu-border bg-black text-white hover:bg-gray-800 font-mono font-bold text-xs uppercase px-6 py-2 flex items-center gap-1.5"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="neu-border bg-lime text-black hover:bg-lime/90 font-mono font-bold text-xs uppercase px-7 py-2.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Club Registration"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>
    </LazyMotion>
  );
}
