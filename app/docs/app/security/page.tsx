"use client";

import Link from "next/link";

export default function SecurityDocsPage() {
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
            <Link href="/docs/app/security" className="docs-nav-link active">Security</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Security</h1>

        <section className="docs-section">
          <p>Manage security scanning, entry logs, emergency contacts, and lost card reports.</p>
        </section>

        <section className="docs-section">
          <h2>Scan Identity Code</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/scan</code>
            </div>
            <p>Scan an identity code for entry/exit (Security only).</p>

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
                  <td>Identity code to scan</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": {\n    \"id\": \"...\",\n    \"name\": \"John Doe\",\n    \"avatarUrl\": \"...\"\n  },\n  \"entryLog\": {\n    \"id\": \"...\",\n    \"type\": \"entry\",\n    \"method\": \"qr-scan\",\n    \"timestamp\": \"2024-01-15T09:00:00Z\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Security Members</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/security/members</code>
            </div>
            <p>Get all security team members.</p>

            <div className="docs-code">{"{\n  \"members\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"Security Guard\",\n      \"role\": \"security\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Entry Logs</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/security/entry-logs</code>
            </div>
            <p>Get entry/exit logs with optional filters.</p>

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
                  <td><code>from</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Start date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>to</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>End date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>userId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Filter by user ID</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"logs\": [\n    {\n      \"id\": \"...\",\n      \"user\": { \"id\": \"...\", \"name\": \"John\" },\n      \"type\": \"entry\",\n      \"method\": \"qr-scan\",\n      \"timestamp\": \"2024-01-15T09:00:00Z\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Entry Log</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/entry-logs</code>
            </div>
            <p>Manually create an entry/exit log.</p>

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
                  <td><span className="badge-optional">Optional</span></td>
                  <td>User ID (for employees)</td>
                </tr>
                <tr>
                  <td><code>visitorPassId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Visitor pass ID (for visitors)</td>
                </tr>
                <tr>
                  <td><code>type</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Entry type (entry/exit)</td>
                </tr>
                <tr>
                  <td><code>method</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Scan method (qr-scan/manual/id-card)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"log\": {\n    \"id\": \"...\",\n    \"type\": \"entry\",\n    \"timestamp\": \"2024-01-15T09:00:00Z\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Emergency Contacts</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/security/emergency-contacts</code>
            </div>
            <p>Get all emergency contacts for the company.</p>

            <div className="docs-code">{"{\n  \"contacts\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"Emergency Contact\",\n      \"phone\": \"+1234567890\",\n      \"relation\": \"Spouse\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Lost Card Reports</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/security/lost-cards</code>
            </div>
            <p>Get all lost card reports.</p>

            <div className="docs-code">{"{\n  \"reports\": [\n    {\n      \"id\": \"...\",\n      \"user\": { \"id\": \"...\", \"name\": \"John\" },\n      \"reason\": \"lost\",\n      \"status\": \"reported\",\n      \"lastLocation\": \"Office Floor 2\",\n      \"lostDateTime\": \"2024-01-14T15:30:00Z\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Report Lost Card</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/lost-cards</code>
            </div>
            <p>Report a lost/stolen/damaged ID card.</p>

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
                  <td>User reporting the lost card</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Reason (lost/stolen/damaged/not-working)</td>
                </tr>
                <tr>
                  <td><code>lastLocation</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Last known location</td>
                </tr>
                <tr>
                  <td><code>lostDateTime</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>When card was lost (ISO)</td>
                </tr>
                <tr>
                  <td><code>policeComplaintNumber</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Police complaint number (if stolen)</td>
                </tr>
                <tr>
                  <td><code>isEmergency</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Mark as emergency</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"report\": {\n    \"id\": \"...\",\n    \"status\": \"reported\",\n    \"reason\": \"lost\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Lost Card Report</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/security/lost-cards/[id]</code>
            </div>
            <p>Update lost card report status.</p>

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
                  <td><span className="badge-required">Required</span></td>
                  <td>New status</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"report\": { ... updated report }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Open Ticket</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/lost-cards/[id]/open-ticket</code>
            </div>
            <p>Open a ticket for lost card replacement.</p>

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
                  <td><code>assignedJuniorSecurityId</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Assign to junior security</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"report\": { ... updated report }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Accept Ticket</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/lost-cards/[id]/accept-ticket</code>
            </div>
            <p>Accept a lost card ticket for processing.</p>

            <div className="docs-code">{"{\n  \"report\": { ... updated report }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Complete Ticket</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/lost-cards/[id]/complete-ticket</code>
            </div>
            <p>Mark a lost card ticket as completed.</p>

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
                  <td><code>notes</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Completion notes</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"report\": { ... updated report }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Disable Access</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/lost-cards/[id]/disable-access</code>
            </div>
            <p>Disable access for a lost card.</p>

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
                  <td><code>disabledZones</code></td>
                  <td>string[]</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Zones to disable access for</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"report\": { ... updated report }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Card Found</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/security/lost-cards/[id]/found</code>
            </div>
            <p>Mark a lost card as found.</p>

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
                  <td><code>oldCardFound</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Whether old card was found</td>
                </tr>
                <tr>
                  <td><code>oldCardDestroyed</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Whether old card was destroyed</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"report\": { ... updated report }\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
