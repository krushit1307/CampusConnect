import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Briefcase from "lucide-react/dist/esm/icons/briefcase";
import Award from "lucide-react/dist/esm/icons/award";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

interface SkillMatcherWidgetProps {
  userRole: "student" | "recruiter";
  sponsorId?: string;
  companyName?: string;
}

interface MatchResult {
  company: string;
  title: string;
  match: number;
  missing: string[];
}

export function SkillMatcherWidget({
  userRole,
  sponsorId,
  companyName = "Sponsor Corp",
}: SkillMatcherWidgetProps) {
  const [jdTitle, setJdTitle] = useState("");
  const [jdDesc, setJdDesc] = useState("");
  const [jdSkills, setJdSkills] = useState("");
  const [studentSkills, setStudentSkills] = useState("React, TypeScript, Java");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadJD = async () => {
    if (!jdTitle || !jdDesc || !jdSkills) return alert("All fields are required!");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const skillsArray = jdSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const { error } = await supabase.from("sponsor_job_descriptions").insert({
        sponsor_id: user?.id || sponsorId,
        company_name: companyName,
        title: jdTitle,
        description: jdDesc,
        required_skills: skillsArray,
      });

      if (error) throw error;
      alert("Job Description uploaded successfully!");
      setJdTitle("");
      setJdDesc("");
      setJdSkills("");
    } catch (err: any) {
      alert("Failed to upload: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatchSkills = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const skillsArray = studentSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const { data, error } = await supabase.functions.invoke("match-sponsor-leads", {
        body: { skills: skillsArray },
      });

      if (error) throw error;
      setMatches(data.matches || []);
    } catch (err) {
      console.error(err);
      alert("Matching failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="skill-matcher-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 mb-4">
        <Sparkles className="text-yellow-500 animate-pulse" size={18} />
        Sponsor Lead Skill Matching Algorithm
      </h3>

      {userRole === "recruiter" ? (
        <div className="space-y-4">
          <h4 className="font-bold uppercase flex items-center gap-1.5">
            <Briefcase size={16} /> Upload Job Description (JD)
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label>Job Title</label>
              <input
                type="text"
                value={jdTitle}
                onChange={(e) => setJdTitle(e.target.value)}
                className="border-2 border-black px-2 py-1.5"
                placeholder="e.g. Software Engineer"
                data-testid="jd-title-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label>Description</label>
              <textarea
                value={jdDesc}
                onChange={(e) => setJdDesc(e.target.value)}
                className="border-2 border-black px-2 py-1.5"
                placeholder="Job description details..."
                data-testid="jd-desc-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label>Required Skills (comma separated)</label>
              <input
                type="text"
                value={jdSkills}
                onChange={(e) => setJdSkills(e.target.value)}
                className="border-2 border-black px-2 py-1.5"
                placeholder="e.g. React, Python, Docker"
                data-testid="jd-skills-input"
              />
            </div>
            <button
              onClick={handleUploadJD}
              disabled={isLoading}
              data-testid="upload-jd-btn"
              className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] w-fit"
            >
              Upload & Parse Skills
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="font-bold uppercase flex items-center gap-1.5">
            <Award size={16} /> Student Skills Matcher
          </h4>
          <div className="flex flex-col gap-1.5">
            <label>Verify Your Skills (from parsed resume)</label>
            <input
              type="text"
              value={studentSkills}
              onChange={(e) => setStudentSkills(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
              data-testid="student-skills-input"
            />
          </div>
          <button
            onClick={handleMatchSkills}
            disabled={isLoading}
            data-testid="match-skills-btn"
            className="border-2 border-black bg-[#a3e635] px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
          >
            {isLoading ? "Matching..." : "Run Skill Matcher"}
          </button>

          {matches.length > 0 && (
            <div className="border-t-2 border-black pt-4">
              <h5 className="font-bold uppercase mb-2">High Match Openings</h5>
              <div className="space-y-3">
                {matches.map((m, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-black p-3 bg-slate-50 space-y-1.5"
                    data-testid={`match-card-${idx}`}
                  >
                    <div className="flex justify-between items-center">
                      <strong className="text-sm">{m.company}</strong>
                      <span className="bg-lime border border-black px-2 py-0.5 text-[10px] font-bold">
                        {m.match}% MATCH
                      </span>
                    </div>
                    <div>Role: {m.title}</div>
                    {m.missing.length > 0 && (
                      <div className="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-300 p-2 font-bold">
                        💡 Recruiting tip: Highlight your experience with {m.missing[0]} when you
                        talk to them!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
