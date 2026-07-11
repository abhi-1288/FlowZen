"use client";

import Link from "next/link";

export default function VerifyDocsPage() {
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
            <Link href="/docs/careers/verify" className="docs-nav-link active">Verify Identity</Link>
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
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Verify Identity</h1>

        <section className="docs-section">
          <p>Public endpoints for verifying employee identity codes and visitor passes. These are typically used by security personnel or third-party systems to confirm identity.</p>

          <div className="docs-info">
            <p><strong>Note:</strong> All endpoints below are public and do not require authentication.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Employee Identity</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/verify/[identityCode]</code>
            </div>
            <p>Verify an employee&apos;s company identity code. Returns employee and company info if the code is valid and the ID card has been issued and not revoked.</p>

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
                  <td><code>identityCode</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Employee identity code (path param)</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200) - Verified</h4>
            <div className="docs-code">{"{\n  \"verified\": true,\n  \"name\": \"John Doe\",\n  \"role\": \"Software Engineer\",\n  \"companyIdentityCode\": \"ACME-001\",\n  \"companyJoined\": \"2024-01-15T00:00:00Z\",\n  \"companyStatus\": \"approved\",\n  \"avatarUrl\": \"https://...\",\n  \"company\": {\n    \"name\": \"Acme Corp\",\n    \"icon\": \"https://...\",\n    \"status\": \"active\",\n    \"primaryColor\": \"#6366f1\"\n  }\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200) - Not Verified</h4>
            <div className="docs-code">{"{\n  \"verified\": false,\n  \"reason\": \"not-found\",\n  \"message\": \"No employee found with this ID.\"\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Failure Reasons</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>not-found</code></td>
                  <td>No employee found with this identity code</td>
                </tr>
                <tr>
                  <td><code>revoked</code></td>
                  <td>The ID card has been revoked. Contact HR.</td>
                </tr>
                <tr>
                  <td><code>not-issued</code></td>
                  <td>No ID card has been issued for this employee</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Errors</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>400</code></td>
                  <td>Invalid identity code</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Example</h4>
            <div className="docs-code">{"GET http://localhost:3000/api/public/verify/ACME-001"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Visitor Identity</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/verify-visitor/[identityCode]</code>
            </div>
            <p>Verify a visitor&apos;s identity code. Returns visitor pass details if valid and approved.</p>

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
                  <td><code>identityCode</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Visitor identity code (path param)</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200) - Verified</h4>
            <div className="docs-code">{"{\n  \"verified\": true,\n  \"visitorName\": \"Jane Smith\",\n  \"visitorCompany\": \"Tech Inc\",\n  \"purpose\": \"Meeting\",\n  \"hostName\": \"John Doe\",\n  \"validFrom\": \"2024-02-01T09:00:00Z\",\n  \"validUntil\": \"2024-02-01T17:00:00Z\"\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200) - Not Verified</h4>
            <div className="docs-code">{"{\n  \"verified\": false,\n  \"reason\": \"not-found\"\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Failure Reasons</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>not-found</code></td>
                  <td>No visitor pass found with this identity code</td>
                </tr>
                <tr>
                  <td><code>expired</code></td>
                  <td>Visitor pass has expired</td>
                </tr>
                <tr>
                  <td><code>not-approved</code></td>
                  <td>Visitor pass is not approved (pending or rejected)</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Example</h4>
            <div className="docs-code">{"GET http://localhost:3000/api/public/verify-visitor/VIS789"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
