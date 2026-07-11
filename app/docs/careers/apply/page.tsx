"use client";

import Link from "next/link";

export default function ApplyDocsPage() {
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
            <Link href="/docs/careers/apply" className="docs-nav-link active">Apply for Job</Link>
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
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Apply for Job</h1>

        <section className="docs-section">
          <p>Submit a job application. This endpoint accepts <strong>multipart/form-data</strong> (for resume upload).</p>

          <div className="docs-info">
            <p><strong>Note:</strong> This is a public endpoint. No authentication required.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Submit Application</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/public/jobs/[id]/apply</code>
            </div>
            <p>Apply for a specific job. Requires multipart/form-data for resume upload.</p>

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
                  <td>Job ID (path param)</td>
                </tr>
                <tr>
                  <td><code>firstName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>First name</td>
                </tr>
                <tr>
                  <td><code>lastName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Last name</td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Email address</td>
                </tr>
                <tr>
                  <td><code>phone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Phone number</td>
                </tr>
                <tr>
                  <td><code>currentCompany</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Current company</td>
                </tr>
                <tr>
                  <td><code>experienceYears</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Years of experience</td>
                </tr>
                <tr>
                  <td><code>noticePeriod</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Notice period in days</td>
                </tr>
                <tr>
                  <td><code>resume</code></td>
                  <td>file</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Resume file (PDF, max 20MB)</td>
                </tr>
                <tr>
                  <td><code>portfolioUrl</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Portfolio URL</td>
                </tr>
                <tr>
                  <td><code>linkedInUrl</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>LinkedIn profile URL</td>
                </tr>
                <tr>
                  <td><code>notes</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Additional notes</td>
                </tr>
                <tr>
                  <td><code>referralId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Employee referral ID</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (201)</h4>
            <div className="docs-code">{"{\n  \"success\": true,\n  \"candidateId\": \"...\"\n}"}</div>

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
                  <td>First name is required / Resume is required</td>
                </tr>
                <tr>
                  <td><code>400</code></td>
                  <td>Resume exceeds 20 MB limit</td>
                </tr>
                <tr>
                  <td><code>400</code></td>
                  <td>This job is no longer accepting applications</td>
                </tr>
                <tr>
                  <td><code>404</code></td>
                  <td>Job not found</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Example (cURL)</h4>
            <div className="docs-code">{"curl -X POST http://localhost:3000/api/public/jobs/JOB_ID/apply \\\n  -F \"firstName=John\" \\\n  -F \"lastName=Doe\" \\\n  -F \"email=john@example.com\" \\\n  -F \"phone=+1234567890\" \\\n  -F \"resume=@resume.pdf\" \\\n  -F \"referralId=ACME-001\""}</div>
          </div>
        </section>
      </main>
    </>
  );
}
