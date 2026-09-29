"use client";

import Link from "next/link";

export default function FinanceDocsPage() {
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
            <Link href="/docs/app/finance" className="docs-nav-link active">Finance</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Finance</h1>

        <section className="docs-section">
          <p>Manage salaries, policies, invoices, resource requests, and financial reports.</p>
        </section>

        <section className="docs-section">
          <h2>Region Scope for Salary Management</h2>
          <div className="docs-card">
            <p>Salary management is region scoped. A <code>finance</code> or <code>admin</code> user only sees, creates, edits, approves, pays, rejects, deletes and auto-generates salaries for members in their own effective region.</p>

            <p>The scope is resolved from the actor&apos;s <code>regionLabel</code>, falling back to the main office when unset. It applies to:</p>
            <ul>
              <li><code>GET /api/finance</code> — the <code>members</code> picker, the <code>salaries</code> list, the pending counts, and the cycle-day auto-generation all use the same scope.</li>
              <li><code>POST /api/finance</code> — <code>calculate-salary</code>, <code>generate-salary</code> and <code>edit-salary</code>.</li>
              <li><code>PATCH /api/finance</code> — the <code>salary</code> status updates.</li>
              <li><code>/api/finance/salary/[id]</code>, <code>/api/finance/salary-slip/[id]</code>, <code>/api/finance/member-salary/[id]</code> and <code>/api/finance/member-attendance/[id]</code>, so the boundary cannot be bypassed by calling a detail endpoint with a guessed id.</li>
            </ul>

            <div className="docs-info">
              <p><strong>No region configured?</strong> Companies with no <code>addresses[]</code> and no <code>address</code> are unaffected and stay company-wide. A company that has regions but whose requester&apos;s region holds no approved members also falls back to company-wide, matching <code>/api/users?region=mine</code>. Employees can always read their own records.</p>
            </div>

            <div className="docs-info">
              <p><strong>Expenses are region scoped too.</strong> A finance or admin user only sees and acts on expense requests raised by members in their own effective region, and the travel assignee picker is filtered the same way. Budgets, bills, invoices and salary advances stay company-wide.</p>
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Region Scope for Policy and Salary Cycle</h2>
          <div className="docs-card">
            <p>Company policy and the salary cycle are per-region. A <code>finance</code> or <code>admin</code> user reads and updates the policy — PF/ESIC/TDS percentages, salary cycle, food and travel allowances — for their own effective region only, resolved from their <code>regionLabel</code> with the main-office fallback.</p>

            <p>This applies to <code>GET</code>, <code>POST</code> and <code>PATCH /api/finance/policy</code> and to <code>GET</code> and <code>POST /api/finance/salary-cycle</code>. Companies with no region configured stay company-wide, as does a region that holds no approved members.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Two Tracks: Travel vs Purchases</h2>
          <div className="docs-card">
            <p>Money leaves the company through two different desks, and which one handles it depends on <em>what</em> is being bought — never on who is asking.</p>

            <h3>Travel — finance only</h3>
            <p>Any approved member raises a travel expense from the Finance tab. The assignee must be a <code>finance</code> user in the requester&apos;s region, and the request follows the usual chain: <code>pending → forwarded → approved → accepted → disbursed</code>.</p>

            <h3>Purchases — IT first, then finance</h3>
            <p>Laptops, desktops, software, electronics, internet service, email service and office resources are raised from <strong>/profile/it → New Ticket → Purchase request</strong>. They are stored as <code>ProcurementRequest</code> records, not expenses.</p>
            <ul>
              <li><code>it-admin</code> / <code>it-administration</code> buy for the company themselves, so their purchases are routed straight to <strong>finance</strong> — they never see the IT queue.</li>
              <li>Everyone else (project-manager, qa-tester, HR, admin, finance, employee, others, security) is reviewed by <strong>IT</strong> first.</li>
              <li>When IT approves, the API mints a linked <code>ExpenseRequest</code> already at <code>approved</code> with no admin approver — the IT review <em>is</em> the approval. Finance then accepts and disburses it from the Finance tab, and the procurement record&apos;s status follows along.</li>
            </ul>

            <div className="docs-info">
              <p><strong>Region scoping.</strong> The assignee picker, the request list and the IT board are all scoped to the requester&apos;s effective region, with the same main-office and empty-region fallbacks as salaries. A company with no <code>addresses[]</code> stays company-wide.</p>
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get All Salaries</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance</code>
            </div>
            <p>Get salary records for the month. Finance and admin users receive only their own region&apos;s records; everyone else receives their own.</p>

            <div className="docs-code">{"{\n  \"region\": \"Pune\",\n  \"regionFallback\": false,\n  \"salaries\": [\n    {\n      \"id\": \"...\",\n      \"employee\": { \"id\": \"...\", \"name\": \"John\" },\n      \"month\": \"2024-01\",\n      \"baseSalary\": 50000,\n      \"allowances\": 5000,\n      \"deductions\": 3000,\n      \"netSalary\": 52000,\n      \"status\": \"approved\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Salary</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance</code>
            </div>
            <p>Create a new salary record (Finance only).</p>

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
                  <td><code>employee</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Employee user ID</td>
                </tr>
                <tr>
                  <td><code>month</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Month (YYYY-MM)</td>
                </tr>
                <tr>
                  <td><code>baseSalary</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Base salary amount</td>
                </tr>
                <tr>
                  <td><code>allowances</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Total allowances</td>
                </tr>
                <tr>
                  <td><code>deductions</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Total deductions</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"salary\": { ... created salary record }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Salary Status</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/finance</code>
            </div>
            <p>Update salary status (approve/reject).</p>

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
                  <td><code>salaryId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Salary record ID</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New status (approved/paid/rejected)</td>
                </tr>
                <tr>
                  <td><code>rejectionReason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rejection reason</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"salary\": { ... updated salary }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Salary by ID</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/salary/[id]</code>
            </div>
            <p>Get a specific salary record.</p>

            <div className="docs-code">{"{\n  \"salary\": { ... salary record }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Salary</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/finance/salary/[id]</code>
            </div>
            <p>Delete a salary record.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Member Salary</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance/member-salary/[id]</code>
            </div>
            <p>Create salary for a specific member.</p>

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
                  <td>Member ID (path param)</td>
                </tr>
                <tr>
                  <td><code>month</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Month (YYYY-MM)</td>
                </tr>
                <tr>
                  <td><code>baseSalary</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Base salary amount</td>
                </tr>
                <tr>
                  <td><code>allowances</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Total allowances</td>
                </tr>
                <tr>
                  <td><code>deductions</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Total deductions</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"salary\": { ... created salary }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Member Attendance</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/member-attendance/[id]</code>
            </div>
            <p>Get attendance summary for salary calculation.</p>

            <div className="docs-code">{"{\n  \"attendance\": {\n    \"totalDays\": 22,\n    \"presentDays\": 20,\n    \"leaveDays\": 2\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Finance Policy</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/policy</code>
            </div>
            <p>Get company finance policy.</p>

            <div className="docs-code">{"{\n  \"policy\": {\n    \"foodAmount\": 2000,\n    \"travelAccommodationAmount\": 5000,\n    \"pfPercentage\": 12,\n    \"esicPercentage\": 0.75,\n    \"tdsPercentage\": 10\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Finance Policy</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance/policy</code>
            </div>
            <p>Create or update finance policy.</p>

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
                  <td><code>foodAmount</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Food allowance amount</td>
                </tr>
                <tr>
                  <td><code>travelAccommodationAmount</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Travel allowance amount</td>
                </tr>
                <tr>
                  <td><code>pfPercentage</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>PF deduction percentage</td>
                </tr>
                <tr>
                  <td><code>esicPercentage</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>ESIC deduction percentage</td>
                </tr>
                <tr>
                  <td><code>tdsPercentage</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>TDS deduction percentage</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"policy\": { ... updated policy }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Finance Policy (PATCH)</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/finance/policy</code>
            </div>
            <p>Partially update finance policy.</p>

            <div className="docs-code">{"{\n  \"policy\": { ... updated policy }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Salary Cycle</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/salary-cycle</code>
            </div>
            <p>Get salary cycle configuration.</p>

            <div className="docs-code">{"{\n  \"cycle\": {\n    \"salaryCycleDay\": 1,\n    \"salaryCycleStartDay\": 1,\n    \"salaryCycleEndDay\": 31\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Salary Cycle</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance/salary-cycle</code>
            </div>
            <p>Update salary cycle configuration.</p>

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
                  <td><code>salaryCycleDay</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Day of month for salary</td>
                </tr>
                <tr>
                  <td><code>salaryCycleStartDay</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Cycle start day</td>
                </tr>
                <tr>
                  <td><code>salaryCycleEndDay</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Cycle end day</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"policy\": { ... updated policy }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request Salary Advance</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance/salary-advance</code>
            </div>
            <p>Request a salary advance.</p>

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
                  <td><code>amount</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Advance amount</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Reason for advance</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Salary Slips</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/salary-slip</code>
            </div>
            <p>Get salary slips for the current user.</p>

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
                  <td><code>month</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Filter by month (YYYY-MM)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"slips\": [\n    {\n      \"id\": \"...\",\n      \"month\": \"2024-01\",\n      \"netSalary\": 52000,\n      \"status\": \"approved\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Salary Slip by ID</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/salary-slip/[id]</code>
            </div>
            <p>Get a specific salary slip.</p>

            <div className="docs-code">{"{\n  \"slip\": { ... salary slip }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Leave Impact</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/leave-impact</code>
            </div>
            <p>Calculate salary impact of leaves.</p>

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
                  <td>User ID</td>
                </tr>
                <tr>
                  <td><code>month</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Month (YYYY-MM)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"impact\": {\n    \"leaveDays\": 2,\n    \"deductionAmount\": 4545\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Resource Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/resource-request</code>
            </div>
            <p>Get all resource requests.</p>

            <div className="docs-code">{"{\n  \"requests\": [\n    {\n      \"id\": \"...\",\n      \"items\": [{ \"name\": \"Laptop\", \"quantity\": 1 }],\n      \"status\": \"pending\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Resource Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance/resource-request</code>
            </div>
            <p>Create a new resource request.</p>

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
                  <td><code>items</code></td>
                  <td>array</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>{"[{ name, quantity, reason }]"}</td>
                </tr>
                <tr>
                  <td><code>notes</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Additional notes</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Resource Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/finance/resource-request</code>
            </div>
            <p>Approve or reject a resource request.</p>

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
                  <td>Request ID</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New status (approved/rejected)</td>
                </tr>
                <tr>
                  <td><code>rejectionReason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rejection reason</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"request\": { ... updated request }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Invoices</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/invoice</code>
            </div>
            <p>Get all client invoices.</p>

            <div className="docs-code">{"{\n  \"invoices\": [\n    {\n      \"id\": \"...\",\n      \"clientName\": \"Client Corp\",\n      \"amount\": 100000,\n      \"status\": \"pending\",\n      \"invoiceNumber\": \"INV-001\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Invoice</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/finance/invoice</code>
            </div>
            <p>Create a new client invoice.</p>

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
                  <td><code>clientName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Client name</td>
                </tr>
                <tr>
                  <td><code>clientEmail</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Client email</td>
                </tr>
                <tr>
                  <td><code>amount</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Invoice amount</td>
                </tr>
                <tr>
                  <td><code>description</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Invoice description</td>
                </tr>
                <tr>
                  <td><code>board</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Associated board ID</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"invoice\": {\n    \"id\": \"...\",\n    \"invoiceNumber\": \"INV-002\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Invoice</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/finance/invoice</code>
            </div>
            <p>Update invoice status.</p>

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
                  <td><code>invoiceId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Invoice ID</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New status (paid/pending)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"invoice\": { ... updated invoice }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Reports</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/reports</code>
            </div>
            <p>Get financial reports.</p>

            <div className="docs-code">{"{\n  \"reports\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Export Finance Data</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/finance/export</code>
            </div>
            <p>Export finance data as CSV.</p>

            <div className="docs-info">
              <p>Returns CSV file with Content-Type: text/csv</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
