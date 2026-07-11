"use client";

import Link from "next/link";

export default function NotificationsDocsPage() {
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
            <Link href="/docs/app/notifications" className="docs-nav-link active">Notifications</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Notifications</h1>

        <section className="docs-section">
          <p>Manage user notifications for approvals, system updates, and alerts.</p>
        </section>

        <section className="docs-section">
          <h2>Get Notifications</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/notifications</code>
            </div>
            <p>Get paginated notifications for the current user.</p>

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
                  <td><code>page</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Page number (default: 1)</td>
                </tr>
                <tr>
                  <td><code>limit</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Items per page (default: 20)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"notifications\": [\n    {\n      \"id\": \"...\",\n      \"type\": \"approval\",\n      \"title\": \"New Join Request\",\n      \"message\": \"John Doe requested to join the company\",\n      \"body\": \"...\",\n      \"link\": \"/approvals\",\n      \"readAt\": null,\n      \"createdAt\": \"2024-01-15T10:30:00Z\"\n    }\n  ],\n  \"total\": 50,\n  \"unreadCount\": 5\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Mark All Read</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/notifications</code>
            </div>
            <p>Mark all notifications as read.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete All Read</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/notifications</code>
            </div>
            <p>Delete all read notifications.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Mark Notification Read</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/notifications/[id]</code>
            </div>
            <p>Mark a specific notification as read.</p>

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
                  <td>Notification ID (path param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"notification\": {\n    \"id\": \"...\",\n    \"readAt\": \"2024-01-15T11:00:00Z\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Notification</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/notifications/[id]</code>
            </div>
            <p>Delete a specific notification.</p>

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
                  <td>Notification ID (path param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Notification Types</h2>
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
                  <td><code>info</code></td>
                  <td>General information</td>
                </tr>
                <tr>
                  <td><code>approval</code></td>
                  <td>Approval request notifications</td>
                </tr>
                <tr>
                  <td><code>project</code></td>
                  <td>Project-related updates</td>
                </tr>
                <tr>
                  <td><code>deadline</code></td>
                  <td>Deadline reminders</td>
                </tr>
                <tr>
                  <td><code>system</code></td>
                  <td>System notifications</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
