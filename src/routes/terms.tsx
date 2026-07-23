export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
      {/* Header Badge */}
      <div className="neu-border inline-block bg-black px-4 py-2 shadow-[6px_6px_0_0_var(--color-ink)]">
        <span className="font-mono text-xl font-black uppercase text-lime">Terms of Service</span>
      </div>

      <p className="mt-4 font-mono text-xs font-bold uppercase tracking-widest text-gray-600">
        Last updated: {new Date().getFullYear()}
      </p>

      {/* Content Container */}
      <div className="mt-8 space-y-6">
        <div className="neu-border bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)] md:p-8">
          <h3 className="font-mono text-base font-black uppercase tracking-wider text-black mb-3">
            01. Open Source Community
          </h3>
          <p className="font-mono text-sm leading-relaxed text-black">
            CampusConnect is a community-built, open-source project. This page serves as a temporary
            Terms of Service placeholder while full legal documentation is being developed.
          </p>
        </div>

        <div className="neu-border bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)] md:p-8">
          <h3 className="font-mono text-base font-black uppercase tracking-wider text-black mb-3">
            02. Acceptable Use Policy
          </h3>
          <p className="font-mono text-sm leading-relaxed text-black">
            By using CampusConnect, you agree to use the platform respectfully, follow your
            institution&apos;s code of conduct, and refrain from misusing features such as event
            RSVPs, the discussion feed, or reporting tools.
          </p>
        </div>

        <div className="neu-border bg-peach p-6 shadow-[6px_6px_0_0_var(--color-ink)] md:p-8">
          <h3 className="font-mono text-base font-black uppercase tracking-wider text-black mb-3">
            03. Questions & Feedback
          </h3>
          <p className="font-mono text-sm leading-relaxed text-black">
            Have questions about these terms or spot an issue? Reach out to the maintainers directly
            via the{" "}
            <a
              href="https://github.com/krushit1307/CampusConnect"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-4 hover:bg-black hover:text-lime px-1 transition-colors"
            >
              GitHub repository
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
