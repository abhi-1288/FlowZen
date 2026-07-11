"use client";

import Link from "next/link";

export default function ProfileDocsPage() {
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
            <Link href="/docs/app/profile" className="docs-nav-link active">Profile</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Profile</h1>

        <section className="docs-section">
          <p>Manage user profile information, avatar, documents, and identity verification.</p>
        </section>

        <section className="docs-section">
          <h2>Get Profile</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/profile</code>
            </div>
            <p>Get current user&apos;s full profile.</p>

            <div className="docs-code">{"{\n  \"user\": {\n    \"id\": \"...\",\n    \"name\": \"John Doe\",\n    \"email\": \"john@example.com\",\n    \"phone\": \"+1234567890\",\n    \"role\": \"employee\",\n    \"dob\": \"1990-05-15\",\n    \"address\": \"123 Main St\",\n    \"avatarUrl\": \"...\",\n    \"bloodGroup\": \"O+\",\n    \"emergencyContact\": {\n      \"name\": \"Jane Doe\",\n      \"phone\": \"+1234567891\",\n      \"relation\": \"Spouse\"\n    },\n    \"company\": \"companyId\",\n    \"team\": \"teamId\",\n    \"regionLabel\": \"US-East\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Profile</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/profile</code>
            </div>
            <p>Update current user&apos;s profile information.</p>

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
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Full name</td>
                </tr>
                <tr>
                  <td><code>phone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Phone number</td>
                </tr>
                <tr>
                  <td><code>dob</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Date of birth (ISO)</td>
                </tr>
                <tr>
                  <td><code>address</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Home address</td>
                </tr>
                <tr>
                  <td><code>bloodGroup</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Blood group</td>
                </tr>
                <tr>
                  <td><code>emergencyContact</code></td>
                  <td>object</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>{"{ name, phone, relation }"}</td>
                </tr>
                <tr>
                  <td><code>customRole</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Custom job title</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": { ... updated user object }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Profile</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/profile</code>
            </div>
            <p>Delete current user&apos;s account.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Upload Avatar</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/image</code>
            </div>
            <p>Upload or update profile avatar.</p>

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
                  <td><code>avatarUrl</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>URL of uploaded image</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"user\": { ... updated user with avatarUrl }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Avatar</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/profile/image</code>
            </div>
            <p>Remove profile avatar.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Documents</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/profile/documents</code>
            </div>
            <p>Get user&apos;s uploaded documents.</p>

            <div className="docs-code">{"{\n  \"documents\": [\n    {\n      \"id\": \"...\",\n      \"category\": \"identity\",\n      \"fileName\": \"passport.pdf\",\n      \"fileType\": \"application/pdf\",\n      \"fileUrl\": \"...\",\n      \"fieldValues\": {}\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Add Document</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/documents</code>
            </div>
            <p>Add a new document to profile.</p>

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
                  <td><code>category</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Document category</td>
                </tr>
                <tr>
                  <td><code>fileName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Original filename</td>
                </tr>
                <tr>
                  <td><code>fileType</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>MIME type</td>
                </tr>
                <tr>
                  <td><code>fileSize</code></td>
                  <td>number</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>File size in bytes</td>
                </tr>
                <tr>
                  <td><code>fileUrl</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>URL of uploaded file</td>
                </tr>
                <tr>
                  <td><code>fieldValues</code></td>
                  <td>object</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Additional metadata</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"document\": { ... created document }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Document</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/profile/documents</code>
            </div>
            <p>Remove a document from profile.</p>

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
                  <td><code>documentId</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Document ID to delete</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify Email</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/email/verify</code>
            </div>
            <p>Send OTP to verify new email address.</p>

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
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New email address</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Confirm Email</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/email/confirm</code>
            </div>
            <p>Confirm email change with OTP.</p>

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
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>New email address</td>
                </tr>
                <tr>
                  <td><code>otp</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>6-digit OTP code</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get ID Card Status</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/profile/id-card/status</code>
            </div>
            <p>Check ID card request status.</p>

            <div className="docs-code">{"{\n  \"status\": \"pending\",\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\",\n    \"createdAt\": \"2024-01-15T10:30:00Z\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request ID Card</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/id-card/request</code>
            </div>
            <p>Request a new ID card.</p>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Request Identity Code</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/profile/identity-code/request</code>
            </div>
            <p>Request a new identity code for security scanning.</p>

            <div className="docs-code">{"{\n  \"request\": {\n    \"id\": \"...\",\n    \"status\": \"pending\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Monthly Check</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/profile/monthly-check</code>
            </div>
            <p>Get monthly attendance/salary check status.</p>

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
                  <td><span className="badge-required">Required</span></td>
                  <td>Month in YYYY-MM format</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"checked\": true,\n  \"salary\": 50000\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get User Jobs</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/profile/jobs</code>
            </div>
            <p>Get jobs associated with current user.</p>

            <div className="docs-code">{"{\n  \"jobs\": [...]\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
