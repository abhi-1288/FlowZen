"use client";

import Link from "next/link";

export default function AttendanceDocsPage() {
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
            <Link href="/docs/app/attendance" className="docs-nav-link active">Attendance</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Attendance</h1>

        <section className="docs-section">
          <p>Manage check-in/out, leaves, work-from-home, holidays, and attendance export.</p>
        </section>

        <section className="docs-section">
          <h2>Check In</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/attendance/checkin</code>
            </div>
            <p>Check in for the day.</p>

            <div className="docs-code">{"{\n  \"attendance\": {\n    \"id\": \"...\",\n    \"date\": \"2024-01-15\",\n    \"checkIn\": \"2024-01-15T09:00:00Z\",\n    \"status\": \"present\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Attendance History</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/attendance/checkin</code>
            </div>
            <p>Get attendance history and today&apos;s status.</p>

            <div className="docs-code">{"{\n  \"history\": [...],\n  \"today\": {\n    \"checkIn\": \"2024-01-15T09:00:00Z\",\n    \"checkOut\": null,\n    \"status\": \"present\"\n  },\n  \"minWorkHours\": 8\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Check Out</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/attendance/checkout</code>
            </div>
            <p>Check out for the day.</p>

            <div className="docs-code">{"{\n  \"attendance\": {\n    \"id\": \"...\",\n    \"checkOut\": \"2024-01-15T18:00:00Z\",\n    \"status\": \"present\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request Checkout</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/attendance/checkout-request</code>
            </div>
            <p>Request early checkout approval.</p>

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
                  <td><code>attendanceId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Today&apos;s attendance ID</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Reason for early checkout</td>
                </tr>
                <tr>
                  <td><code>assignedTo</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Manager to approve</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"checkOutRequest\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Checkout Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/attendance/checkout-request</code>
            </div>
            <p>Get pending checkout requests (for managers).</p>

            <div className="docs-code">{"{\n  \"requests\": [...],\n  \"minWorkHours\": 8\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Checkout Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/attendance/checkout-request/[id]</code>
            </div>
            <p>Approve or reject a checkout request.</p>

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
                  <td><code>action</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Action (approve/reject)</td>
                </tr>
                <tr>
                  <td><code>statusType</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Status type if approved</td>
                </tr>
                <tr>
                  <td><code>rejectionReason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rejection reason</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"checkOutRequest\": { ... updated request }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Holidays</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/attendance/holidays</code>
            </div>
            <p>Get all company holidays.</p>

            <div className="docs-code">{"{\n  \"holidays\": [\n    {\n      \"id\": \"...\",\n      \"title\": \"Christmas\",\n      \"startDate\": \"2024-12-25\",\n      \"endDate\": \"2024-12-26\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Holiday</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/attendance/holidays</code>
            </div>
            <p>Create a new holiday (HR only).</p>

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
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Holiday name</td>
                </tr>
                <tr>
                  <td><code>description</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Description</td>
                </tr>
                <tr>
                  <td><code>startDate</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Start date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>endDate</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>End date (YYYY-MM-DD)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"holiday\": { ... created holiday }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Holiday</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-put">PUT</span>
              <code className="endpoint-path">/api/attendance/holidays</code>
            </div>
            <p>Update a holiday.</p>

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
                  <td>Holiday ID</td>
                </tr>
                <tr>
                  <td><code>title</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Holiday name</td>
                </tr>
                <tr>
                  <td><code>startDate</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Start date</td>
                </tr>
                <tr>
                  <td><code>endDate</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>End date</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"holiday\": { ... updated holiday }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Holiday</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/attendance/holidays</code>
            </div>
            <p>Delete a holiday.</p>

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
                  <td>Holiday ID</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request Leave</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/attendance/leave</code>
            </div>
            <p>Request time off (leave).</p>

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
                  <td><code>startDate</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Start date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>endDate</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>End date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Leave reason</td>
                </tr>
                <tr>
                  <td><code>attachmentUrl</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Attachment URL</td>
                </tr>
                <tr>
                  <td><code>hrApprover</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>HR approver user ID</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"leave\": {\n    \"id\": \"...\",\n    \"status\": \"pending\",\n    \"startDate\": \"2024-01-20\",\n    \"endDate\": \"2024-01-22\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Leave Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/attendance/leave</code>
            </div>
            <p>Get leave requests and policy info.</p>

            <div className="docs-code">{"{\n  \"requests\": [...],\n  \"leavePolicy\": {\n    \"paidLeaveDays\": 12,\n    \"paidLeavePeriod\": \"yearly\",\n    \"usedPaidLeaveDays\": 5,\n    \"carryForwardLeaveDays\": 2,\n    \"remainingPaidLeaveDays\": 9\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Leave Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/attendance/leave/[id]</code>
            </div>
            <p>Approve, reject, or revoke a leave request.</p>

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
                  <td><code>action</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Action (approve/reject/revoke)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rejection reason</td>
                </tr>
                <tr>
                  <td><code>assignedAdmin</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Admin to forward to</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"leave\": { ... updated leave }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request WFH</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/attendance/wfh</code>
            </div>
            <p>Request work from home.</p>

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
                  <td><code>startDate</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Start date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>endDate</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>End date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>WFH reason</td>
                </tr>
                <tr>
                  <td><code>hrApprover</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>HR approver user ID</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"wfh\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get WFH Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/attendance/wfh</code>
            </div>
            <p>Get WFH requests and policy info.</p>

            <div className="docs-code">{"{\n  \"requests\": [...],\n  \"wfhPolicy\": {\n    \"wfhDays\": 5,\n    \"wfhPeriod\": \"monthly\",\n    \"usedWfhDays\": 2,\n    \"carryForwardWfhDays\": 1,\n    \"remainingWfhDays\": 4\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update WFH Request</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/attendance/wfh/[id]</code>
            </div>
            <p>Approve, reject, or revoke a WFH request.</p>

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
                  <td><code>action</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Action (approve/reject/revoke)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rejection reason</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"wfh\": { ... updated wfh }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Export Attendance</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/attendance/export</code>
            </div>
            <p>Export attendance data as CSV.</p>

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
                  <td><span className="badge-required">Required</span></td>
                  <td>Start date (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>to</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>End date (YYYY-MM-DD)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-info">
              <p>Returns CSV file with Content-Type: text/csv</p>
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Get WFH Dates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company/wfh</code>
            </div>
            <p>Get company-wide WFH dates.</p>

            <div className="docs-code">{"{\n  \"wfhDates\": [\"2024-01-20\", \"2024-01-21\"]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Add WFH Dates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/company/wfh</code>
            </div>
            <p>Add company-wide WFH dates (Admin only).</p>

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
                  <td><code>dates</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of dates (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Reason for WFH</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Update WFH Policy</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/company/wfh</code>
            </div>
            <p>Update company WFH policy (Admin only).</p>

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
                  <td><code>wfhDays</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>WFH days per period</td>
                </tr>
                <tr>
                  <td><code>wfhPeriod</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>WFH period (monthly/yearly)</td>
                </tr>
                <tr>
                  <td><code>carryForwardWfhDays</code></td>
                  <td>boolean</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Allow carry forward</td>
                </tr>
                <tr>
                  <td><code>wfhCheckInMode</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Check-in mode</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"company\": { ... updated company }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Delete WFH Dates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/company/wfh</code>
            </div>
            <p>Remove company-wide WFH dates.</p>

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
                  <td><code>dates</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of dates to remove</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Get Weekend Dates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/company/weekends</code>
            </div>
            <p>Get company weekend dates.</p>

            <div className="docs-code">{"{\n  \"weekendDates\": [\"2024-01-20\", \"2024-01-21\"]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Add Weekend Dates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/company/weekends</code>
            </div>
            <p>Add company weekend dates (Admin only).</p>

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
                  <td><code>dates</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of dates (YYYY-MM-DD)</td>
                </tr>
                <tr>
                  <td><code>reason</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Reason</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Company: Delete Weekend Dates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/company/weekends</code>
            </div>
            <p>Remove company weekend dates.</p>

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
                  <td><code>dates</code></td>
                  <td>string[]</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Array of dates to remove</td>
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
