"use client";

import Link from "next/link";

export default function AuthDocsPage() {
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
            <Link href="/docs/authentication" className="docs-nav-link active">Authentication</Link>
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
            <Link href="/docs/recruitment/candidates" className="docs-nav-link">Candidates</Link>
            <Link href="/docs/recruitment/interviews" className="docs-nav-link">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Authentication</h1>

        <section className="docs-section">
          <p>FlowZen uses NextAuth.js for web authentication. For mobile/Android apps, use the <strong>Mobile Login</strong> endpoint which returns a JWT token.</p>

          <div className="docs-info">
            <p><strong>Mobile Auth:</strong> Use <code>POST /api/auth/mobile-login</code> to get a JWT token. Include it in all subsequent requests as <code>Authorization: Bearer &lt;token&gt;</code>.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Mobile Login</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/mobile-login</code>
            </div>
            <p>Login with email and password. Returns a JWT token for mobile app authentication. Use this for Android/iOS apps instead of NextAuth session.</p>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Request Body</h4>
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
                  <td>Registered email address</td>
                </tr>
                <tr>
                  <td><code>password</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Account password</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"token\": \"eyJhbGciOiJIUzI1NiIs...\",\n  \"user\": {\n    \"id\": \"...\",\n    \"name\": \"John Doe\",\n    \"email\": \"john@example.com\",\n    \"role\": \"employee\",\n    \"avatarUrl\": \"...\",\n    \"company\": \"Acme Corp\",\n    \"companyColor\": \"#6366f1\",\n    \"team\": \"Engineering\"\n  }\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Errors</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>401</code></td>
                  <td>Invalid email or password</td>
                </tr>
                <tr>
                  <td><code>401</code></td>
                  <td>This account uses social login</td>
                </tr>
                <tr>
                  <td><code>403</code></td>
                  <td>Please verify your email with the OTP sent during signup before logging in.</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Usage in Android</h4>
            <div className="docs-code">{"// 1. Login\nval response = httpClient.post(\"/api/auth/mobile-login\") {\n    setBody(mapOf(\n        \"email\" to \"user@example.com\",\n        \"password\" to \"password123\"\n    ))\n}\nval token = response.token\n\n// 2. Use token in subsequent requests\nhttpClient.get(\"/api/profile\") {\n    header(\"Authorization\", \"Bearer $token\")\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Register</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/register</code>
            </div>
            <p>Create a new user account. Sends a 6-digit OTP to the provided email for verification.</p>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Request Body</h4>
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
                  <td>Full name</td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Email address</td>
                </tr>
                <tr>
                  <td><code>password</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Password (min 8 chars)</td>
                </tr>
                <tr>
                  <td><code>role</code></td>
                  <td>string</td>
                  <td>Optional</td>
                  <td>Role (employee, project-manager, qa-tester, human-resource, finance, admin, others). Default: employee</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"user\": {\n    \"id\": \"...\",\n    \"name\": \"John Doe\",\n    \"email\": \"john@example.com\",\n    \"role\": \"employee\"\n  },\n  \"message\": \"OTP sent to your email.\"\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Errors</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>400</code></td>
                  <td>Name, email, and an 8+ character password are required</td>
                </tr>
                <tr>
                  <td><code>409</code></td>
                  <td>An account with this email already exists</td>
                </tr>
                <tr>
                  <td><code>500</code></td>
                  <td>Unable to send OTP email</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Verify OTP</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/verify-otp</code>
            </div>
            <p>Verify email with OTP code sent during registration. Returns a JWT token for mobile app authentication.</p>

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
                  <td>Email address</td>
                </tr>
                <tr>
                  <td><code>otp</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>6-digit OTP code</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{\n  \"ok\": true,\n  \"token\": \"eyJhbGciOiJIUzI1NiIs...\",\n  \"user\": {\n    \"id\": \"...\",\n    \"name\": \"John Doe\",\n    \"email\": \"john@example.com\",\n    \"role\": \"employee\",\n    \"avatarUrl\": \"...\",\n    \"company\": \"Acme Corp\",\n    \"companyColor\": \"#6366f1\",\n    \"team\": \"Engineering\"\n  }\n}"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Usage in Android</h4>
            <div className="docs-code">{"// 1. Register\nval regResponse = httpClient.post(\"/api/auth/register\") {\n    setBody(mapOf(\n        \"name\" to \"John Doe\",\n        \"email\" to \"john@example.com\",\n        \"password\" to \"password123\"\n    ))\n}\n\n// 2. Verify OTP (returns token)\nval verifyResponse = httpClient.post(\"/api/auth/verify-otp\") {\n    setBody(mapOf(\n        \"email\" to \"john@example.com\",\n        \"otp\" to \"123456\"\n    ))\n}\nval token = verifyResponse.token\n\n// 3. Use token in subsequent requests\nhttpClient.get(\"/api/profile\") {\n    header(\"Authorization\", \"Bearer $token\")\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Forgot Password</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/forgot-password</code>
            </div>
            <p>Send password reset email.</p>

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
                  <td>Registered email address</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Check Pending Status</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/check-pending</code>
            </div>
            <p>Check if user has pending approval.</p>

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
                  <td>Email address (query param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"pending\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>OAuth Email Verification</h2>
          <p>For users who signed up via social login (Google, GitHub, etc.) with unverified emails. These endpoints require an authenticated session or Bearer token.</p>

          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/oauth/send-otp</code>
            </div>
            <p>Send a 6-digit OTP to the user&apos;s email for verification. Requires authentication.</p>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{ \"message\": \"OTP sent to your email.\" }"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Errors</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>401</code></td>
                  <td>Unauthorized</td>
                </tr>
                <tr>
                  <td><code>400</code></td>
                  <td>Credentials accounts already use email verification</td>
                </tr>
                <tr>
                  <td><code>400</code></td>
                  <td>Account is already verified</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="docs-card" style={{ marginTop: 16 }}>
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/oauth/verify-otp</code>
            </div>
            <p>Verify the OTP sent to the user&apos;s email. Requires authentication.</p>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Request Body</h4>
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
                  <td><code>otp</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>6-digit OTP code</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Response (200)</h4>
            <div className="docs-code">{"{ \"ok\": true }"}</div>

            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 16 }}>Errors</h4>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>401</code></td>
                  <td>Invalid OTP</td>
                </tr>
                <tr>
                  <td><code>410</code></td>
                  <td>OTP expired. Request a new one.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Session Mode</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/auth/session-mode</code>
            </div>
            <p>Set session mode for the current user.</p>

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
                  <td><code>mode</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Session mode</td>
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
