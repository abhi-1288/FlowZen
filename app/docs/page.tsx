"use client";

import Link from "next/link";

export default function DocsPage() {
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
            <Link href="/docs" className="docs-nav-link active">Overview</Link>
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
            <Link href="/docs/recruitment/offers" className="docs-nav-link">Offers</Link>
            <Link href="/docs/recruitment/referrals" className="docs-nav-link">Referrals</Link>
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <div className="docs-hero">
          <h1>FlowZen API Documentation</h1>
          <p>Complete API reference for integrating with FlowZen mobile application. Build custom clients and automate workflows.</p>
        </div>

        <section className="docs-section">
          <h2>Base URL</h2>
          <div className="docs-code">https://flowzen-azure.vercel.app/api</div>
          <h2>For using the api, use</h2>
          <div className="docs-code">https://flowzen-azure.vercel.app</div>
        </section>

        <section className="docs-section">
          <h2>Quick Start</h2>
          <p>FlowZen API uses standard REST conventions. All responses are JSON.</p>

          <div className="docs-info">
            <p><strong>Base URL:</strong> All endpoints are relative to <code>/api</code></p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Mobile App Authentication</h2>
          <p>For Android/iOS apps, use the mobile login endpoint to get a JWT token:</p>

          <div className="docs-code">{"// Step 1: Login\nPOST /api/auth/mobile-login\n{\n  \"email\": \"user@example.com\",\n  \"password\": \"your-password\"\n}\n\n// Response:\n{\n  \"token\": \"eyJhbGciOiJIUzI1NiIs...\",\n  \"user\": { ... }\n}\n\n// Step 2: Use token in all subsequent requests\nGET /api/profile\nAuthorization: Bearer eyJhbGciOiJIUzI1NiIs..."}</div>

          <div className="docs-info">
            <p><strong>Token Expiry:</strong> Tokens are valid for 1 year. Store securely on device.</p>
          </div>
        </section>

        <section className="docs-section">
          <h2>Modules</h2>
          <div className="docs-grid">
            <Link href="/docs/app/dashboard" className="docs-grid-card">
              <h3>Dashboard</h3>
              <p>Company overview and quick stats</p>
            </Link>
            <Link href="/docs/app/profile" className="docs-grid-card">
              <h3>Profile</h3>
              <p>User profile management</p>
            </Link>
            <Link href="/docs/app/onboarding" className="docs-grid-card">
              <h3>Onboarding</h3>
              <p>Company and team joining</p>
            </Link>
            <Link href="/docs/app/members" className="docs-grid-card">
              <h3>Members</h3>
              <p>Team member management</p>
            </Link>
            <Link href="/docs/app/visitors" className="docs-grid-card">
              <h3>Visitors</h3>
              <p>Visitor pass management</p>
            </Link>
            <Link href="/docs/app/security" className="docs-grid-card">
              <h3>Security</h3>
              <p>Entry logs and security</p>
            </Link>
            <Link href="/docs/app/documents" className="docs-grid-card">
              <h3>Documents</h3>
              <p>Document management</p>
            </Link>
            <Link href="/docs/app/approvals" className="docs-grid-card">
              <h3>Approvals</h3>
              <p>Request approvals</p>
            </Link>
            <Link href="/docs/app/messages" className="docs-grid-card">
              <h3>Messages</h3>
              <p>Internal messaging</p>
            </Link>
            <Link href="/docs/app/finance" className="docs-grid-card">
              <h3>Finance</h3>
              <p>Salary and finance management</p>
            </Link>
            <Link href="/docs/app/attendance" className="docs-grid-card">
              <h3>Attendance</h3>
              <p>Check-in/out and leaves</p>
            </Link>
            <Link href="/docs/app/calendar" className="docs-grid-card">
              <h3>Calendar</h3>
              <p>Events and meetings</p>
            </Link>
            <Link href="/docs/app/notifications" className="docs-grid-card">
              <h3>Notifications</h3>
              <p>User notifications</p>
            </Link>
          </div>
        </section>

        <section className="docs-section">
          <h2>Recruitment Module</h2>
          <div className="docs-grid">
            <Link href="/docs/recruitment/dashboard" className="docs-grid-card">
              <h3>Dashboard</h3>
              <p>Recruitment overview stats</p>
            </Link>
            <Link href="/docs/recruitment/jobs" className="docs-grid-card">
              <h3>Jobs</h3>
              <p>Job posting management</p>
            </Link>
            <Link href="/docs/recruitment/candidates" className="docs-grid-card">
              <h3>Candidates</h3>
              <p>Candidate tracking</p>
            </Link>
            <Link href="/docs/recruitment/interviews" className="docs-grid-card">
              <h3>Interviews</h3>
              <p>Interview scheduling</p>
            </Link>
            <Link href="/docs/recruitment/offers" className="docs-grid-card">
              <h3>Offers</h3>
              <p>Offer management</p>
            </Link>
            <Link href="/docs/recruitment/referrals" className="docs-grid-card">
              <h3>Referrals</h3>
              <p>Employee referrals</p>
            </Link>
          </div>
        </section>

        <section className="docs-section">
          <h2>Response Format</h2>
          <div className="docs-code">{"{\n  \"success\": true,\n  \"data\": { ... }\n}"}</div>
        </section>

        <section className="docs-section">
          <h2>Error Handling</h2>
          <p>Errors return appropriate HTTP status codes with a message:</p>
          <div className="docs-code">{"{\n  \"error\": \"Error message description\"\n}"}</div>
        </section>
      </main>
    </>
  );
}
