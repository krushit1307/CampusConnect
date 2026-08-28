export interface GraduatingSeniorProfile {
  userId: string;
  fullName: string;
  handle: string;
  major: string;
  graduationYear: number;
  gpa?: number;
  githubUrl?: string;
  linkedinUrl?: string;
  bio?: string;
  skills?: string[];
  email?: string;
}

export interface ResumeBookCompilationResult {
  clubId: string;
  clubName: string;
  graduationYear: number;
  totalSeniors: number;
  compiledAt: string;
  seniorProfiles: GraduatingSeniorProfile[];
  documentHtml: string;
  sponsorDistributionList: string[];
}

export interface SponsorDispatchPayload {
  sponsorEmails: string[];
  subject: string;
  emailBody: string;
  documentTitle: string;
}

/**
 * Filters active club members graduating in the specified year (#4288).
 */
export function filterGraduatingSeniors(
  members: GraduatingSeniorProfile[],
  gradYear: number = 2026
): GraduatingSeniorProfile[] {
  if (!members) return [];
  return members.filter((m) => m.graduationYear === gradYear);
}

/**
 * Compiles a multi-page standardized Resume Book document (#4288).
 */
export function compileResumeBookDocument(
  clubName: string,
  gradYear: number,
  seniors: GraduatingSeniorProfile[],
  clubId: string = "club-cs-1",
  sponsorEmails: string[] = ["recruiting@google.com", "university@microsoft.com"]
): ResumeBookCompilationResult {
  const filtered = filterGraduatingSeniors(seniors, gradYear);
  const compiledAt = new Date().toISOString();

  // Multi-page HTML markup compilation (Page 1 = Cover, Page 2 = Alice, Page 3 = Bob...)
  const coverPage = `
    <div class="resume-book-cover page shadow-lg bg-indigo-900 text-white p-10 font-mono">
      <h1 class="text-3xl font-black uppercase">${clubName}</h1>
      <h2 class="text-xl font-bold text-indigo-300">Class of ${gradYear} Graduating Senior Resume Book</h2>
      <p class="text-sm text-indigo-200 mt-4">${filtered.length} Verified Senior Graduates</p>
      <div class="mt-8 pt-4 border-t border-indigo-700 text-xs text-indigo-300">
        Compiled on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} • CampusConnect Automated Pipeline
      </div>
    </div>
  `;

  const seniorPages = filtered
    .map(
      (s, idx) => `
    <div class="resume-book-page page shadow border-2 border-black p-6 bg-white font-mono my-4">
      <div class="flex justify-between items-start border-b-2 border-black pb-3">
        <div>
          <h3 class="text-lg font-black">${s.fullName}</h3>
          <span class="text-xs text-gray-600">@${s.handle} • ${s.email || `${s.handle}@campus.edu`}</span>
        </div>
        <span class="px-3 py-1 bg-emerald-100 border border-black font-bold text-xs">
          ${s.gpa ? `GPA: ${s.gpa.toFixed(2)}` : "Graduating Senior"}
        </span>
      </div>
      <div class="my-3 text-xs">
        <span class="font-bold text-indigo-900">Major: ${s.major}</span>
        <p class="mt-2 text-gray-700 font-sans leading-relaxed">${s.bio || "Graduating senior preparing for full-time engineering and research roles."}</p>
      </div>
      ${
        s.skills && s.skills.length > 0
          ? `<div class="flex flex-wrap gap-1 my-2">
              ${s.skills.map((sk) => `<span class="text-[10px] bg-slate-100 border border-slate-300 px-2 py-0.5 font-bold">#${sk}</span>`).join("")}
            </div>`
          : ""
      }
      <div class="flex gap-4 text-xs font-bold pt-3 border-t border-gray-200">
        ${s.githubUrl ? `<a href="${s.githubUrl}" class="text-indigo-600 underline">GitHub Profile</a>` : ""}
        ${s.linkedinUrl ? `<a href="${s.linkedinUrl}" class="text-indigo-600 underline">LinkedIn Profile</a>` : ""}
      </div>
      <div class="text-[10px] text-gray-400 mt-4 text-right">Page ${idx + 2} of ${filtered.length + 1}</div>
    </div>
  `
    )
    .join("");

  const documentHtml = `${coverPage}${seniorPages}`;

  return {
    clubId,
    clubName,
    graduationYear: gradYear,
    totalSeniors: filtered.length,
    compiledAt,
    seniorProfiles: filtered,
    documentHtml,
    sponsorDistributionList: sponsorEmails,
  };
}

/**
 * Generates an automated email dispatch payload for corporate sponsors (#4288).
 */
export function generateSponsorDispatchPayload(
  clubName: string,
  result: ResumeBookCompilationResult,
  sponsorEmails: string[] = ["recruiting@google.com", "university@microsoft.com"]
): SponsorDispatchPayload {
  const docTitle = `${clubName} Class of ${result.graduationYear} Graduating Senior Resume Book`;

  const subject = `🎓 [Resume Book] ${docTitle} (${result.totalSeniors} Graduates)`;

  const emailBody = [
    `Dear Corporate Sponsor,`,
    "",
    `We are excited to share the official ${docTitle}, featuring ${result.totalSeniors} verified graduating seniors from ${clubName}.`,
    "",
    `This compiled packet includes complete candidate profiles, GPAs, technical skill tags, and direct links to candidate GitHub & LinkedIn profiles.`,
    "",
    `Attached: ${docTitle}.pdf`,
    "",
    `Thank you for supporting ${clubName}!`,
    `CampusConnect Automated Talent Pipeline`,
  ].join("\n");

  return {
    sponsorEmails,
    subject,
    emailBody,
    documentTitle: docTitle,
  };
}
