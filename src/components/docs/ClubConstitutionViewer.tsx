import React, { useRef } from "react";
import { DocumentScrollSpy, HeadingItem } from "./DocumentScrollSpy";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Shield from "lucide-react/dist/esm/icons/shield";
import Scale from "lucide-react/dist/esm/icons/scale";
import Users from "lucide-react/dist/esm/icons/users";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Award from "lucide-react/dist/esm/icons/award";

export interface ClubConstitutionViewerProps {
  clubName?: string;
  headings?: HeadingItem[];
}

export const defaultConstitutionHeadings: HeadingItem[] = [
  { id: "article-1-name", text: "Article I: Name & Purpose", level: 2 },
  { id: "sec-1-name", text: "Section 1.1: Official Designation", level: 3 },
  { id: "sec-1-mission", text: "Section 1.2: Mission Statement", level: 3 },
  { id: "article-2-membership", text: "Article II: Membership Rights", level: 2 },
  { id: "sec-2-eligibility", text: "Section 2.1: Eligibility Criteria", level: 3 },
  { id: "sec-2-voting", text: "Section 2.2: Voting Qualifications", level: 3 },
  { id: "article-3-officers", text: "Article III: Executive Board", level: 2 },
  { id: "sec-3-roles", text: "Section 3.1: Officer Roles & Term Limits", level: 3 },
  { id: "article-4-elections", text: "Article IV: Annual Elections", level: 2 },
  { id: "article-5-amendments", text: "Article V: Constitutional Amendments", level: 2 },
];

export const ClubConstitutionViewer: React.FC<ClubConstitutionViewerProps> = ({
  clubName = "Campus Tech & Coding Society",
  headings = defaultConstitutionHeadings,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 border-b-2 border-black pb-4 dark:border-cream">
        <div className="flex items-center gap-2 text-blue-600 font-mono text-xs font-bold uppercase">
          <FileText className="h-4 w-4" /> Official Governance Document
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase mt-1">
          {clubName} Constitution
        </h1>
        <p className="font-mono text-xs text-neutral-500 mt-1">
          Last ratified: October 2025 • Student Activities Governance Board
        </p>
      </div>

      {/* Main Layout: Left Content + Right Sticky ToC */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Document Content Column */}
        <div
          ref={contentRef}
          className="flex-1 space-y-8 rounded-xl border-2 border-black bg-white p-6 dark:border-cream dark:bg-neutral-900 font-mono text-xs leading-relaxed"
        >
          {/* Article I */}
          <section id="article-1-name" className="space-y-3 pt-2">
            <h2 className="font-display text-lg font-bold uppercase text-black dark:text-white border-b border-neutral-300 dark:border-neutral-700 pb-1">
              Article I: Name & Purpose
            </h2>
            <div id="sec-1-name" className="space-y-2 pl-2">
              <h3 className="font-bold text-blue-600 dark:text-blue-400">
                Section 1.1: Official Designation
              </h3>
              <p className="text-neutral-700 dark:text-neutral-300">
                The official name of this student organization shall be the {clubName}, hereafter
                referred to as the Organization.
              </p>
            </div>
            <div id="sec-1-mission" className="space-y-2 pl-2">
              <h3 className="font-bold text-blue-600 dark:text-blue-400">
                Section 1.2: Mission Statement
              </h3>
              <p className="text-neutral-700 dark:text-neutral-300">
                The primary purpose of the Organization is to foster collaborative software
                development, conduct technical workshops, and prepare members for software
                engineering careers through campus hackathons and open-source contributions.
              </p>
            </div>
          </section>

          {/* Article II */}
          <section id="article-2-membership" className="space-y-3 pt-4">
            <h2 className="font-display text-lg font-bold uppercase text-black dark:text-white border-b border-neutral-300 dark:border-neutral-700 pb-1">
              Article II: Membership Rights
            </h2>
            <div id="sec-2-eligibility" className="space-y-2 pl-2">
              <h3 className="font-bold text-blue-600 dark:text-blue-400">
                Section 2.1: Eligibility Criteria
              </h3>
              <p className="text-neutral-700 dark:text-neutral-300">
                Membership is open to all currently enrolled undergraduate and graduate students
                without regard to race, color, creed, or academic department.
              </p>
            </div>
            <div id="sec-2-voting" className="space-y-2 pl-2">
              <h3 className="font-bold text-blue-600 dark:text-blue-400">
                Section 2.2: Voting Qualifications
              </h3>
              <p className="text-neutral-700 dark:text-neutral-300">
                Active members who have attended at least three general body meetings during the
                current semester retain full voting rights during executive elections.
              </p>
            </div>
          </section>

          {/* Article III */}
          <section id="article-3-officers" className="space-y-3 pt-4">
            <h2 className="font-display text-lg font-bold uppercase text-black dark:text-white border-b border-neutral-300 dark:border-neutral-700 pb-1">
              Article III: Executive Board
            </h2>
            <div id="sec-3-roles" className="space-y-2 pl-2">
              <h3 className="font-bold text-blue-600 dark:text-blue-400">
                Section 3.1: Officer Roles & Term Limits
              </h3>
              <p className="text-neutral-700 dark:text-neutral-300">
                The Executive Board consists of President, Vice President, Treasurer, and Secretary.
                Officers serve one-academic-year terms starting May 1st.
              </p>
            </div>
          </section>

          {/* Article IV */}
          <section id="article-4-elections" className="space-y-3 pt-4">
            <h2 className="font-display text-lg font-bold uppercase text-black dark:text-white border-b border-neutral-300 dark:border-neutral-700 pb-1">
              Article IV: Annual Elections
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300">
              Elections take place annually in April via secure anonymous online ballot supervised
              by the faculty advisor.
            </p>
          </section>

          {/* Article V */}
          <section id="article-5-amendments" className="space-y-3 pt-4">
            <h2 className="font-display text-lg font-bold uppercase text-black dark:text-white border-b border-neutral-300 dark:border-neutral-700 pb-1">
              Article V: Constitutional Amendments
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300">
              Amendments require a two-thirds majority vote of voting members present and final
              approval from the Dean of Student Affairs.
            </p>
          </section>
        </div>

        {/* Right Sticky Table of Contents */}
        <DocumentScrollSpy headings={headings} contentContainerRef={contentRef} />
      </div>
    </div>
  );
};
