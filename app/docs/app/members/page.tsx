"use client";

import Link from "next/link";

export default function MembersDocsPage() {
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
            <Link href="/docs/app/members" className="docs-nav-link active">Members</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Members</h1>

        <section className="docs-section">
          <p>Manage team members, roles, and HR operations.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Users</h2>
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
                  <td>Filter by role</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"users\": [\n    {\n      \"id\": \"...\",\n      \"name\": \"John Doe\",\n      \"email\": \"john@example.com\",\n      \"role\": \"employee\",\n      \"avatarUrl\": \"...\",\n      \"company\": \"companyId\",\n      \"team\": \"teamId\",\n      \"customRole\": \"Software Engineer\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Change Member Role</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/member-role</code>
            </div>
            <p>Change a member&apos;s role (HR/Admin only).</p>

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
                  <td>User ID</td>
                </tr>
                <tr>
                  <td><code>newRole</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New role (admin, human-resource, project-manager, etc.)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": { ... updated user }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Member Region</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/member-region</code>
            </div>
            <p>Update a member&apos;s region/office location.</p>

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
                  <td>User ID</td>
                </tr>
                <tr>
                  <td><code>regionLabel</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Region label</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": { ... updated user }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Set Member Salary</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/member-salary/[id]</code>
            </div>
            <p>Set or update a member&apos;s salary (HR only).</p>

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
                  <td>User ID (path param)</td>
                </tr>
                <tr>
                  <td><code>salary</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Annual salary amount</td>
                </tr>
                <tr>
                  <td><code>currency</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Currency code (default: INR)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": { ... updated user with salary }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update PF/ESIC</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/member-pf-esic/[id]</code>
            </div>
            <p>Update PF and ESIC details for a member.</p>

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
                  <td>User ID (path param)</td>
                </tr>
                <tr>
                  <td><code>pfNumber</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>PF account number</td>
                </tr>
                <tr>
                  <td><code>pfDeductionAmount</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>PF deduction amount</td>
                </tr>
                <tr>
                  <td><code>esicNumber</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>ESIC number</td>
                </tr>
                <tr>
                  <td><code>esicDeductionAmount</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>ESIC deduction amount</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": { ... updated user }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Member Documents</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/member-documents/[id]</code>
            </div>
            <p>Get documents of a specific member (HR only).</p>

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
                  <td>User ID (path param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"documents\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Fire Member</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/fire</code>
            </div>
            <p>Terminate a member (HR/Admin only).</p>

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
                  <td>User ID to terminate</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Termination reason</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Revoke ID Card</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/revoke-id-card</code>
            </div>
            <p>Revoke a member&apos;s ID card.</p>

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
                  <td>User ID</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Company Policy</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/policy</code>
            </div>
            <p>Update company HR policies (HR only).</p>

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
                  <td><code>noticePeriodDays</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Notice period in days</td>
                </tr>
                <tr>
                  <td><code>paidLeaveDays</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Paid leave days per period</td>
                </tr>
                <tr>
                  <td><code>paidLeavePeriod</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Leave period (monthly/yearly)</td>
                </tr>
                <tr>
                  <td><code>minWorkHours</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Minimum work hours per day</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"company\": { ... updated company }\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
