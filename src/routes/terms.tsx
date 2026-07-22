export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="neu-border inline-block w-fit bg-black px-3 py-1 shadow-[4px_4px_0_0_var(--color-ink)]">
        <span className="font-display text-lg font-black text-lime">Terms of Service</span>
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-black">
        Last updated: {new Date().getFullYear()}
      </p>

      <div className="mt-8 space-y-6 font-mono text-sm leading-relaxed text-black">
        <p>
          CampusConnect is a community-built, open-source project. This page is a placeholder Terms
          of Service while the full terms are being written.
        </p>
        <p>
          By using CampusConnect, you agree to use the platform respectfully, follow your
          institution&apos;s code of conduct, and not misuse features such as event RSVPs, the
          discussion feed, or reporting tools.
        </p>
        <p>
          Questions about these terms? Reach out to the maintainers via the{" "}
          <a
            href="https://github.com/krushit1307/CampusConnect"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-4"
          >
            GitHub repository
          </a>
          .
        </p>
      </div>
    </div>
  );
}
