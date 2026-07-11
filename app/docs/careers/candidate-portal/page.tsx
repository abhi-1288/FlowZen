"use client";

import Link from "next/link";

export default function CandidatePortalDocsPage() {
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
            <Link href="/docs/careers/candidate-portal" className="docs-nav-link active">Candidate Portal</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Candidate Portal</h1>

        <section className="docs-section">
          <p>Endpoints for candidates to view their application status, respond to offers, and download offer letters. Authentication is via a magic token sent to the candidate&apos;s email.</p>

          <div className="docs-info">
            <p><strong>Auth:</strong> All endpoints require a <code>token</code> query parameter. This token is sent to the candidate via email after applying.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Candidate Profile</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/candidate/me</code>
            </div>
            <p>Get candidate profile, timeline, interviews, and offer details.</p>

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
                  <td><code>token</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Magic token from email</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"candidate\": {\n    \"id\": \"...\",\n    \"firstName\": \"John\",\n    \"lastName\": \"Doe\",\n    \"email\": \"john@example.com\",\n    \"stage\": \"screening\",\n    \"job\": {\n      \"title\": \"Software Engineer\",\n      \"department\": \"Engineering\",\n      \"location\": \"Remote\"\n    }\n  },\n  \"timeline\": [\n    {\n      \"action\": \"applied\",\n      \"createdAt\": \"2024-01-15T10:30:00Z\"\n    }\n  ],\n  \"interviews\": [\n    {\n      \"roundType\": \"technical\",\n      \"scheduledAt\": \"2024-01-20T14:00:00Z\",\n      \"interviewer\": { \"name\": \"HR User\" }\n    }\n  ],\n  \"offer\": {\n    \"offeredCTC\": 120000,\n    \"designation\": \"Senior Engineer\",\n    \"status\": \"sent\"\n  }\n}"}</div>

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
                  <td>Token is required</td>
                </tr>
                <tr>
                  <td><code>401</code></td>
                  <td>Invalid or expired link</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Respond to Offer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/public/candidate/me/offer</code>
            </div>
            <p>Accept or reject a job offer.</p>

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
                  <td><code>token</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Magic token from email</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Request Body</h4>
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
                  <td><code>action</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Action (accept/reject)</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"offer\": {\n    \"id\": \"...\",\n    \"status\": \"accepted\",\n    \"offeredCTC\": 120000\n  }\n}"}</div>

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
                  <td>action must be &apos;accept&apos; or &apos;reject&apos;</td>
                </tr>
                <tr>
                  <td><code>400</code></td>
                  <td>Offer is not in a pending state</td>
                </tr>
                <tr>
                  <td><code>404</code></td>
                  <td>No offer found</td>
                </tr>
                <tr>
                  <td><code>401</code></td>
                  <td>Invalid or expired link</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Offer Letter</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/candidate/me/letter</code>
            </div>
            <p>Download the offer letter as HTML.</p>

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
                  <td><code>token</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Magic token from email</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-info">
              <p>Returns HTML content with <code>Content-Type: text/html</code></p>
            </div>

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
                  <td>No offer found for this candidate</td>
                </tr>
                <tr>
                  <td><code>401</code></td>
                  <td>Invalid or expired link</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
