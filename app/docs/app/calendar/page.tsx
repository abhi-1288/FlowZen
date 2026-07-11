"use client";

import Link from "next/link";

export default function CalendarDocsPage() {
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
            <Link href="/docs/app/calendar" className="docs-nav-link active">Calendar</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Calendar</h1>

        <section className="docs-section">
          <p>Manage events and meetings for your organization.</p>
        </section>

        <section className="docs-section">
          <h2>Get Events</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/events</code>
            </div>
            <p>Get calendar events with optional filters.</p>

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
                  <td><code>start</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Start date filter (ISO)</td>
                </tr>
                <tr>
                  <td><code>end</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>End date filter (ISO)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"events\": [\n    {\n      \"id\": \"...\",\n      \"title\": \"Team Meeting\",\n      \"date\": \"2024-01-15\",\n      \"time\": \"10:00\",\n      \"type\": \"meeting\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Meetings</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company/meetings</code>
            </div>
            <p>Get company meetings for a specific date.</p>

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
                  <td><code>date</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Date filter (YYYY-MM-DD)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"meetings\": [\n    {\n      \"id\": \"...\",\n      \"title\": \"Sprint Planning\",\n      \"description\": \"Weekly sprint planning\",\n      \"meetingType\": \"online\",\n      \"meetingLink\": \"https://meet.google.com/...\",\n      \"date\": \"2024-01-15\",\n      \"time\": \"10:00\",\n      \"durationMinutes\": 60,\n      \"participants\": [\"userId1\", \"userId2\"],\n      \"status\": \"scheduled\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Meeting</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/company/meetings</code>
            </div>
            <p>Create a new meeting.</p>

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
                  <td><code>title</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Meeting title</td>
                </tr>
                <tr>
                  <td><code>description</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Meeting description</td>
                </tr>
                <tr>
                  <td><code>meetingType</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Type (online/offsite)</td>
                </tr>
                <tr>
                  <td><code>meetingLink</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Online meeting link</td>
                </tr>
                <tr>
                  <td><code>location</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Physical location</td>
                </tr>
                <tr>
                  <td><code>date</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Meeting date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>time</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Meeting time (HH:MM)</td>
                </tr>
                <tr>
                  <td><code>durationMinutes</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Duration in minutes</td>
                </tr>
                <tr>
                  <td><code>participants</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of user IDs</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"meeting\": {\n    \"id\": \"...\",\n    \"title\": \"Sprint Planning\",\n    \"status\": \"scheduled\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Meeting</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/company/meetings/[id]</code>
            </div>
            <p>Update meeting details or status.</p>

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
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>New status (scheduled/completed/cancelled)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"meeting\": { ... updated meeting }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Send Meeting Invite</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/meeting-invite</code>
            </div>
            <p>Send meeting invites to users.</p>

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
                  <td><code>meetingId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Meeting ID</td>
                </tr>
                <tr>
                  <td><code>userIds</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of user IDs to invite</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
