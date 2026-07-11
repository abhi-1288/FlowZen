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
