"use client";

import Link from "next/link";

export default function ApprovalsDocsPage() {
  return (
    <>
      <aside className="docs-sidebar">
        <div className="docs-sidebar-header">
          <h1>FlowZen</h1>
          <p>API Documentation</p>
        </div>
        <nav>
          <div className="docs-nav-section">
            <div className="docs-nav-section-title">Getting Started</div>
            <Link href="/docs" className="docs-nav-link">Overview</Link>
            <Link href="/docs/authentication" className="docs-nav-link">Authentication</Link>
          </div>
          <div className="docs-nav-section">
            <div className="docs-nav-section-title">Public Endpoints</div>
            <Link href="/docs/careers" className="docs-nav-link">Careers</Link>
            <Link href="/docs/careers/apply" className="docs-nav-link">Apply for Job</Link>
            <Link href="/docs/careers/candidate-portal" className="docs-nav-link">Candidate Portal</Link>
            <Link href="/docs/careers/verify" className="docs-nav-link">Verify Identity</Link>
          </div>
          <div className="docs-nav-section">
            <div className="docs-nav-section-title">App Module</div>
            <Link href="/docs/app/dashboard" className="docs-nav-link">Dashboard</Link>
            <Link href="/docs/app/profile" className="docs-nav-link">Profile</Link>
            <Link href="/docs/app/onboarding" className="docs-nav-link">Onboarding</Link>
            <Link href="/docs/app/members" className="docs-nav-link">Members</Link>
            <Link href="/docs/app/visitors" className="docs-nav-link">Visitors</Link>
            <Link href="/docs/app/security" className="docs-nav-link">Security</Link>
            <Link href="/docs/app/documents" className="docs-nav-link">Documents</Link>
            <Link href="/docs/app/approvals" className="docs-nav-link active">Approvals</Link>
            <Link href="/docs/app/messages" className="docs-nav-link">Messages</Link>
            <Link href="/docs/app/finance" className="docs-nav-link">Finance</Link>
            <Link href="/docs/app/attendance" className="docs-nav-link">Attendance</Link>
            <Link href="/docs/app/calendar" className="docs-nav-link">Calendar</Link>
            <Link href="/docs/app/notifications" className="docs-nav-link">Notifications</Link>
          </div>
          <div className="docs-nav-section">
            <div className="docs-nav-section-title">Recruitment</div>
            <Link href="/docs/recruitment/dashboard" className="docs-nav-link">Dashboard</Link>
            <Link href="/docs/recruitment/jobs" className="docs-nav-link">Jobs</Link>
            <Link href="/docs/recruitment/candidates" className="docs-nav-link">Candidates</Link>
            <Link href="/docs/recruitment/interviews" className="docs-nav-link">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Approvals</h1>

        <section className="docs-section">
          <p>Manage approval requests for join requests, salary changes, role transfers, and more.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Approvals</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/approvals</code>
            </div>
            <p>Get all pending approval requests for the current user.</p>

            <p className="docs-note">
              Requests where you are the assigned approver are always yours. As an HR or admin you
              additionally see company-wide requests raised by non-HR members —{" "}
              <strong>except</strong> <code>document-letter</code>, which is{" "}
              <strong>region-scoped</strong>: you only see letters from your own region, with a user
              who has no <code>regionLabel</code> resolving to the main office. If your region has
              nobody holding an approver role, the company-wide list is returned instead rather
              than leaving you with an empty inbox. <code>quit-company</code> requests are never
              region-scoped.
            </p>

            <p className="docs-note">
              As a <strong>nominated co-approver</strong> you get a separate inbox entry for every
              document letter whose <code>signatories[]</code> still has a{" "}
              <code>pending</code> row for you. The letter is listed from the moment it is created,
              not only once HR issues it, so the &ldquo;you may sign later&rdquo; notification always
              links to something. Two fields decorate those entries:{" "}
              <code>signatoryView</code> is always <code>true</code> and tells the client to render
              signature actions instead of approve/reject, and <code>signatureReady</code> says
              whether <code>/letter/[id]</code> already renders without <code>?draft=1</code>. It is
              not an access gate — signing is open before issuance.
            </p>

            <div className="docs-code">{"{\n  \"requests\": [\n    {\n      \"id\": \"...\",\n      \"requester\": { \"id\": \"...\", \"name\": \"John\" },\n      \"kind\": \"company\",\n      \"status\": \"pending\",\n      \"createdAt\": \"2024-01-15T10:30:00Z\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Approval</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/approvals/[id]</code>
            </div>
            <p>Approve or reject an approval request, or record an optional co-signature.</p>

            <p className="docs-note">
              <code>status</code> and <code>sign</code> are mutually exclusive. Sending{" "}
              <code>sign</code> takes an early return{" "}
              <strong>before any status transition</strong>, so a co-approver can never approve,
              reject or otherwise advance a request — see{" "}
              <Link href="/docs/app/documents">Documents</Link> for the full co-signing flow.
            </p>

            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>id</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Request ID (path param)</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New status (approved/hr-approved/rejected)</td>
                </tr>
                <tr>
                  <td><code>force</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Force approval (skip workflow)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rejection reason</td>
                </tr>
                <tr>
                  <td><code>salaryAmount</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Approved salary (for salary requests)</td>
                </tr>
                <tr>
                  <td><code>salaryCurrency</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Currency (for salary requests)</td>
                </tr>
                <tr>
                  <td><code>letterContent</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Letter content (for letter requests)</td>
                </tr>
                <tr>
                  <td><code>signed</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Mark as signed</td>
                </tr>
                <tr>
                  <td><code>sign</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>
                    Record an advisory co-signature on a document letter.{" "}
                    <code>true</code> signs, <code>false</code> declines
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="docs-note">
              The <code>sign</code> branch is only valid for{" "}
              <code>kind: &quot;document-letter&quot;</code> (400 otherwise) and requires the caller
              to hold a <code>pending</code> <code>signatories</code> row on the request, otherwise
              403. Signing is open while the letter is <code>pending</code>,{" "}
              <code>hr-approved</code> or <code>approved</code>; any other status is 409, since a
              rejected letter will never be issued. A signature given before HR approves is retained
              and appears on the letter once it is issued, and the requester is notified either way
              — with an extra &ldquo;All signatures complete&rdquo; notification when the last
              outstanding signature resolves. A decline counts as resolved, so a declined
              co-approver never leaves the letter reading as still waiting. Co-signatures never
              block, delay or revert issuance: HR is the only gate.
            </p>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"approved\"\n  }\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
