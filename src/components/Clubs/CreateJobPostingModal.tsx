import React, { useState } from "react";
import { Briefcase, Building2, MapPin, ExternalLink, X, Plus } from "lucide-react";
import { getCompanyLogoUrl, ClubJobPosting } from "@/lib/alumniJobBoard";
import { cn } from "@/lib/utils";

export interface CreateJobPostingModalProps {
  isOpen: boolean;
  clubId: string;
  onClose: () => void;
  onSubmit: (posting: Omit<ClubJobPosting, "id" | "created_at" | "expires_at">) => void;
}

export const CreateJobPostingModal: React.FC<CreateJobPostingModalProps> = ({
  isOpen,
  clubId,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [location, setLocation] = useState("Remote");
  const [jobType, setJobType] = useState<ClubJobPosting["job_type"]>("Full-time");
  const [applyUrl, setApplyUrl] = useState("");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !company || !applyUrl || !description) return;

    onSubmit({
      club_id: clubId,
      alumni_user_id: "alumni-current-user",
      title,
      company,
      company_domain: companyDomain || null,
      description,
      location,
      job_type: jobType,
      apply_url: applyUrl,
    });

    onClose();
  };

  const logoPreview = getCompanyLogoUrl(companyDomain || company);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-mono"
    >
      <div className="relative w-full max-w-xl bg-white border-2 border-black p-6 rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-5">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2 font-bold uppercase text-base">
            <Briefcase className="w-5 h-5 text-purple-600" />
            <span>Post Exclusive Club Opportunity</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 hover:bg-gray-100 rounded-md border border-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo & Company Row */}
          <div className="flex items-center gap-4 bg-purple-50 p-3 border-2 border-black rounded-lg">
            <img
              src={logoPreview}
              alt="Company logo preview"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/identicon/svg?seed=Company";
              }}
              className="w-12 h-12 object-contain bg-white border border-black rounded-md p-1"
            />
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase block">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google, Stripe"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-2 py-1 border border-black bg-white text-xs font-sans rounded"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase block">Website Domain</label>
                <input
                  type="text"
                  placeholder="e.g. stripe.com"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  className="w-full px-2 py-1 border border-black bg-white text-xs font-sans rounded"
                />
              </div>
            </div>
          </div>

          {/* Job Title & Type */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase block">Job Title *</label>
              <input
                type="text"
                required
                placeholder="Software Engineer Intern"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white text-xs font-sans rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block">Job Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as ClubJobPosting["job_type"])}
                className="w-full px-2 py-2 border-2 border-black bg-white text-xs font-bold rounded-md"
              >
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </div>

          {/* Location & Application URL */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase block">Location</label>
              <input
                type="text"
                placeholder="Remote / San Francisco"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white text-xs font-sans rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block">Apply URL *</label>
              <input
                type="url"
                required
                placeholder="https://careers.company.com/apply"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white text-xs font-sans rounded-md"
              />
            </div>
          </div>

          {/* Job Description */}
          <div>
            <label className="text-xs font-bold uppercase block">Role Description & Requirements *</label>
            <textarea
              required
              rows={3}
              placeholder="Describe the opportunity, tech stack, or referral details for fellow club members..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black bg-white text-xs font-sans rounded-md"
            />
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-black bg-gray-100 text-xs font-bold uppercase rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 border-2 border-black bg-purple-600 text-white text-xs font-bold uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Publish Opportunity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
