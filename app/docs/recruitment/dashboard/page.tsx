"use client";

import Link from "next/link";

export default function RecruitmentDashboardDocsPage() {
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
            <Link href="/docs/recruitment/dashboard" className="docs-nav-link active">Dashboard</Link>
            <Link href="/docs/recruitment/jobs" className="docs-nav-link">Jobs</Link>
            <Link href="/docs/recruitment/candidates" className="docs-nav-link">Candidates</Link>
            <Link href="/docs/recruitment/interviews" className="docs-nav-link">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Recruitment Dashboard</h1>

        <section className="docs-section">
          <p>Overview statistics and metrics for the recruitment module.</p>
        </section>

        <section className="docs-section">
          <h2>Get Dashboard Stats</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/dashboard</code>
            </div>
            <p>Get recruitment dashboard statistics.</p>

            <div className="docs-code">{"{\n  \"stats\": {\n    \"totalJobs\": 15,\n    \"openJobs\": 8,\n    \"totalCandidates\": 120,\n    \"candidatesInProgress\": 45,\n    \"offersExtended\": 12,\n    \"offersAccepted\": 8,\n    \"interviewsScheduled\": 20\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Sidebar Counts</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/sidebar-counts</code>
            </div>
            <p>Get sidebar badge counts for each section.</p>

            <div className="docs-code">{"{\n  \"counts\": {\n    \"jobs\": 8,\n    \"candidates\": 45,\n    \"interviews\": 12,\n    \"offers\": 5,\n    \"referrals\": 3\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Assigned Count</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/assigned-count</code>
            </div>
            <p>Get count of items assigned to current user.</p>

            <div className="docs-code">{"{\n  \"count\": 12\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Recruitment Stages</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/stages</code>
            </div>
            <p>Get all available recruitment stages.</p>

            <div className="docs-code">{"{\n  \"stages\": [\n    \"applied\",\n    \"screening\",\n    \"technical-interview\",\n    \"manager-round\",\n    \"hr-round\",\n    \"offer\",\n    \"joined\",\n    \"rejected\"\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Users by Role</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/users-by-role</code>
            </div>
            <p>Get users filtered by role for assignment.</p>

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
                  <td><span className="badge-required">Required</span></td>
                  <td>Role to filter by</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"users\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"HR User\",\n      \"role\": \"human-resource\"\n    }\n  ]\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
