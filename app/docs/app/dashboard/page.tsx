"use client";

import Link from "next/link";

export default function DashboardDocsPage() {
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
            <Link href="/docs/app/dashboard" className="docs-nav-link active">Dashboard</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

        <section className="docs-section">
          <p>The Dashboard module provides company overview data and quick stats for the mobile app home screen.</p>
        </section>

        <section className="docs-section">
          <h2>Get Company Info</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company</code>
            </div>
            <p>Get current user&apos;s company details.</p>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response</h4>
            <div className="docs-code">{"{\n  \"company\": {\n    \"id\": \"...\",\n    \"name\": \"Acme Corp\",\n    \"status\": \"active\",\n    \"joinCode\": \"ABC123\",\n    \"primaryColor\": \"#6366f1\",\n    \"icon\": \"...\",\n    \"address\": \"...\",\n    \"members\": [\"userId1\", \"userId2\"],\n    \"noticePeriodDays\": 30,\n    \"paidLeaveDays\": 12,\n    \"wfhDays\": 5,\n    \"minWorkHours\": 8\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Users</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/users</code>
            </div>
            <p>Get all users in the company.</p>

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
                  <td><code>role</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Filter by role (admin, human-resource, etc.)</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response</h4>
            <div className="docs-code">{"{\n  \"users\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"John Doe\",\n      \"email\": \"john@example.com\",\n      \"role\": \"employee\",\n      \"avatarUrl\": \"...\",\n      \"company\": \"companyId\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Company Admins</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company/admins</code>
            </div>
            <p>Get all company administrators.</p>

            <div className="docs-code">{"{\n  \"admins\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"Admin User\",\n      \"email\": \"admin@example.com\",\n      \"role\": \"admin\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Company HRs</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company/hrs</code>
            </div>
            <p>Get all HR members in the company.</p>

            <div className="docs-code">{"{\n  \"hrs\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"HR User\",\n      \"email\": \"hr@example.com\",\n      \"role\": \"human-resource\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Member Birthdays</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company/members/birthdays</code>
            </div>
            <p>Get upcoming member birthdays.</p>

            <div className="docs-code">{"{\n  \"birthdays\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"John\",\n      \"dob\": \"1990-05-15\",\n      \"avatarUrl\": \"...\"\n    }\n  ]\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
