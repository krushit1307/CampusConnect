export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="neu-border inline-block w-fit bg-black px-3 py-1 shadow-[4px_4px_0_0_#000]">
        <span className="font-display text-lg font-black text-lime">Privacy Policy</span>
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-black">
        Last updated: {new Date().getFullYear()}
      </p>

      <div className="mt-8 space-y-6 font-mono text-sm leading-relaxed text-black">
        <p>
          CampusConnect is a community-built, open-source project. This page is a placeholder
          Privacy Policy while the full policy is being written.
        </p>
        <p>
          In short: we only collect the information needed to run club events, RSVPs, and discussion
          features (such as your name, email, and activity within the app), and we don&apos;t sell
          your data to third parties.
        </p>
        <p>
          Questions about your data? Reach out to the maintainers via the{" "}
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
