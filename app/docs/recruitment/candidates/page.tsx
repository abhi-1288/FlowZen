"use client";

import Link from "next/link";

export default function CandidatesDocsPage() {
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
            <Link href="/docs/recruitment/jobs" className="docs-nav-link">Jobs</Link>
            <Link href="/docs/recruitment/candidates" className="docs-nav-link active">Candidates</Link>
            <Link href="/docs/recruitment/interviews" className="docs-nav-link">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Candidates</h1>

        <section className="docs-section">
          <p>Manage candidates, track their progress through hiring stages, and handle offers.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Candidates</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/candidates</code>
            </div>
            <p>Get all candidates with optional filters.</p>

            <div className="docs-code">{"{\n  \"candidates\": [\n    {\n      \"id\": \"...\",\n      \"firstName\": \"John\",\n      \"lastName\": \"Doe\",\n      \"email\": \"john@example.com\",\n      \"phone\": \"+1234567890\",\n      \"stage\": \"screening\",\n      \"source\": \"LinkedIn\",\n      \"job\": { \"id\": \"...\", \"title\": \"Software Engineer\" },\n      \"rating\": 4,\n      \"resumeUrl\": \"...\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Candidate</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates</code>
            </div>
            <p>Add a new candidate.</p>

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
                  <td><code>firstName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>First name</td>
                </tr>
                <tr>
                  <td><code>lastName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Last name</td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Email address</td>
                </tr>
                <tr>
                  <td><code>phone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Phone number</td>
                </tr>
                <tr>
                  <td><code>job</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Job ID</td>
                </tr>
                <tr>
                  <td><code>source</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Source (Referral/LinkedIn/Naukri/Indeed/Other)</td>
                </tr>
                <tr>
                  <td><code>currentCompany</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Current company</td>
                </tr>
                <tr>
                  <td><code>experienceYears</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Years of experience</td>
                </tr>
                <tr>
                  <td><code>currentCTC</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Current CTC</td>
                </tr>
                <tr>
                  <td><code>expectedCTC</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Expected CTC</td>
                </tr>
                <tr>
                  <td><code>noticePeriod</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Notice period</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": {\n    \"id\": \"...\",\n    \"firstName\": \"John\",\n    \"stage\": \"applied\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Candidate</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]</code>
            </div>
            <p>Get a specific candidate details.</p>

            <div className="docs-code">{"{\n  \"candidate\": { ... full candidate object }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Candidate</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]</code>
            </div>
            <p>Update candidate information.</p>

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
                  <td><code>firstName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>First name</td>
                </tr>
                <tr>
                  <td><code>lastName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Last name</td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Email</td>
                </tr>
                <tr>
                  <td><code>rating</code></td>
                  <td>number</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Rating (1-5)</td>
                </tr>
                <tr>
                  <td><code>notes</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Notes</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": { ... updated candidate }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Candidate</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]</code>
            </div>
            <p>Delete a candidate.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Candidate Timeline</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/timeline</code>
            </div>
            <p>Get candidate activity timeline.</p>

            <div className="docs-code">{"{\n  \"timeline\": [\n    {\n      \"action\": \"stage_changed\",\n      \"from\": \"applied\",\n      \"to\": \"screening\",\n      \"actor\": \"HR User\",\n      \"timestamp\": \"2024-01-15T10:30:00Z\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Candidate Stage</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/stage</code>
            </div>
            <p>Move candidate to a different stage.</p>

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
                  <td><code>stage</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New stage</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": { ... updated candidate }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request Stage Change</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/stage-change-request</code>
            </div>
            <p>Request approval to change candidate stage.</p>

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
                  <td><code>requestedStage</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Target stage</td>
                </tr>
                <tr>
                  <td><code>feedback</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Feedback for the change</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Upload Resume</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/resume</code>
            </div>
            <p>Upload or update candidate resume.</p>

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
                  <td><code>resumeUrl</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>URL of uploaded resume</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": { ... updated candidate }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Convert to Employee</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/convert</code>
            </div>
            <p>Convert candidate to company employee.</p>

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
                  <td><code>companyId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Company ID to add to</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Candidate Offer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/offer</code>
            </div>
            <p>Get offer for a specific candidate.</p>

            <div className="docs-code">{"{\n  \"offer\": {\n    \"id\": \"...\",\n    \"offeredCTC\": 120000,\n    \"designation\": \"Senior Engineer\",\n    \"status\": \"sent\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Candidate Offer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/offer</code>
            </div>
            <p>Create an offer for a candidate.</p>

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
                  <td><code>offeredCTC</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Offered CTC</td>
                </tr>
                <tr>
                  <td><code>designation</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Job designation</td>
                </tr>
                <tr>
                  <td><code>joiningDate</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Expected joining date</td>
                </tr>
                <tr>
                  <td><code>department</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Department</td>
                </tr>
                <tr>
                  <td><code>officeLocation</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Office location</td>
                </tr>
                <tr>
                  <td><code>perks</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Perks description</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"offer\": {\n    \"id\": \"...\",\n    \"status\": \"draft\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Candidate Interviews</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/interviews</code>
            </div>
            <p>Get all interviews for a candidate.</p>

            <div className="docs-code">{"{\n  \"interviews\": [\n    {\n      \"id\": \"...\",\n      \"roundType\": \"technical\",\n      \"scheduledAt\": \"2024-01-20T14:00:00Z\",\n      \"status\": \"scheduled\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Schedule Interview</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/interviews</code>
            </div>
            <p>Schedule an interview for a candidate.</p>

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
                  <td><code>interviewer</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Interviewer user ID</td>
                </tr>
                <tr>
                  <td><code>roundType</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Round type (screening/technical/manager/hr)</td>
                </tr>
                <tr>
                  <td><code>scheduledAt</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Scheduled date/time (ISO)</td>
                </tr>
                <tr>
                  <td><code>meetingLink</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Online meeting link</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"interview\": {\n    \"id\": \"...\",\n    \"status\": \"scheduled\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Assign Interviewer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/assign-interviewer</code>
            </div>
            <p>Assign an interviewer to a candidate.</p>

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
                  <td><code>role</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Interviewer role</td>
                </tr>
                <tr>
                  <td><code>user</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>User ID of interviewer</td>
                </tr>
                <tr>
                  <td><code>roundType</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Round type</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": { ... updated candidate }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Remove Interviewer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/recruitment/candidates/[id]/assign-interviewer</code>
            </div>
            <p>Remove an interviewer from a candidate.</p>

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
                  <td><code>index</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Index of interviewer to remove</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": { ... updated candidate }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Public: Apply for Job</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/public/jobs/[id]/apply</code>
            </div>
            <p>Apply for a job (public, no auth required).</p>

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
                  <td><code>firstName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>First name</td>
                </tr>
                <tr>
                  <td><code>lastName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Last name</td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Email</td>
                </tr>
                <tr>
                  <td><code>phone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Phone</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"candidate\": {\n    \"id\": \"...\",\n    \"stage\": \"applied\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Public: Get Candidate Profile</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/candidate/me</code>
            </div>
            <p>Get current candidate&apos;s profile (magic token auth).</p>

            <div className="docs-code">{"{\n  \"candidate\": { ... candidate profile }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Public: Respond to Offer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/public/candidate/me/offer</code>
            </div>
            <p>Accept or reject an offer (candidate portal).</p>

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
                  <td>Action (accept/reject)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"offer\": { ... updated offer }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Public: Get Offer Letter</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/candidate/me/letter</code>
            </div>
            <p>Get offer letter HTML (candidate portal).</p>

            <div className="docs-code">{"{\n  \"letterHtml\": \"<html>...offer letter...</html>\"\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
