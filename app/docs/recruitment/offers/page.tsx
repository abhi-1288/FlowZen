"use client";

import Link from "next/link";

export default function OffersDocsPage() {
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
            <Link href="/docs/recruitment/candidates" className="docs-nav-link">Candidates</Link>
            <Link href="/docs/recruitment/interviews" className="docs-nav-link">Interviews</Link>
            <Link href="/docs/recruitment/offers" className="docs-nav-link active">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 24 }}>Offers</h1>

        <section className="docs-section">
          <p>Manage job offers, generate offer letters, and track offer status.</p>
        </section>

        <section className="docs-section">
          <h2>Get All Offers</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/offers</code>
            </div>
            <p>Get all offers with optional filters.</p>

            <div className="docs-code">{"{\n  \"offers\": [\n    {\n      \"id\": \"...\",\n      \"candidate\": { \"id\": \"...\", \"firstName\": \"John\" },\n      \"job\": { \"id\": \"...\", \"title\": \"Software Engineer\" },\n      \"offeredCTC\": 120000,\n      \"designation\": \"Senior Engineer\",\n      \"department\": \"Engineering\",\n      \"joiningDate\": \"2024-02-01\",\n      \"status\": \"sent\",\n      \"createdAt\": \"2024-01-15T10:30:00Z\"\n    }\n  ]\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Offer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/offers/[id]</code>
            </div>
            <p>Get a specific offer details.</p>

            <div className="docs-code">{"{\n  \"offer\": {\n    \"id\": \"...\",\n    \"candidate\": { ... },\n    \"job\": { ... },\n    \"offeredCTC\": 120000,\n    \"salaryType\": \"per-annum\",\n    \"pfAmount\": 14400,\n    \"esicAmount\": 0,\n    \"designation\": \"Senior Engineer\",\n    \"department\": \"Engineering\",\n    \"joiningDate\": \"2024-02-01\",\n    \"officeLocation\": \"Remote\",\n    \"perks\": \"Health insurance, stock options\",\n    \"status\": \"sent\",\n    \"isSigned\": false\n  }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Update Offer</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-patch">PATCH</span>
              <code className="endpoint-path">/api/recruitment/offers/[id]</code>
            </div>
            <p>Update offer status or details.</p>

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
                  <td>Offer ID (path param)</td>
                </tr>
                <tr>
                  <td><code>status</code></td>
                  <td>string</td>
                  <td><span className="badge-optional">Optional</span></td>
                  <td>New status (draft/sent/accepted/rejected)</td>
                </tr>
              </tbody>
            </table>

            <div className="docs-code">{"{\n  \"offer\": { ... updated offer }\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Get Offer Letter</h2>
          <div className="docs-card">
            <div className="docs-card-header">
              <span className="method-badge method-get">GET</span>
              <code className="endpoint-path">/api/recruitment/offers/[id]/letter</code>
            </div>
            <p>Get generated offer letter HTML.</p>

            <div className="docs-code">{"{\n  \"letterHtml\": \"<html>...offer letter content...</html>\"\n}"}</div>
          </div>
        </section>

        <section className="docs-section">
          <h2>Offer Statuses</h2>
          <div className="docs-card">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>draft</code></td>
                  <td>Offer is being prepared</td>
                </tr>
                <tr>
                  <td><code>sent</code></td>
                  <td>Offer sent to candidate</td>
                </tr>
                <tr>
                  <td><code>accepted</code></td>
                  <td>Candidate accepted the offer</td>
                </tr>
                <tr>
                  <td><code>rejected</code></td>
                  <td>Candidate rejected the offer</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2>Salary Types</h2>
          <div className="docs-card">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>per-annum</code></td>
                  <td>Annual salary</td>
                </tr>
                <tr>
                  <td><code>per-month</code></td>
                  <td>Monthly salary</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
