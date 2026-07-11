"use client";

import Link from "next/link";

export default function MessagesDocsPage() {
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
            <Link href="/docs/app/messages" className="docs-nav-link active">Messages</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Messages</h1>

        <section className="docs-section">
          <p>Internal messaging system for team communication.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Messages</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/messages</code>
            </div>
            <p>Get all messages for the current user.</p>

            <div className="docs-code">{"{\n  \"messages\": [\n    {\n      \"id\": \"...\",\n      \"sender\": { \"id\": \"...\", \"name\": \"John\", \"avatarUrl\": \"...\" },\n      \"recipient\": { \"id\": \"...\", \"name\": \"Jane\" },\n      \"message\": \"Hello!\",\n      \"receivedAt\": \"2024-01-15T10:30:00Z\",\n      \"readAt\": null\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Send Message</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/messages</code>
            </div>
            <p>Send a message to another user.</p>

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
                  <td><code>recipient</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Recipient user ID</td>
                </tr>
                <tr>
                  <td><code>message</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Message content</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"message\": {\n    \"id\": \"...\",\n    \"message\": \"Hello!\",\n    \"receivedAt\": \"2024-01-15T10:30:00Z\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Conversation</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/messages/conversation</code>
            </div>
            <p>Get conversation with a specific user.</p>

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
                  <td><code>userId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>User ID to get conversation with</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"messages\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Unread Count</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/messages/unread-count</code>
            </div>
            <p>Get count of unread messages.</p>

            <div className="docs-code">{"{\n  \"count\": 5\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
