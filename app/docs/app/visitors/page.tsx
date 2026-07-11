"use client";

import Link from "next/link";

export default function VisitorsDocsPage() {
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
            <Link href="/docs/app/visitors" className="docs-nav-link active">Visitors</Link>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Visitors</h1>

        <section className="docs-section">
          <p>Manage visitor passes and visitor events for your office.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Passes</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/visitor/passes</code>
            </div>
            <p>Get all visitor passes for the company.</p>

            <div className="docs-code">{"{\n  \"passes\": [\n    {\n      \"id\": \"...\",\n      \"visitorName\": \"Jane Smith\",\n      \"visitorEmail\": \"jane@example.com\",\n      \"visitorPhone\": \"+1234567890\",\n      \"purpose\": \"Meeting\",\n      \"hostName\": \"John Doe\",\n      \"status\": \"approved\",\n      \"validFrom\": \"2024-01-15T09:00:00Z\",\n      \"validUntil\": \"2024-01-15T18:00:00Z\",\n      \"identityCode\": \"VIS123\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Pass</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/visitor/passes</code>
            </div>
            <p>Create a new visitor pass.</p>

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
                  <td><code>visitorName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Visitor&apos;s full name</td>
                </tr>
                <tr>
                  <td><code>visitorEmail</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Visitor&apos;s email</td>
                </tr>
                <tr>
                  <td><code>visitorPhone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Visitor&apos;s phone</td>
                </tr>
                <tr>
                  <td><code>purpose</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Visit purpose</td>
                </tr>
                <tr>
                  <td><code>hostName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Host employee name</td>
                </tr>
                <tr>
                  <td><code>validFrom</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Valid from date (ISO)</td>
                </tr>
                <tr>
                  <td><code>validUntil</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Valid until date (ISO)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"pass\": {\n    \"id\": \"...\",\n    \"status\": \"pending\",\n    \"identityCode\": \"VIS456\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Pass</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/visitor/passes/[id]</code>
            </div>
            <p>Get a specific visitor pass.</p>

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
                  <td>Pass ID (path param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"pass\": { ... visitor pass object }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Pass</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/visitor/passes/[id]</code>
            </div>
            <p>Update visitor pass status or details.</p>

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
                  <td>Pass ID (path param)</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>New status (approved/rejected/active/completed)</td>
                </tr>
                <tr>
                  <td><code>validFrom</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Updated valid from date</td>
                </tr>
                <tr>
                  <td><code>validUntil</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Updated valid until date</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"pass\": { ... updated pass }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Events</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/visitor/events</code>
            </div>
            <p>Get all visitor events.</p>

            <div className="docs-code">{"{\n  \"events\": [\n    {\n      \"id\": \"...\",\n      \"slug\": \"tech-meetup-2024\",\n      \"visitorCompany\": \"Tech Inc\",\n      \"expectedDate\": \"2024-02-01\",\n      \"purpose\": \"Tech Meetup\",\n      \"hostName\": \"John Doe\",\n      \"status\": \"upcoming\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Create Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/hr/visitor/events</code>
            </div>
            <p>Create a new visitor event.</p>

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
                  <td><code>slug</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>URL-friendly identifier</td>
                </tr>
                <tr>
                  <td><code>visitorCompany</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Visiting company name</td>
                </tr>
                <tr>
                  <td><code>expectedDate</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Expected date (ISO)</td>
                </tr>
                <tr>
                  <td><code>purpose</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Event purpose</td>
                </tr>
                <tr>
                  <td><code>hostName</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Host name</td>
                </tr>
                <tr>
                  <td><code>hostEmail</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Host email</td>
                </tr>
                <tr>
                  <td><code>notes</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Additional notes</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"event\": {\n    \"id\": \"...\",\n    \"slug\": \"tech-meetup\",\n    \"status\": \"upcoming\"\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/hr/visitor/events/[id]</code>
            </div>
            <p>Get a specific visitor event.</p>

            <div className="docs-code">{"{\n  \"event\": { ... visitor event object }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/hr/visitor/events/[id]</code>
            </div>
            <p>Update a visitor event.</p>

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
                  <td><span className="badge-optional">Optional</span></td>
                  <td>New status (upcoming/ongoing/completed)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"event\": { ... updated event }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Delete Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-delete">DELETE</span>
              <code className="endpoint-path">/api/hr/visitor/events/[id]</code>
            </div>
            <p>Delete a visitor event.</p>

            <div className="docs-code">{"{\n  \"success\": true\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Public: Get Event by Slug</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/public/visitor/event/[slug]</code>
            </div>
            <p>Get visitor event by slug (public, no auth required).</p>

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
                  <td><code>slug</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Event slug (path param)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"event\": { ... public event info }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Public: Register for Event</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">/api/public/visitor/register/[slug]</code>
            </div>
            <p>Register as a visitor for an event (public, no auth required).</p>

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
                  <td><code>slug</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Event slug (path param)</td>
                </tr>
                <tr>
                  <td><code>visitorName</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Your name</td>
                </tr>
                <tr>
                  <td><code>visitorEmail</code></td>
                  <td>string</td>
                  <td><span className="badge-required">Required</span></td>
                  <td>Your email</td>
                </tr>
                <tr>
                  <td><code>visitorPhone</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Your phone</td>
                </tr>
                <tr>
                  <td><code>purpose</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>Visit purpose</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"pass\": {\n    \"id\": \"...\",\n    \"status\": \"pending\",\n    \"identityCode\": \"VIS789\"\n  }\n}"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
