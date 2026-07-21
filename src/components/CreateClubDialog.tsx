import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import { Plus, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { createClient, getSupabaseUrl } from "@/lib/supabase/client";
import {
  clubFormSchema,
  MAX_DESCRIPTION_LENGTH,
  type ClubFormValues,
  type ClubFormInput,
} from "@/lib/clubUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Progress } from "@/components/ui/progress";
import Cropper from "react-easy-crop";
import { getCroppedImg, type Area } from "@/utils/cropImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const defaultValues: ClubFormInput = {
  name: "",
  slug: "",
  description: "",
  visibility: "public",
  logo_url: null,
};

function uploadFileWithProgress(
  supabaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error"));
    };

    xhr.send(file);
  });
}

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric/spaces/hyphens
    .replace(/[\s_]+/g, "-") // replace spaces and underscores with hyphens
    .replace(/-+/g, "-"); // remove duplicate hyphens
};

export function CreateClubDialog({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const form = useForm<ClubFormInput>({
    resolver: zodResolver(clubFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const nameValue = form.watch("name");

  // Crop states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isSlugDirty = form.getFieldState("slug").isDirty;
    if (!isSlugDirty && nameValue) {
      form.setValue("slug", generateSlug(nameValue), { shouldValidate: true });
    }
  }, [nameValue, form]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG and WEBP images are allowed.");
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image must be under 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCropImageSrc(reader.result as string);
      setSelectedFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    });
    reader.readAsDataURL(file);
  }

  async function handleCropConfirm() {
    if (!cropImageSrc || !croppedAreaPixels || !selectedFile) return;

    setUploadingLogo(true);
    setCropImageSrc(null);

    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], selectedFile.name, {
        type: selectedFile.type,
      });

      const logoUrl = await uploadClubLogo(croppedFile);
      if (logoUrl) {
        form.setValue("logo_url", logoUrl, { shouldValidate: true, shouldDirty: true });
        toast.success("Logo cropped and ready.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to crop and upload logo.");
    } finally {
      setUploadingLogo(false);
      setLogoUploadProgress(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function uploadClubLogo(file: File): Promise<string | undefined> {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Session expired. Please sign in again.");
      return;
    }

    const supabaseUrl = getSupabaseUrl();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    await uploadFileWithProgress(
      supabaseUrl,
      session.access_token,
      "avatars",
      filePath,
      file,
      setLogoUploadProgress,
    );
    setLogoUploadProgress(null);

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    return publicUrl;
  }

  const createClub = useMutation({
    mutationFn: async (values: ClubFormValues) => {
      if (!user) {
        throw new Error("You must be logged in to create a club.");
      }

      // Check if slug is unique
      const { data: existingClub } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", values.slug.trim())
        .maybeSingle();

      if (existingClub) {
        throw new Error(
          "A club with this slug already exists. Please choose a different name or edit the slug.",
        );
      }

      // Insert club
      const { data: newClub, error } = await supabase
        .from("clubs")
        .insert({
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: values.description.trim(),
          logo_url: values.logo_url || null,
          created_by: user.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Automatically add creator as admin member
      if (newClub) {
        const { error: memberError } = await supabase.from("club_members").insert({
          club_id: newClub.id,
          user_id: user.id,
          role: "admin",
          status: "approved",
        });
        if (memberError) {
          console.error("[CreateClubDialog] Failed to add creator as member:", memberError);
        }
      }
    },
    onSuccess: () => {
      toast.success("Club submitted for administrator review.");
      window.dispatchEvent(new Event("refetchClubs"));
      form.reset(defaultValues);
      setOpen(false);
    },
    onError: (error: Error) => {
      console.error("[CreateClubDialog] Failed to create club:", error);
      toast.error(error.message || "Couldn't create the club. Please try again.");
    },
  });

  const onSubmit = (values: ClubFormInput) => {
    const parsed = clubFormSchema.parse(values);
    createClub.mutate(parsed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset(defaultValues);
          setSelectedFile(null);
          setCropImageSrc(null);
          setUploadingLogo(false);
          setLogoUploadProgress(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="neu-border neu-press flex items-center gap-2 bg-sky px-5 py-3 font-mono text-sm font-bold uppercase text-black"
        >
          <Plus className="h-4 w-4" />
          Create a Club
        </button>
      </DialogTrigger>
      <DialogContent className="neu-border neu-shadow bg-violet-500 sm:max-w-2xl text-black">
        <DialogHeader>
          <DialogTitle className="text-blue-900">Create a new club</DialogTitle>
          <DialogDescription className="text-black">
            Submit a new club or student chapter. An administrator will review it before it appears
            publicly.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Club Logo Uploader */}
            <div className="flex flex-col items-center gap-3 bg-white/20 p-4 border-2 border-black sm:flex-row sm:items-center sm:gap-5">
              <div className="relative shrink-0">
                <div className="neu-border flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-lime">
                  {form.watch("logo_url") ? (
                    <img
                      src={form.watch("logo_url")!}
                      alt="Club Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-lg font-bold text-black">
                      {form.watch("name")
                        ? form
                            .watch("name")
                            .split(" ")
                            .filter(Boolean)
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "CL"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  aria-label="Upload club logo"
                  title="Upload club logo"
                  className="neu-border neu-press absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-cream hover:bg-cream hover:text-black"
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="eyebrow font-bold text-black">Club Logo</p>
                <p className="font-mono text-[11px] text-black/70">
                  JPG, PNG or WEBP. Max 2 MB. Fixed 1:1 crop.
                </p>
                {logoUploadProgress !== null && (
                  <div className="mt-2 w-full space-y-1">
                    <Progress value={logoUploadProgress} className="h-2 bg-black/10" />
                    <p className="font-mono text-[10px] text-black">{logoUploadProgress}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required className="text-red-900">
                      Club Name
                    </FormLabel>
                    <FormControl className="text-black">
                      <Input placeholder="AI Research Group" {...field} />
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
                    <FormLabel required className="text-red-900">
                      Web Address Slug
                    </FormLabel>
                    <FormControl className="text-black">
                      <Input placeholder="ai-research-group" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => {
                const currentLength = field.value?.length ?? 0;
                const isNearLimit = currentLength >= MAX_DESCRIPTION_LENGTH - 10;

                return (
                  <FormItem className="text-black">
                    <FormLabel required className="text-red-900">
                      Club Description (Markdown)
                    </FormLabel>

                    <FormControl>
                      <MarkdownEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Write about your club..."
                        rows={6}
                        minHeightClass="min-h-36"
                      />
                    </FormControl>

                    <div
                      className={`mt-1 text-right text-xs ${
                        isNearLimit ? "text-red-500" : "text-black"
                      }`}
                    >
                      {currentLength}/{MAX_DESCRIPTION_LENGTH}
                    </div>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={createClub.isPending} className="w-full sm:w-auto">
                {createClub.isPending ? "Submitting..." : "Submit Club"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      <Dialog
        open={!!cropImageSrc}
        onOpenChange={(open) => {
          if (!open) {
            setCropImageSrc(null);
            setSelectedFile(null);
          }
        }}
      >
        <DialogContent className="neu-border neu-shadow bg-[#f3f1e4] sm:max-w-md text-black max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-black">Crop Club Logo</DialogTitle>
          </DialogHeader>
          <div className="relative h-64 w-full bg-black/10 mt-2 overflow-hidden">
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            )}
          </div>
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs font-mono font-bold">
              <span>Zoom</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-black"
            />
          </div>
          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setCropImageSrc(null);
                setSelectedFile(null);
              }}
              className="neu-border bg-white text-black font-mono text-xs font-bold uppercase py-2 px-4 hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropConfirm}
              className="neu-border bg-black text-cream font-mono text-xs font-bold uppercase py-2 px-4 hover:bg-lime hover:text-black"
            >
              Crop & Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
