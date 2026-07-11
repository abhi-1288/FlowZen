"use client";

import Link from "next/link";

export default function ReferralsDocsPage() {
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
            <Link href="/docs/recruitment/referrals" className="docs-nav-link active">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Referrals</h1>

        <section className="docs-section">
          <p>Manage employee referrals for job openings.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Referrals</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/referrals</code>
            </div>
            <p>Get all referrals with optional filters.</p>

            <div className="docs-code">{"{\n  \"referrals\": [\n    {\n      \"id\": \"...\",\n      \"employee\": { \"id\": \"...\", \"name\": \"John\" },\n      \"candidate\": { \"id\": \"...\", \"firstName\": \"Jane\" },\n      \"job\": { \"id\": \"...\", \"title\": \"Software Engineer\" },\n      \"referralId\": \"REF-001\",\n      \"status\": \"pending\",\n      \"referralBonusEligible\": true\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Referral</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/referrals</code>
            </div>
            <p>Create a new referral for a candidate.</p>

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
                  <td><code>firstName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Candidate first name</td>
                </tr>
                <tr>
                  <td><code>lastName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Candidate last name</td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Candidate email</td>
                </tr>
                <tr>
                  <td><code>phone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Candidate phone</td>
                </tr>
                <tr>
                  <td><code>jobId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Job ID to refer for</td>
                </tr>
                <tr>
                  <td><code>source</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Referral source</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"referral\": {\n    \"id\": \"...\",\n    \"referralId\": \"REF-002\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Referral</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/referrals/[id]</code>
            </div>
            <p>Update referral status.</p>

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
                  <td>Referral ID (path param)</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New status (pending/reviewed/hired/rejected)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"referral\": { ... updated referral }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Referral</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/jobs/[id]/verify-referral</code>
            </div>
            <p>Verify a referral ID is valid (public, no auth required).</p>

            <table className="docs-table">
              <thead>
                <tr>
                  <th>Query Param</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>referralId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Referral ID to verify</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"valid\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Referral Statuses</h2>
          <div className="docs-card">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>pending</code></td>
                  <td>Referral submitted, awaiting review</td>
                </tr>
                <tr>
                  <td><code>reviewed</code></td>
                  <td>Referral has been reviewed</td>
                </tr>
                <tr>
                  <td><code>hired</code></td>
                  <td>Candidate was hired</td>
                </tr>
                <tr>
                  <td><code>rejected</code></td>
                  <td>Candidate was rejected</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
