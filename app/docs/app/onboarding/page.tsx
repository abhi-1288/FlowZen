"use client";

import Link from "next/link";

export default function OnboardingDocsPage() {
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
            <Link href="/docs/app/onboarding" className="docs-nav-link active">Onboarding</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Onboarding</h1>

        <section className="docs-section">
          <p>Manage company creation, joining, and team membership.</p>
        </section>

        <section className="docs-section">
          <h2>Create Company</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/company</code>
            </div>
            <p>Create a new company. User becomes the owner.</p>

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
                  <td><code>name</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Company name</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"company\": {\n    \"id\": \"...\",\n    \"name\": \"Acme Corp\",\n    \"joinCode\": \"ABC123\",\n    \"owner\": \"userId\",\n    \"status\": \"active\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Join Company</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/company/join</code>
            </div>
            <p>Request to join a company using join code.</p>

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
                  <td><code>joinCode</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Company join code</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Quit Company</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/company/quit</code>
            </div>
            <p>Request to leave current company.</p>

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
                  <td><code>replacementUserId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>User to transfer ownership (if owner)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Team</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/team</code>
            </div>
            <p>Create a new team within the company.</p>

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
                  <td><code>name</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Team name</td>
                </tr>
                <tr>
                  <td><code>joinCode</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Custom join code (auto-generated if not provided)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"team\": {\n    \"id\": \"...\",\n    \"name\": \"Engineering\",\n    \"joinCode\": \"ENG123\",\n    \"company\": \"companyId\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Join Team</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/team/join</code>
            </div>
            <p>Request to join a team using join code.</p>

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
                  <td><code>joinCode</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Team join code</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Quit Team</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/team/quit</code>
            </div>
            <p>Leave current team.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Kick Member</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/team/kick</code>
            </div>
            <p>Remove a member from the team (manager only).</p>

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
                  <td><code>userId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>User ID to remove</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Team</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/team/delete</code>
            </div>
            <p>Delete a team (owner/admin only).</p>

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
                  <td><code>teamId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Team ID to delete</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Join Preview</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/join/preview</code>
            </div>
            <p>Preview company/team info before joining.</p>

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
                  <td><code>code</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Join code</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"company\": { \"name\": \"Acme Corp\", ... },\n  \"team\": { \"name\": \"Engineering\", ... }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Cancel Join Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/join/cancel</code>
            </div>
            <p>Cancel a pending join request.</p>

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
                  <td><code>requestId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Request ID to cancel</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Cancel Quit Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/quit/cancel</code>
            </div>
            <p>Cancel a pending quit request.</p>

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
                  <td><code>requestId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Request ID to cancel</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Cancellation reason</td>
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
