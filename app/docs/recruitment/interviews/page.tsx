"use client";

import Link from "next/link";

export default function InterviewsDocsPage() {
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
            <Link href="/docs/recruitment/interviews" className="docs-nav-link active">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Interviews</h1>

        <section className="docs-section">
          <p>Manage interview scheduling, status updates, and feedback collection.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Interviews</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/interviews</code>
            </div>
            <p>Get all interviews with optional filters.</p>

            <div className="docs-code">{"{\n  \"interviews\": [\n    {\n      \"id\": \"...\",\n      \"candidate\": { \"id\": \"...\", \"firstName\": \"John\" },\n      \"job\": { \"id\": \"...\", \"title\": \"Software Engineer\" },\n      \"interviewer\": { \"id\": \"...\", \"name\": \"HR User\" },\n      \"roundType\": \"technical\",\n      \"scheduledAt\": \"2024-01-20T14:00:00Z\",\n      \"meetingLink\": \"https://meet.google.com/...\",\n      \"status\": \"scheduled\",\n      \"feedback\": null\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Interview</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/interviews/[id]</code>
            </div>
            <p>Update interview status or reschedule.</p>

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
                  <td>Interview ID (path param)</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>New status (scheduled/completed/cancelled/rescheduled)</td>
                </tr>
                <tr>
                  <td><code>scheduledAt</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Reschedule date/time (ISO)</td>
                </tr>
                <tr>
                  <td><code>meetingLink</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Updated meeting link</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"interview\": { ... updated interview }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Submit Feedback</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/interviews/[id]/feedback</code>
            </div>
            <p>Submit interview feedback.</p>

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
                  <td><code>technicalSkills</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Rating (1-5)</td>
                </tr>
                <tr>
                  <td><code>communication</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Rating (1-5)</td>
                </tr>
                <tr>
                  <td><code>problemSolving</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Rating (1-5)</td>
                </tr>
                <tr>
                  <td><code>cultureFit</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Rating (1-5)</td>
                </tr>
                <tr>
                  <td><code>overallRecommendation</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Recommendation (strong-hire/hire/hold/reject)</td>
                </tr>
                <tr>
                  <td><code>notes</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Additional notes</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"interview\": { ... updated interview with feedback }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Interview Statuses</h2>
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
                  <td><code>scheduled</code></td>
                  <td>Interview is scheduled</td>
                </tr>
                <tr>
                  <td><code>completed</code></td>
                  <td>Interview completed</td>
                </tr>
                <tr>
                  <td><code>cancelled</code></td>
                  <td>Interview cancelled</td>
                </tr>
                <tr>
                  <td><code>rescheduled</code></td>
                  <td>Interview rescheduled</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Round Types</h2>
          <div className="docs-card">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>screening</code></td>
                  <td>Initial screening</td>
                </tr>
                <tr>
                  <td><code>technical</code></td>
                  <td>Technical interview</td>
                </tr>
                <tr>
                  <td><code>manager</code></td>
                  <td>Manager round</td>
                </tr>
                <tr>
                  <td><code>hr</code></td>
                  <td>HR interview</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
