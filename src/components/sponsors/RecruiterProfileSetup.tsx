import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Building2, Mail, Phone, Linkedin, Globe, Calendar, Save, CheckCircle } from "lucide-react";
import {
  upsertRecruiterProfile,
  getRecruiterProfile,
  type RecruiterProfile,
} from "@/lib/recruiterVCard";
import { toast } from "sonner";

interface RecruiterProfileSetupProps {
  onProfileSaved?: (profile: RecruiterProfile) => void;
}

export const RecruiterProfileSetup: React.FC<RecruiterProfileSetupProps> = ({ onProfileSaved }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    const existing = await getRecruiterProfile("");
    if (existing) {
      setProfile(existing);
      setFullName(existing.full_name);
      setEmail(existing.email);
      setCompanyName(existing.company_name);
      setJobTitle(existing.job_title || "");
      setLinkedinUrl(existing.linkedin_url || "");
      setCalendlyUrl(existing.calendly_url || "");
      setPhone(existing.phone || "");
      setWebsiteUrl(existing.website_url || "");
      setBio(existing.bio || "");
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim() || !companyName.trim()) {
      toast.error("Please fill in Name, Email, and Company.");
      return;
    }

    setIsSaving(true);
    const result = await upsertRecruiterProfile({
      full_name: fullName.trim(),
      email: email.trim(),
      company_name: companyName.trim(),
      job_title: jobTitle.trim() || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
      calendly_url: calendlyUrl.trim() || undefined,
      phone: phone.trim() || undefined,
      website_url: websiteUrl.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    setIsSaving(false);

    if (result.success) {
      toast.success("Recruiter profile saved!");
      if (result.profile) {
        setProfile(result.profile);
        onProfileSaved?.(result.profile);
      }
    } else {
      toast.error(result.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-6 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Recruiter Profile</h2>
        <p className="text-sm text-gray-500">
          Set up your digital business card. When you scan a student's QR code, they'll receive your contact info instantly.
        </p>
      </div>

      {profile && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Profile active. Students will receive your card when you scan their QR code.
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Full Name *
          </label>
          <Input
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email *
          </label>
          <Input
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Company *
            </label>
            <Input
              placeholder="Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Title</label>
            <Input
              placeholder="Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Linkedin className="w-3.5 h-3.5" /> LinkedIn URL
          </label>
          <Input
            placeholder="https://linkedin.com/in/janesmith"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Calendly Link
          </label>
          <Input
            placeholder="https://calendly.com/janesmith"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone
            </label>
            <Input
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Website
            </label>
            <Input
              placeholder="https://company.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Bio / Notes</label>
          <textarea
            className="w-full p-2 border rounded-md text-sm min-h-[60px]"
            placeholder="Tell students about yourself and your role..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full" size="lg">
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            {profile ? "Update Profile" : "Save Profile"}
          </>
        )}
      </Button>
    </div>
  );
};

export default RecruiterProfileSetup;
