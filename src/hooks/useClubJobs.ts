import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface ClubJob {
  id: string;
  title: string;
  description: string;
  is_open: boolean;
  created_at: string;
  applicant_count: number;
  user_application_id: string | null;
  user_application_status: string | null;
}

export interface JobApplication {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_handle: string | null;
  status: string;
  application_text: string;
  created_at: string;
}

export function useClubJobs(clubId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery<ClubJob[]>({
    queryKey: ["club-jobs", clubId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_club_jobs", {
        p_club_id: clubId,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
  });

  const createJob = useMutation({
    mutationFn: async (job: { club_id: string; title: string; description: string }) => {
      const { error } = await supabase.from("club_jobs").insert({
        club_id: job.club_id,
        title: job.title,
        description: job.description,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-jobs", clubId] });
      toast.success("Job posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleJobStatus = useMutation({
    mutationFn: async ({ jobId, isOpen }: { jobId: string; isOpen: boolean }) => {
      const { error } = await supabase
        .from("club_jobs")
        .update({ is_open: isOpen })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-jobs", clubId] });
      toast.success("Job status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from("club_jobs").delete().eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-jobs", clubId] });
      toast.success("Job removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const applyToJob = useMutation({
    mutationFn: async ({ jobId, applicationText }: { jobId: string; applicationText: string }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("club_job_applications").insert({
        job_id: jobId,
        user_id: userId,
        application_text: applicationText,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("You have already applied to this position");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-jobs", clubId] });
      toast.success("Application submitted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    jobs,
    isLoading,
    createJob,
    toggleJobStatus,
    deleteJob,
    applyToJob,
    openJobs: jobs.filter((j) => j.is_open),
  };
}

export function useJobApplications(jobId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery<JobApplication[]>({
    queryKey: ["job-applications", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_job_applications", {
        p_job_id: jobId,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!jobId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const { error } = await supabase.rpc("update_application_status", {
        p_application_id: applicationId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-applications", jobId] });
      toast.success("Application status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { applications, isLoading, updateStatus };
}
