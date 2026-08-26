import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "FlowZen Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  const updated = "August 26, 2026";

  return (
    <div className="min-h-screen bg-[var(--c-bg)] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          &larr; Back to FlowZen
        </Link>

        <div className="neu-card rounded-2xl p-8 dark:bg-[#000000] dark:border-zinc-800">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-zinc-100">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Last updated: {updated}
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                1. Introduction
              </h2>
              <p>
                Welcome to FlowZen (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to
                protecting your personal information and your right to privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use
                our platform, including our website, mobile applications, and related services
                (collectively, the &quot;Service&quot;).
              </p>
              <p className="mt-2">
                By using the Service, you agree to the collection and use of information in
                accordance with this policy. If you do not agree, please discontinue use of the
                Service.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                2. Information We Collect
              </h2>
              <p className="font-medium">Personal Information you provide:</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Name, email address, and password (during account registration)</li>
                <li>Profile information (avatar, role, designation)</li>
                <li>Company information (name, logo, address)</li>
                <li>Payment and billing information (for paid plans)</li>
                <li>Any content you upload or create within the Service</li>
              </ul>
              <p className="mt-3 font-medium">Automatically collected information:</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Device type, browser type, and operating system</li>
                <li>IP address and approximate geolocation</li>
                <li>Pages visited, features used, and interaction patterns</li>
                <li>Log data including timestamps and error reports</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                3. How We Use Your Information
              </h2>
              <p>We use the information we collect to:</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Provide, operate, and maintain the Service</li>
                <li>Process transactions and send related information (receipts, invoices)</li>
                <li>Send administrative notifications (service updates, security alerts)</li>
                <li>Personalize your experience and deliver content relevant to your interests</li>
                <li>Monitor and analyze usage trends to improve the Service</li>
                <li>Detect, prevent, and address technical issues and fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                4. Cookies and Tracking Technologies
              </h2>
              <p>
                We use cookies and similar technologies to maintain your session, remember your
                preferences, and understand how you interact with the Service. Essential cookies are
                required for the Service to function (e.g., authentication sessions). You may control
                non-essential cookies through your browser settings or our cookie consent banner.
              </p>
              <p className="mt-2">Types of cookies we use:</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li><span className="font-medium">Session cookies:</span> Required for authentication and keeping you logged in</li>
                <li><span className="font-medium">Preference cookies:</span> Remember your theme, language, and display settings</li>
                <li><span className="font-medium">Analytics cookies:</span> Help us understand how the Service is used (opt-in only)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                5. How We Share Your Information
              </h2>
              <p>We do not sell your personal information. We may share information with:</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li><span className="font-medium">Service providers:</span> Third-party vendors who assist in operating the Service (hosting, analytics, email delivery), bound by contractual obligations to protect your data</li>
                <li><span className="font-medium">Company members:</span> If you are part of an organization on FlowZen, certain profile information may be visible to other members and administrators of that organization</li>
                <li><span className="font-medium">Legal requirements:</span> When required by law, regulation, or valid legal process</li>
                <li><span className="font-medium">Business transfers:</span> In connection with a merger, acquisition, or sale of assets, with prior notice</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                6. Data Retention
              </h2>
              <p>
                We retain your personal information only for as long as necessary to provide the
                Service and fulfill the purposes described in this policy. When you delete your
                account, we will remove your personal data within 30 days, except where we are
                required to retain certain information for legal or legitimate business purposes.
                Company data may be retained for up to 90 days after the last active member leaves
                the organization.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                7. Data Security
              </h2>
              <p>
                We implement industry-standard security measures including encryption in transit
                (TLS/HTTPS), encryption at rest, access controls, and regular security audits.
                However, no method of electronic transmission or storage is 100% secure, and we
                cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                8. Your Rights
              </h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to or restrict the processing of your data</li>
                <li>Data portability — receive your data in a structured, machine-readable format</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact us at{" "}
                <a
                  href="mailto:support@flowzen.app"
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  support@flowzen.app
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                9. International Data Transfers
              </h2>
              <p>
                Your information may be transferred to and processed in countries other than your own.
                We ensure appropriate safeguards are in place for such transfers, including
                standard contractual clauses where required by applicable law.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                10. Children&apos;s Privacy
              </h2>
              <p>
                The Service is not intended for individuals under 16 years of age. We do not
                knowingly collect personal information from children. If you become aware that a
                child has provided us with personal information, please contact us so we can take
                steps to delete it.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                11. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the new policy on this page and updating the &quot;Last
                updated&quot; date. Continued use of the Service after changes constitutes acceptance
                of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                12. Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy or our data practices, contact us at:
              </p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  Email:{" "}
                  <a
                    href="mailto:support@flowzen.app"
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    support@flowzen.app
                  </a>
                </li>
                <li>GitHub:{" "}
                  <a
                    href="https://github.com/abhi-1288"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    github.com/abhi-1288
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
