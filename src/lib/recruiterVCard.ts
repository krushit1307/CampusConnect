// =============================================================================
// Utility: Recruiter VCF Generation & Reverse Payload
// Issue: #4541 - Build an 'Interactive "Sponsor Lead" Digital Business Card Exchange'
//
// Generates recruiter vCard (.vcf) files for 1-click import to student contacts.
// Handles the reverse payload flow when a sponsor scans a student's QR code.
// =============================================================================

import { createClient } from "./supabase/client";

export interface RecruiterProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  job_title?: string;
  linkedin_url?: string;
  calendly_url?: string;
  phone?: string;
  website_url?: string;
  bio?: string;
}

export interface SponsorLeadConnection {
  id: string;
  sponsor_user_id: string;
  student_user_id: string;
  event_id: string;
  recruiter_profile_id: string;
  notification_sent: boolean;
  vcf_downloaded: boolean;
  connected_at: string;
}

/**
 * Generates a recruiter vCard (.vcf) string for phone contact import.
 * Includes: Full name, email, phone, company, job title, LinkedIn, Calendly, website, and a note.
 */
export function generateRecruiterVCard(profile: RecruiterProfile, eventName?: string): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.full_name}`,
    `N:${profile.full_name.split(" ").reverse().join(";")};;;`,
    `EMAIL;TYPE=INTERNET:${profile.email}`,
    profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : null,
    profile.company_name ? `ORG:${profile.company_name}` : null,
    profile.job_title ? `TITLE:${profile.job_title}` : null,
    profile.linkedin_url ? `URL;TYPE=LinkedIn:${profile.linkedin_url}` : null,
    profile.calendly_url ? `URL;TYPE=Calendly:${profile.calendly_url}` : null,
    profile.website_url ? `URL;TYPE=Website:${profile.website_url}` : null,
    profile.bio ? `NOTE:${profile.bio}` : null,
    eventName ? `X-MET-AT:${eventName}` : null,
    "END:VCARD",
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Downloads a recruiter's vCard as a .vcf file to the student's phone/device.
 */
export function downloadRecruiterVCard(
  profile: RecruiterProfile,
  eventName?: string,
): void {
  const vcard = generateRecruiterVCard(profile, eventName);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${profile.full_name.replace(/\s+/g, "_")}_BusinessCard.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Fetches a recruiter profile by user ID from the database.
 */
export async function getRecruiterProfile(userId: string): Promise<RecruiterProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_recruiter_profile", {
    p_user_id: userId,
  });

  if (error || !data?.success) return null;
  return data.profile;
}

/**
 * Upserts a recruiter profile for the current user.
 */
export async function upsertRecruiterProfile(profile: {
  full_name: string;
  email: string;
  company_name: string;
  job_title?: string;
  linkedin_url?: string;
  calendly_url?: string;
  phone?: string;
  website_url?: string;
  bio?: string;
}): Promise<{ success: boolean; message: string; profile?: RecruiterProfile }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("upsert_recruiter_profile", {
    p_full_name: profile.full_name,
    p_email: profile.email,
    p_company_name: profile.company_name,
    p_job_title: profile.job_title || null,
    p_linkedin_url: profile.linkedin_url || null,
    p_calendly_url: profile.calendly_url || null,
    p_phone: profile.phone || null,
    p_website_url: profile.website_url || null,
    p_bio: profile.bio || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: data?.success ?? false,
    message: data?.success ? "Recruiter profile saved." : data?.message || "Failed to save profile.",
    profile: data?.profile,
  };
}

/**
 * Triggers the reverse payload: sends recruiter business card + notification to the student.
 * Called after the sponsor successfully scans a student's QR code.
 */
export async function triggerReversePayload(
  studentUserId: string,
  eventId: string,
): Promise<{
  success: boolean;
  message: string;
  recruiter?: RecruiterProfile;
  connectionId?: string;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("trigger_sponsor_reverse_payload", {
    p_student_user_id: studentUserId,
    p_event_id: eventId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: data?.success ?? false,
    message: data?.message || "Reverse payload processed.",
    recruiter: data?.recruiter,
    connectionId: data?.connection_id,
  };
}

/**
 * Marks a connection's VCF as downloaded (for analytics).
 */
export async function markVcfDownloaded(connectionId: string): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("mark_vcf_downloaded", {
    p_connection_id: connectionId,
  });
}
