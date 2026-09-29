"use client";

import Link from "next/link";

export default function DocumentsDocsPage() {
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
            <Link href="/docs/app/documents" className="docs-nav-link active">Documents</Link>
            <Link href="/docs/app/approvals" className="docs-nav-link">Approvals</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Documents</h1>

        <section className="docs-section">
          <p>Manage document requests, document categories, and letter requests.</p>
        </section>

        <section className="docs-section">
          <h2>Get Document Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/documents/my</code>
            </div>
            <p>Get current user&apos;s document requests.</p>

            <div className="docs-code">{"{\n  \"requests\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Document Categories</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/document-categories</code>
            </div>
            <p>Get all document categories for the company.</p>

            <div className="docs-code">{"{\n  \"categories\": [\n    \"identity\",\n    \"address-proof\",\n    \"education\",\n    \"experience\"\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Document Categories</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/document-categories</code>
            </div>
            <p>Update document categories (HR only).</p>

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
                  <td><code>categories</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of category names</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"company\": { ... updated company }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Letter Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/document-letter</code>
            </div>
            <p>Get all letter requests for the company.</p>

            <p className="docs-note">
              HR and admins see every letter in the company. Anyone else sees the letters they
              requested <strong>plus</strong> any letter they are listed on in{" "}
              <code>signatories[]</code> — a nominated co-approver has to be able to open the letter
              in order to sign it, even though they did not request it. Nobody else can see it.
            </p>

            <p className="docs-note">
              Pass <code>?plan=1</code> to preview the approver plan that would be assigned to the
              current requester:{" "}
              <code>
                {"{ region, primary: { id, name, role } | null, teamOwner: { user, slot, name, role } | null, teamOwnerBlockedReason, maxCoApprovers }"}
              </code>
              . This is what powers the one-click &ldquo;add my team owner&rdquo; suggestion — the
              server never adds anyone automatically.
            </p>

            <p className="docs-note">
              <code>teamOwnerBlockedReason</code> is <code>&quot;out-of-region&quot;</code> when the
              requester has a team owner who cannot be nominated because they are outside the
              requester&apos;s region. The team owner is then omitted from <code>teamOwner</code> and
              the modal shows the suggestion disabled with a reason, instead of a button that would
              be silently dropped. It is <code>&quot;&quot;</code> whenever a <code>teamOwner</code>{" "}
              is returned.
            </p>

            <div className="docs-code">{"{\n  \"letters\": [\n    {\n      \"id\": \"...\",\n      \"requester\": { \"id\": \"...\", \"name\": \"John\" },\n      \"letterType\": \"experience\",\n      \"status\": \"pending\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Letter Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/document-letter</code>
            </div>
            <p>Create a new letter request (experience, salary, etc.).</p>

            <p className="docs-note">
              The <strong>approving HR is required and is the only gate</strong> — the letter is
              issued as soon as they approve. The primary is never the requester: the order is
              another in-region HR, an in-region admin, any company HR, then any company admin.
              An explicit <code>approverId</code> is rejected with 400 unless it is an HR in the
              requester&apos;s region (a senior security user is also accepted for junior-security
              requesters).
            </p>

            <p className="docs-note">
              <strong>Co-approvers are optional, manual, and never block.</strong> Nothing is added
              for you: the requester picks up to 3 co-approvers via{" "}
              <code>coApproverIds</code>, all region-scoped, and the modal also offers their team
              owner as a one-click suggestion (<code>teamOwnerId</code>) that counts toward the
              same cap of 3. The team owner is skipped when the requester manages that team
              themselves, and is only accepted when it really is their team owner. If their
              team owner sits in another region the modal shows the suggestion greyed out with
              the reason instead of adding them. They are notified as soon as the
              letter is requested and can sign or decline straight away — before
              HR approves it on <code>/letter/[id]?draft=1</code>, or after on{" "}
              <code>/letter/[id]</code>; a signature given early is carried onto
              the letter when it is issued. Their silence or a decline never
              delays, blocks or reverts the letter. Eligible co-approver
              roles are <code>human-resource</code>, <code>finance</code>, <code>admin</code>,{" "}
              <code>project-manager</code>, <code>qa-tester</code> and <code>it-admin</code>. The
              primary approver, the requester and duplicates are dropped automatically. When your
              own region is the main office, a co-approver who has no region set on their profile
              counts as being in it, which matches the region shown on their profile.
            </p>

            <p className="docs-note">
              Signatures are recorded with <code>PATCH /api/approvals/[id]</code> and a{" "}
              <code>sign</code> boolean — see <Link href="/docs/app/approvals">Approvals</Link>.
              Re-submitting the same letter type while one is pending reuses that request and{" "}
              <strong>keeps signatures already collected</strong>: a row still in the new plan and
              already <code>signed</code> or <code>declined</code> keeps its status and timestamp.
              Only genuinely new nominees start as <code>pending</code>.
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
                  <td><code>requester</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>User ID requesting the letter</td>
                </tr>
                <tr>
                  <td><code>letterType</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Type of letter (experience/salary)</td>
                </tr>
                <tr>
                  <td><code>approverId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>
                    Explicit primary approver. Must be <code>human-resource</code> in the
                    requester&apos;s region (a senior security user is also accepted for
                    junior-security requesters), otherwise 400
                  </td>
                </tr>
                <tr>
                  <td><code>coApproverIds</code></td>
                  <td>string[]</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>
                    Up to 3 advisory co-approvers, in the requester&apos;s region, in the order
                    picked. A lone string or a single <code>coApproverId</code> value is also
                    accepted
                  </td>
                </tr>
                <tr>
                  <td><code>teamOwnerId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>
                    The requester&apos;s team owner, from the one-click suggestion. Ignored unless
                    it really is their team owner, and ignored when they are out of region
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Letter Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/document-letter/[id]</code>
            </div>
            <p>Update letter request status (approve/reject).</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Sign or Decline a Letter</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/approvals/[id]</code>
            </div>
            <p>Record an advisory co-signature on a document letter you were nominated on.</p>

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
                  <td><code>sign</code></td>
                  <td>boolean</td>
                  <td><span className="badge-required">Required</span></td>
                  <td><code>true</code> signs, <code>false</code> declines to sign</td>
                </tr>
              </tbody>
            </table>

            <p className="docs-note">
              This takes an early return <strong>before any status transition</strong>, so a
              co-approver can never approve, reject or otherwise advance a request. It is only valid
              for document letters, and the caller must hold a <code>pending</code>{" "}
              <code>signatories</code> row on the request — otherwise 403. Signing is open while
              the letter is <code>pending</code>, <code>hr-approved</code> or{" "}
              <code>approved</code>; any other status is 409, because a rejected letter will never
              be issued. Letters awaiting your signature are listed in your own inbox via{" "}
              <code>GET /api/approvals</code> — see{" "}
              <Link href="/docs/app/approvals">Approvals</Link>.
            </p>

            <div className="docs-code">{"{\n  \"ok\": true,\n  \"request\": { \"id\": \"...\", \"status\": \"pending\" }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request ID Card</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/id-card/request</code>
            </div>
            <p>Request a new ID card. The approver is region-scoped exactly like a document letter.</p>

            <p className="docs-note">
              Eligible approver roles are <code>human-resource</code>, <code>finance</code>,{" "}
              <code>admin</code>, <code>project-manager</code>, <code>qa-tester</code> and{" "}
              <code>it-admin</code>. A <strong>junior security</strong> requester may also assign to
              a <strong>senior security</strong> member. An out-of-region pick is rejected with 400
              — but only when the requester&apos;s region actually has an eligible approver,
              otherwise nobody there could submit a request at all.
            </p>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Bank Details</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/documents/verify-bank</code>
            </div>
            <p>Verify bank details for a document.</p>

            <div className="docs-code">{"{\n  \"verified\": true\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
