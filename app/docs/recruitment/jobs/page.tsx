"use client";

import Link from "next/link";

export default function JobsDocsPage() {
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
            <Link href="/docs/recruitment/dashboard" className="docs-nav-link">Dashboard</Link>
            <Link href="/docs/recruitment/jobs" className="docs-nav-link active">Jobs</Link>
            <Link href="/docs/recruitment/candidates" className="docs-nav-link">Candidates</Link>
            <Link href="/docs/recruitment/interviews" className="docs-nav-link">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Jobs</h1>

        <section className="docs-section">
          <p>Manage job postings, job requests, and track applicants.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Jobs</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs</code>
            </div>
            <p>Get all jobs with optional filters.</p>

            <div className="docs-code">{"{\n  \"jobs\": [\n    {\n      \"id\": \"...\",\n      \"title\": \"Software Engineer\",\n      \"department\": \"Engineering\",\n      \"location\": \"Remote\",\n      \"employmentType\": \"full-time\",\n      \"salaryRangeMin\": 80000,\n      \"salaryRangeMax\": 120000,\n      \"status\": \"open\",\n      \"openings\": 3,\n      \"createdBy\": { \"id\": \"...\", \"name\": \"HR\" }\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Job</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/jobs</code>
            </div>
            <p>Create a new job posting.</p>

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
                  <td>Job title</td>
                </tr>
                <tr>
                  <td><code>department</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Department</td>
                </tr>
                <tr>
                  <td><code>location</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Job location</td>
                </tr>
                <tr>
                  <td><code>employmentType</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Type (full-time/part-time/contract/internship)</td>
                </tr>
                <tr>
                  <td><code>salaryRangeMin</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Minimum salary</td>
                </tr>
                <tr>
                  <td><code>salaryRangeMax</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Maximum salary</td>
                </tr>
                <tr>
                  <td><code>salaryType</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Salary type (per-annum/per-month)</td>
                </tr>
                <tr>
                  <td><code>currency</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Currency code</td>
                </tr>
                <tr>
                  <td><code>openings</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Number of openings</td>
                </tr>
                <tr>
                  <td><code>description</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Job description</td>
                </tr>
                <tr>
                  <td><code>requiredSkills</code></td>
                  <td>string[]</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Required skills</td>
                </tr>
                <tr>
                  <td><code>autoCloseDate</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Auto-close date (ISO)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"job\": {\n    \"id\": \"...\",\n    \"title\": \"Software Engineer\",\n    \"status\": \"draft\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Job</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs/[id]</code>
            </div>
            <p>Get a specific job posting.</p>

            <div className="docs-code">{"{\n  \"job\": { ... job object }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Job</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/jobs/[id]</code>
            </div>
            <p>Update a job posting.</p>

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
                  <td>Job title</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Status (draft/open/closed)</td>
                </tr>
                <tr>
                  <td><code>department</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Department</td>
                </tr>
                <tr>
                  <td><code>location</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Location</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"job\": { ... updated job }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Job</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/recruitment/jobs/[id]</code>
            </div>
            <p>Delete a job posting.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Job Candidates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs/[id]/candidates</code>
            </div>
            <p>Get all candidates for a specific job.</p>

            <div className="docs-code">{"{\n  \"candidates\": [\n    {\n      \"id\": \"...\",\n      \"firstName\": \"John\",\n      \"lastName\": \"Doe\",\n      \"email\": \"john@example.com\",\n      \"stage\": \"screening\",\n      \"source\": \"LinkedIn\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request Job</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/jobs/request</code>
            </div>
            <p>Request HR to create a job posting.</p>

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
                  <td>Job title</td>
                </tr>
                <tr>
                  <td><code>department</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Department</td>
                </tr>
                <tr>
                  <td><code>location</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Location</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"requested\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Job Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs/request</code>
            </div>
            <p>Get all job requests.</p>

            <div className="docs-code">{"{\n  \"requests\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get My Tasks</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs/my-tasks</code>
            </div>
            <p>Get jobs assigned to current user.</p>

            <div className="docs-code">{"{\n  \"jobs\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get My Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs/my-requests</code>
            </div>
            <p>Get job requests created by current user.</p>

            <div className="docs-code">{"{\n  \"requests\": [...]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get All Requests</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/jobs/all-requests</code>
            </div>
            <p>Get all job requests (HR only).</p>

            <div className="docs-code">{"{\n  \"requests\": [...]\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
