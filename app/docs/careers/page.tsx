"use client";

import Link from "next/link";

export default function CareersDocsPage() {
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
            <Link href="/docs/careers" className="docs-nav-link active">Careers</Link>
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
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Careers (Public)</h1>

        <section className="docs-section">
          <p>Public endpoints for job listings, applications, and candidate portals. These endpoints require <strong>no authentication</strong> and are accessible to anyone.</p>

          <div className="docs-info">
            <p><strong>Note:</strong> All endpoints below are public and do not require any authentication token.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get All Open Jobs</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/jobs</code>
            </div>
            <p>Get all open job listings grouped by company. No authentication required.</p>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"companies\": [\n    {\n      \"company\": {\n        \"id\": \"...\",\n        \"name\": \"Acme Corp\",\n        \"icon\": \"...\"\n      },\n      \"jobs\": [\n        {\n          \"id\": \"...\",\n          \"title\": \"Software Engineer\",\n          \"department\": \"Engineering\",\n          \"location\": \"Remote\",\n          \"employmentType\": \"full-time\",\n          \"salaryRangeMin\": 80000,\n          \"salaryRangeMax\": 120000,\n          \"salaryType\": \"per-annum\",\n          \"currency\": \"USD\",\n          \"openings\": 3,\n          \"description\": \"...\",\n          \"requiredSkills\": [\"React\", \"Node.js\"],\n          \"status\": \"open\",\n          \"createdAt\": \"2024-01-15T10:30:00Z\"\n        }\n      ]\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Job Details</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/jobs/[id]</code>
            </div>
            <p>Get details of a specific open job.</p>

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
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"job\": {\n    \"id\": \"...\",\n    \"title\": \"Software Engineer\",\n    \"department\": \"Engineering\",\n    \"location\": \"Remote\",\n    \"employmentType\": \"full-time\",\n    \"salaryRangeMin\": 80000,\n    \"salaryRangeMax\": 120000,\n    \"description\": \"...\",\n    \"requiredSkills\": [\"React\", \"Node.js\"],\n    \"company\": {\n      \"id\": \"...\",\n      \"name\": \"Acme Corp\",\n      \"icon\": \"...\"\n    }\n  }\n}"}</div>

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
                  <td><code>404</code></td>
                  <td>Job not found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Referral</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/jobs/[id]/verify-referral</code>
            </div>
            <p>Verify a referral ID is valid for a specific job.</p>

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

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"name\": \"John Doe\",\n  \"company\": \"Acme Corp\"\n}"}</div>

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
                  <td>referralId query parameter is required</td>
                </tr>
                <tr>
                  <td><code>404</code></td>
                  <td>Job not found / Referral employee not found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Identity Code</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/verify/[identityCode]</code>
            </div>
            <p>Verify an employee&apos;s identity code. Returns employee info if valid.</p>

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
                  <td>Identity code (path param)</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200) - Verified</h4>
            <div className="docs-code">{"{\n  \"verified\": true,\n  \"name\": \"John Doe\",\n  \"role\": \"Software Engineer\",\n  \"companyIdentityCode\": \"ACME-001\",\n  \"companyJoined\": \"2024-01-15T00:00:00Z\",\n  \"avatarUrl\": \"...\",\n  \"company\": {\n    \"name\": \"Acme Corp\",\n    \"icon\": \"...\",\n    \"status\": \"active\",\n    \"primaryColor\": \"#6366f1\"\n  }\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200) - Not Verified</h4>
            <div className="docs-code">{"{\n  \"verified\": false,\n  \"reason\": \"not-found\",\n  \"message\": \"No employee found with this ID.\"\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Reasons</h4>
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
                  <td>ID card has been revoked</td>
                </tr>
                <tr>
                  <td><code>not-issued</code></td>
                  <td>No ID card has been issued</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Visitor Identity</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/verify-visitor/[identityCode]</code>
            </div>
            <p>Verify a visitor&apos;s identity code.</p>

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

            <div className="docs-code">{"{\n  \"verified\": true,\n  \"visitorName\": \"Jane Smith\",\n  \"purpose\": \"Meeting\",\n  \"hostName\": \"John Doe\"\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Visitor Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/visitor/event/[slug]</code>
            </div>
            <p>Get visitor event details by slug.</p>

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
                  <td><code>slug</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Event slug (path param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"event\": {\n    \"id\": \"...\",\n    \"slug\": \"tech-meetup-2024\",\n    \"visitorCompany\": \"Tech Inc\",\n    \"expectedDate\": \"2024-02-01\",\n    \"purpose\": \"Tech Meetup\",\n    \"hostName\": \"John Doe\",\n    \"status\": \"upcoming\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Register for Visitor Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/public/visitor/register/[slug]</code>
            </div>
            <p>Register as a visitor for an event.</p>

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
                  <td><code>slug</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Event slug (path param)</td>
                </tr>
                <tr>
                  <td><code>visitorName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Your full name</td>
                </tr>
                <tr>
                  <td><code>visitorEmail</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Your email</td>
                </tr>
                <tr>
                  <td><code>visitorPhone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Your phone number</td>
                </tr>
                <tr>
                  <td><code>purpose</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Purpose of visit</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (201)</h4>
            <div className="docs-code">{"{\n  \"pass\": {\n    \"id\": \"...\",\n    \"status\": \"pending\",\n    \"identityCode\": \"VIS789\"\n  }\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
