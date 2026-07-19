# FlowZen API Documentation

Complete API reference for integrating with FlowZen mobile application. Build custom clients and automate workflows.

## Base URL

```
https://flowzen-azure.vercel.app/api  
```

All endpoints are relative to `/api`. Responses are JSON unless noted otherwise.

## For using api, URL

```
https://flowzen-azure.vercel.app  
```

---

## Authentication

FlowZen uses NextAuth.js for web authentication. For mobile/Android apps, use the Mobile Login endpoint which returns a JWT token.

**Mobile Auth Flow (Existing Users):**
1. `POST /api/auth/mobile-login` → get JWT token
2. Use token in all subsequent requests: `Authorization: Bearer <token>`
3. Token is valid for 1 year.

**Mobile Auth Flow (New Users):**
1. `POST /api/auth/register` → creates account, sends OTP email
2. `POST /api/auth/verify-otp` → returns JWT token
3. Use token in all subsequent requests: `Authorization: Bearer <token>`

### POST /api/auth/mobile-login

Login with email and password. Returns a JWT token for mobile app authentication.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Required | Registered email address |
| password | string | Required | Account password |

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee",
    "avatarUrl": "...",
    "company": "Acme Corp",
    "companyColor": "#6366f1",
    "team": "Engineering"
  }
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 401 | Invalid email or password |
| 401 | This account uses social login |
| 403 | Please verify your email with the OTP sent during signup before logging in |

**Android Usage:**
```kotlin
// 1. Login
val response = httpClient.post("/api/auth/mobile-login") {
    setBody(mapOf(
        "email" to "user@example.com",
        "password" to "password123"
    ))
}
val token = response.token

// 2. Use token in subsequent requests
httpClient.get("/api/profile") {
    header("Authorization", "Bearer $token")
}
```

### POST /api/auth/register

Create a new user account. Sends a 6-digit OTP to the provided email for verification.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Required | Full name |
| email | string | Required | Email address |
| password | string | Required | Password (min 8 chars) |
| role | string | Optional | Role (employee, project-manager, qa-tester, human-resource, finance, admin, others). Default: employee |

**Response (200):**
```json
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee"
  },
  "message": "OTP sent to your email."
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | Name, email, and an 8+ character password are required |
| 409 | An account with this email already exists |
| 500 | Unable to send OTP email |

### POST /api/auth/verify-otp

Verify email with OTP code sent during registration. Returns a JWT token for mobile app authentication.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Required | Email address |
| otp | string | Required | 6-digit OTP code |

**Response (200):**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee",
    "avatarUrl": "...",
    "company": "Acme Corp",
    "companyColor": "#6366f1",
    "team": "Engineering"
  }
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | Email and a valid 6-digit OTP are required |
| 401 | Invalid OTP |
| 404 | Account not found |
| 410 | OTP expired. Please sign up again |

**Android Usage (Register → Verify OTP → Use Token):**
```kotlin
// 1. Register
val regResponse = httpClient.post("/api/auth/register") {
    setBody(mapOf(
        "name" to "John Doe",
        "email" to "john@example.com",
        "password" to "password123"
    ))
}

// 2. Verify OTP (returns token)
val verifyResponse = httpClient.post("/api/auth/verify-otp") {
    setBody(mapOf(
        "email" to "john@example.com",
        "otp" to "123456"
    ))
}
val token = verifyResponse.token

// 3. Use token in subsequent requests
httpClient.get("/api/profile") {
    header("Authorization", "Bearer $token")
}
```

### POST /api/auth/forgot-password

Send password reset email.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Required | Registered email address |

**Response:** `{ "success": true }`

### POST /api/auth/check-pending

Check if user has pending approval.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Required | Email address |

**Response:** `{ "pending": true }`

### POST /api/auth/session-mode

Set session mode for the current user.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mode | string | Required | Session mode |

**Response:** `{ "success": true }`

---

## Public Endpoints (No Auth Required)

### Careers

#### GET /api/public/jobs

Get all open job listings grouped by company.

**Response (200):**
```json
{
  "companies": [
    {
      "company": {
        "id": "...",
        "name": "Acme Corp",
        "icon": "..."
      },
      "jobs": [
        {
          "id": "...",
          "title": "Software Engineer",
          "department": "Engineering",
          "location": "Remote",
          "employmentType": "full-time",
          "salaryRangeMin": 80000,
          "salaryRangeMax": 120000,
          "salaryType": "per-annum",
          "currency": "USD",
          "openings": 3,
          "description": "...",
          "requiredSkills": ["React", "Node.js"],
          "status": "open",
          "createdAt": "2024-01-15T10:30:00Z"
        }
      ]
    }
  ]
}
```

#### GET /api/public/jobs/[id]

Get details of a specific open job.

**Path Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Required | Job ID |

**Response (200):**
```json
{
  "job": {
    "id": "...",
    "title": "Software Engineer",
    "department": "Engineering",
    "location": "Remote",
    "employmentType": "full-time",
    "salaryRangeMin": 80000,
    "salaryRangeMax": 120000,
    "description": "...",
    "requiredSkills": ["React", "Node.js"],
    "company": {
      "id": "...",
      "name": "Acme Corp",
      "icon": "..."
    }
  }
}
```

**Errors:** 404 - Job not found

#### POST /api/public/jobs/[id]/apply

Apply for a specific job. Requires multipart/form-data for resume upload.

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Required | Job ID (path param) |
| firstName | string | Required | First name |
| lastName | string | Optional | Last name |
| email | string | Required | Email address |
| phone | string | Optional | Phone number |
| currentCompany | string | Optional | Current company |
| experienceYears | number | Optional | Years of experience |
| noticePeriod | number | Optional | Notice period in days |
| resume | file | Required | Resume file (PDF, max 20MB) |
| portfolioUrl | string | Optional | Portfolio URL |
| linkedInUrl | string | Optional | LinkedIn profile URL |
| notes | string | Optional | Additional notes |
| referralId | string | Optional | Employee referral ID |

**Response (201):**
```json
{
  "success": true,
  "candidateId": "..."
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | First name is required / Resume is required |
| 400 | Resume exceeds 20 MB limit |
| 400 | This job is no longer accepting applications |
| 404 | Job not found |

**cURL Example:**
```bash
curl -X POST https://flowzen-azure.vercel.app/api/public/jobs/JOB_ID/apply \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "email=john@example.com" \
  -F "phone=+1234567890" \
  -F "resume=@resume.pdf" \
  -F "referralId=ACME-001"
```

#### GET /api/public/jobs/[id]/verify-referral

Verify a referral ID is valid for a specific job.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| referralId | string | Required | Referral ID to verify |

**Response (200):**
```json
{
  "name": "John Doe",
  "company": "Acme Corp"
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | referralId query parameter is required |
| 404 | Job not found / Referral employee not found |

#### GET /api/public/verify/[identityCode]

Verify an employee's company identity code. Returns employee and company info if valid and the ID card has been issued and not revoked.

**Path Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| identityCode | string | Required | Employee identity code |

**Response (200) - Verified:**
```json
{
  "verified": true,
  "name": "John Doe",
  "role": "Software Engineer",
  "companyIdentityCode": "ACME-001",
  "companyJoined": "2024-01-15T00:00:00Z",
  "companyStatus": "approved",
  "avatarUrl": "https://...",
  "company": {
    "name": "Acme Corp",
    "icon": "https://...",
    "status": "active",
    "primaryColor": "#6366f1"
  }
}
```

**Response (200) - Not Verified:**
```json
{
  "verified": false,
  "reason": "not-found",
  "message": "No employee found with this ID."
}
```

**Failure Reasons:**
| Reason | Description |
|--------|-------------|
| not-found | No employee found with this identity code |
| revoked | The ID card has been revoked. Contact HR. |
| not-issued | No ID card has been issued for this employee |

**Errors:** 400 - Invalid identity code

**Example:**
```
GET https://flowzen-azure.vercel.app/api/public/verify/ACME-001
```

#### GET /api/public/verify-visitor/[identityCode]

Verify a visitor's identity code. Returns visitor pass details if valid and approved.

**Path Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| identityCode | string | Required | Visitor identity code |

**Response (200) - Verified:**
```json
{
  "verified": true,
  "visitorName": "Jane Smith",
  "visitorCompany": "Tech Inc",
  "purpose": "Meeting",
  "hostName": "John Doe",
  "validFrom": "2024-02-01T09:00:00Z",
  "validUntil": "2024-02-01T17:00:00Z"
}
```

**Response (200) - Not Verified:**
```json
{
  "verified": false,
  "reason": "not-found"
}
```

**Failure Reasons:**
| Reason | Description |
|--------|-------------|
| not-found | No visitor pass found with this identity code |
| expired | Visitor pass has expired |
| not-approved | Visitor pass is not approved (pending or rejected) |

**Example:**
```
GET https://flowzen-azure.vercel.app/api/public/verify-visitor/VIS789
```

#### GET /api/public/visitor/event/[slug]

Get visitor event details by slug.

**Path Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| slug | string | Required | Event slug |

**Response (200):**
```json
{
  "event": {
    "id": "...",
    "slug": "tech-meetup-2024",
    "visitorCompany": "Tech Inc",
    "expectedDate": "2024-02-01",
    "purpose": "Tech Meetup",
    "hostName": "John Doe",
    "status": "upcoming"
  }
}
```

#### POST /api/public/visitor/register/[slug]

Register as a visitor for an event (multipart/form-data).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| slug | string | Required | Event slug (path param) |
| visitorName | string | Required | Your full name |
| visitorEmail | string | Required | Your email |
| visitorPhone | string | Optional | Your phone number |
| visitorCompany | string | Optional | Your company |
| purpose | string | Optional | Purpose of visit |
| region | string | Optional | Region |
| visitAddress | string | Optional | Visit address |
| idDocument | file | Optional | ID document (max 10MB) |

**Response (201):**
```json
{
  "pass": {
    "id": "...",
    "status": "pending",
    "identityCode": "VIS789"
  }
}
```

### Candidate Portal

#### GET /api/public/candidate/me

Get candidate profile, timeline, interviews, and offer details.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Required | Magic token from email |

**Response (200):**
```json
{
  "candidate": {
    "id": "...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "stage": "screening",
    "job": {
      "title": "Software Engineer",
      "department": "Engineering",
      "location": "Remote"
    }
  },
  "timeline": [
    {
      "action": "applied",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "interviews": [
    {
      "roundType": "technical",
      "scheduledAt": "2024-01-20T14:00:00Z",
      "interviewer": { "name": "HR User" }
    }
  ],
  "offer": {
    "offeredCTC": 120000,
    "designation": "Senior Engineer",
    "status": "sent"
  }
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | Token is required |
| 401 | Invalid or expired link |

#### PATCH /api/public/candidate/me/offer

Accept or reject a job offer.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Required | Magic token from email |

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Required | Action (accept/reject) |

**Response (200):**
```json
{
  "offer": {
    "id": "...",
    "status": "accepted",
    "offeredCTC": 120000
  }
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | action must be 'accept' or 'reject' |
| 400 | Offer is not in a pending state |
| 404 | No offer found |
| 401 | Invalid or expired link |

#### GET /api/public/candidate/me/letter

Download the offer letter as HTML.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Required | Magic token from email |

**Response:** Returns HTML content with `Content-Type: text/html`

**Errors:** 404 - No offer found / Invalid or expired link

---

## App Module

### Dashboard

#### GET /api/company

Get current user's company details.

**Response:**
```json
{
  "company": {
    "id": "...",
    "name": "Acme Corp",
    "status": "active",
    "joinCode": "ABC123",
    "primaryColor": "#6366f1",
    "icon": "...",
    "address": "...",
    "members": ["userId1", "userId2"],
    "noticePeriodDays": 30,
    "paidLeaveDays": 12,
    "wfhDays": 5,
    "minWorkHours": 8
  }
}
```

#### GET /api/users

Get all users in the company.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | Optional | Filter by role (admin, human-resource, etc.) |

**Response:**
```json
{
  "users": [
    {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee",
      "avatarUrl": "...",
      "company": "companyId"
    }
  ]
}
```

#### GET /api/company/admins

Get all company administrators.

**Response:**
```json
{
  "admins": [
    {
      "id": "...",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin"
    }
  ]
}
```

#### GET /api/company/hrs

Get all HR members in the company.

**Response:**
```json
{
  "hrs": [
    {
      "id": "...",
      "name": "HR User",
      "email": "hr@example.com",
      "role": "human-resource"
    }
  ]
}
```

#### GET /api/company/members/birthdays

Get upcoming member birthdays.

**Response:**
```json
{
  "birthdays": [
    {
      "id": "...",
      "name": "John",
      "dob": "1990-05-15",
      "avatarUrl": "..."
    }
  ]
}
```

### Profile

#### GET /api/profile

Get current user's full profile.

**Response:**
```json
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "employee",
    "dob": "1990-05-15",
    "address": "123 Main St",
    "avatarUrl": "...",
    "bloodGroup": "O+",
    "emergencyContact": {
      "name": "Jane Doe",
      "phone": "+1234567891",
      "relation": "Spouse"
    },
    "company": "companyId",
    "team": "teamId",
    "regionLabel": "US-East"
  }
}
```

#### PATCH /api/profile

Update current user's profile information.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Optional | Full name |
| phone | string | Optional | Phone number |
| dob | string | Optional | Date of birth (ISO) |
| address | string | Optional | Home address |
| bloodGroup | string | Optional | Blood group |
| emergencyContact | object | Optional | { name, phone, relation } |
| customRole | string | Optional | Custom job title |

**Response:** `{ "user": { ... updated user } }`

#### DELETE /api/profile

Delete current user's account. **Response:** `{ "success": true }`

#### POST /api/profile/image

Upload or update profile avatar.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| avatarUrl | string | Required | URL of uploaded image |

**Response:** `{ "user": { ... updated user with avatarUrl } }`

#### DELETE /api/profile/image

Remove profile avatar. **Response:** `{ "success": true }`

#### GET /api/profile/documents

Get user's uploaded documents.

**Response:**
```json
{
  "documents": [
    {
      "id": "...",
      "category": "identity",
      "fileName": "passport.pdf",
      "fileType": "application/pdf",
      "fileUrl": "...",
      "fieldValues": {}
    }
  ]
}
```

#### POST /api/profile/documents

Add a new document to profile.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| category | string | Required | Document category |
| fileName | string | Required | Original filename |
| fileType | string | Required | MIME type |
| fileSize | number | Required | File size in bytes |
| fileUrl | string | Required | URL of uploaded file |
| fieldValues | object | Optional | Additional metadata |

**Response:** `{ "document": { ... created document } }`

#### DELETE /api/profile/documents

Remove a document from profile.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| documentId | string | Required | Document ID to delete |

**Response:** `{ "success": true }`

#### POST /api/profile/email/verify

Send OTP to verify new email address.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Required | New email address |

**Response:** `{ "success": true }`

#### POST /api/profile/email/confirm

Confirm email change with OTP.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Required | New email address |
| otp | string | Required | 6-digit OTP code |

**Response:** `{ "success": true }`

#### GET /api/profile/id-card/status

Check ID card request status.

**Response:**
```json
{
  "status": "pending",
  "request": {
    "id": "...",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### POST /api/profile/id-card/request

Request a new ID card.

**Response:**
```json
{
  "request": {
    "id": "...",
    "status": "pending"
  }
}
```

#### POST /api/profile/identity-code/request

Request a new identity code for security scanning.

**Response:**
```json
{
  "request": {
    "id": "...",
    "status": "pending"
  }
}
```

#### GET /api/profile/monthly-check

Get monthly attendance/salary check status.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | Required | Month in YYYY-MM format |

**Response:** `{ "checked": true, "salary": 50000 }`

#### GET /api/profile/jobs

Get jobs associated with current user.

**Response:** `{ "jobs": [...] }`

### Onboarding

#### POST /api/company

Create a new company. User becomes the owner.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Required | Company name |

**Response:**
```json
{
  "company": {
    "id": "...",
    "name": "Acme Corp",
    "joinCode": "ABC123",
    "owner": "userId",
    "status": "active"
  }
}
```

#### POST /api/company/join

Request to join a company using join code.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| joinCode | string | Required | Company join code |

**Response:** `{ "success": true }`

#### POST /api/company/quit

Request to leave current company.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| replacementUserId | string | Optional | User to transfer ownership (if owner) |

**Response:** `{ "success": true }`

#### POST /api/team

Create a new team within the company.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Required | Team name |
| joinCode | string | Optional | Custom join code (auto-generated if not provided) |

**Response:**
```json
{
  "team": {
    "id": "...",
    "name": "Engineering",
    "joinCode": "ENG123",
    "company": "companyId"
  }
}
```

#### POST /api/team/join

Request to join a team using join code.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| joinCode | string | Required | Team join code |

**Response:** `{ "success": true }`

#### POST /api/team/quit

Leave current team. **Response:** `{ "success": true }`

#### POST /api/team/kick

Remove a member from the team (manager only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID to remove |

**Response:** `{ "success": true }`

#### POST /api/team/delete

Delete a team (owner/admin only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| teamId | string | Required | Team ID to delete |

**Response:** `{ "success": true }`

#### GET /api/join/preview

Preview company/team info before joining.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | Required | Join code |

**Response:**
```json
{
  "company": { "name": "Acme Corp", "..." : "..." },
  "team": { "name": "Engineering", "..." : "..." }
}
```

#### POST /api/join/cancel

Cancel a pending join request.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| requestId | string | Required | Request ID to cancel |

**Response:** `{ "success": true }`

#### POST /api/quit/cancel

Cancel a pending quit request.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| requestId | string | Required | Request ID to cancel |
| reason | string | Optional | Cancellation reason |

**Response:** `{ "success": true }`

### Members

#### GET /api/users

Get all users in the company. (Same as Dashboard)

#### PATCH /api/hr/member-role

Change a member's role (HR/Admin only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID |
| newRole | string | Required | New role (admin, human-resource, project-manager, etc.) |

**Response:** `{ "user": { ... updated user } }`

#### PATCH /api/hr/member-region

Update a member's region/office location.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID |
| regionLabel | string | Required | Region label |

**Response:** `{ "user": { ... updated user } }`

#### POST /api/hr/member-salary/[id]

Set or update a member's salary (HR only).

**Path Params:** `id` - User ID

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| salary | number | Required | Annual salary amount |
| currency | string | Optional | Currency code (default: INR) |

**Response:** `{ "user": { ... updated user with salary } }`

#### PATCH /api/hr/member-pf-esic/[id]

Update PF and ESIC details for a member.

**Path Params:** `id` - User ID

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pfNumber | string | Optional | PF account number |
| pfDeductionAmount | number | Optional | PF deduction amount |
| esicNumber | string | Optional | ESIC number |
| esicDeductionAmount | number | Optional | ESIC deduction amount |

**Response:** `{ "user": { ... updated user } }`

#### GET /api/hr/member-documents/[id]

Get documents of a specific member (HR only).

**Path Params:** `id` - User ID

**Response:** `{ "documents": [...] }`

#### POST /api/hr/fire

Terminate a member (HR/Admin only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID to terminate |
| reason | string | Optional | Termination reason |

**Response:** `{ "success": true }`

#### POST /api/hr/revoke-id-card

Revoke a member's ID card.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID |

**Response:** `{ "success": true }`

#### PATCH /api/hr/policy

Update company HR policies (HR only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| noticePeriodDays | number | Optional | Notice period in days |
| paidLeaveDays | number | Optional | Paid leave days per period |
| paidLeavePeriod | string | Optional | Leave period (monthly/yearly) |
| minWorkHours | number | Optional | Minimum work hours per day |

**Response:** `{ "company": { ... updated company } }`

### Visitors

#### GET /api/hr/visitor/passes

Get all visitor passes for the company.

**Response:**
```json
{
  "passes": [
    {
      "id": "...",
      "visitorName": "Jane Smith",
      "visitorEmail": "jane@example.com",
      "visitorPhone": "+1234567890",
      "purpose": "Meeting",
      "hostName": "John Doe",
      "status": "approved",
      "validFrom": "2024-01-15T09:00:00Z",
      "validUntil": "2024-01-15T18:00:00Z",
      "identityCode": "VIS123"
    }
  ]
}
```

#### POST /api/hr/visitor/passes

Create a new visitor pass.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| visitorName | string | Required | Visitor's full name |
| visitorEmail | string | Required | Visitor's email |
| visitorPhone | string | Optional | Visitor's phone |
| purpose | string | Optional | Visit purpose |
| hostName | string | Optional | Host employee name |
| validFrom | string | Optional | Valid from date (ISO) |
| validUntil | string | Optional | Valid until date (ISO) |

**Response:**
```json
{
  "pass": {
    "id": "...",
    "status": "pending",
    "identityCode": "VIS456"
  }
}
```

#### GET /api/hr/visitor/passes/[id]

Get a specific visitor pass.

#### PATCH /api/hr/visitor/passes/[id]

Update visitor pass status or details.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Optional | New status (approved/rejected/active/completed) |
| validFrom | string | Optional | Updated valid from date |
| validUntil | string | Optional | Updated valid until date |

#### GET /api/hr/visitor/events

Get all visitor events.

#### POST /api/hr/visitor/events

Create a new visitor event.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| slug | string | Required | URL-friendly identifier |
| visitorCompany | string | Optional | Visiting company name |
| expectedDate | string | Optional | Expected date (ISO) |
| purpose | string | Optional | Event purpose |
| hostName | string | Optional | Host name |
| hostEmail | string | Optional | Host email |
| notes | string | Optional | Additional notes |

#### GET /api/hr/visitor/events/[id]

Get a specific visitor event.

#### PATCH /api/hr/visitor/events/[id]

Update a visitor event.

#### DELETE /api/hr/visitor/events/[id]

Delete a visitor event.

### Security

#### POST /api/hr/security/scan

Scan an identity code for entry/exit (Security only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| identityCode | string | Required | Identity code to scan |

**Response:**
```json
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "avatarUrl": "..."
  },
  "entryLog": {
    "id": "...",
    "type": "entry",
    "method": "qr-scan",
    "timestamp": "2024-01-15T09:00:00Z"
  }
}
```

#### GET /api/hr/security/members

Get all security team members.

#### GET /api/hr/security/entry-logs

Get entry/exit logs with optional filters.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| from | string | Optional | Start date (YYYY-MM-DD) |
| to | string | Optional | End date (YYYY-MM-DD) |
| userId | string | Optional | Filter by user ID |

#### POST /api/hr/security/entry-logs

Manually create an entry/exit log.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Optional | User ID (for employees) |
| visitorPassId | string | Optional | Visitor pass ID (for visitors) |
| type | string | Required | Entry type (entry/exit) |
| method | string | Optional | Scan method (qr-scan/manual/id-card) |

#### GET /api/hr/security/emergency-contacts

Get all emergency contacts for the company.

#### GET /api/hr/security/lost-cards

Get all lost card reports.

#### POST /api/hr/security/lost-cards

Report a lost/stolen/damaged ID card.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User reporting the lost card |
| reason | string | Required | Reason (lost/stolen/damaged/not-working) |
| lastLocation | string | Optional | Last known location |
| lostDateTime | string | Optional | When card was lost (ISO) |
| policeComplaintNumber | string | Optional | Police complaint number (if stolen) |
| isEmergency | boolean | Optional | Mark as emergency |

#### PATCH /api/hr/security/lost-cards/[id]

Update lost card report status.

#### POST /api/hr/security/lost-cards/[id]/open-ticket

Open a ticket for lost card replacement.

#### POST /api/hr/security/lost-cards/[id]/accept-ticket

Accept a lost card ticket for processing.

#### POST /api/hr/security/lost-cards/[id]/complete-ticket

Mark a lost card ticket as completed.

#### POST /api/hr/security/lost-cards/[id]/disable-access

Disable access for a lost card.

#### POST /api/hr/security/lost-cards/[id]/found

Mark a lost card as found.

### Documents

#### GET /api/documents/my

Get current user's document requests.

#### GET /api/hr/document-categories

Get all document categories for the company.

#### PATCH /api/hr/document-categories

Update document categories (HR only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| categories | string[] | Required | Array of category names |

#### GET /api/hr/document-letter

Get all letter requests for the company.

#### POST /api/hr/document-letter

Create a new letter request (experience, salary, etc.).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| requester | string | Required | User ID requesting the letter |
| letterType | string | Required | Type of letter (experience/salary) |

#### PATCH /api/hr/document-letter/[id]

Update letter request status (approve/reject).

#### GET /api/documents/verify-bank

Verify bank details for a document.

### Approvals

#### GET /api/approvals

Get all pending approval requests for the current user.

#### PATCH /api/approvals/[id]

Approve or reject an approval request.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Required | New status (approved/hr-approved/rejected) |
| force | boolean | Optional | Force approval (skip workflow) |
| reason | string | Optional | Rejection reason |
| salaryAmount | number | Optional | Approved salary (for salary requests) |
| salaryCurrency | string | Optional | Currency (for salary requests) |
| letterContent | string | Optional | Letter content (for letter requests) |
| signed | boolean | Optional | Mark as signed |

### Messages

#### GET /api/messages

Get all messages for the current user.

**Response:**
```json
{
  "messages": [
    {
      "id": "...",
      "sender": { "id": "...", "name": "John", "avatarUrl": "..." },
      "recipient": { "id": "...", "name": "Jane" },
      "message": "Hello!",
      "receivedAt": "2024-01-15T10:30:00Z",
      "readAt": null
    }
  ]
}
```

#### POST /api/messages

Send a message to another user.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| recipient | string | Required | Recipient user ID |
| message | string | Required | Message content |

#### GET /api/messages/conversation

Get conversation with a specific user.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID to get conversation with |

#### GET /api/messages/unread-count

Get count of unread messages.

**Response:** `{ "count": 5 }`

### Finance

#### GET /api/finance

Get all salary records for the company.

#### POST /api/finance

Create a new salary record (Finance only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| employee | string | Required | Employee user ID |
| month | string | Required | Month (YYYY-MM) |
| baseSalary | number | Required | Base salary amount |
| allowances | number | Optional | Total allowances |
| deductions | number | Optional | Total deductions |

#### PATCH /api/finance

Update salary status (approve/reject).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| salaryId | string | Required | Salary record ID |
| status | string | Required | New status (approved/paid/rejected) |
| rejectionReason | string | Optional | Rejection reason |

#### GET /api/finance/salary/[id]

Get a specific salary record.

#### DELETE /api/finance/salary/[id]

Delete a salary record.

#### POST /api/finance/member-salary/[id]

Create salary for a specific member.

#### GET /api/finance/member-attendance/[id]

Get attendance summary for salary calculation.

#### GET /api/finance/policy

Get company finance policy.

#### POST /api/finance/policy

Create or update finance policy.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| foodAmount | number | Optional | Food allowance amount |
| travelAccommodationAmount | number | Optional | Travel allowance amount |
| pfPercentage | number | Optional | PF deduction percentage |
| esicPercentage | number | Optional | ESIC deduction percentage |
| tdsPercentage | number | Optional | TDS deduction percentage |

#### PATCH /api/finance/policy

Partially update finance policy.

#### GET /api/finance/salary-cycle

Get salary cycle configuration.

#### POST /api/finance/salary-cycle

Update salary cycle configuration.

#### POST /api/finance/salary-advance

Request a salary advance.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Required | Advance amount |
| reason | string | Required | Reason for advance |

#### GET /api/finance/salary-slip

Get salary slips for the current user.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | Optional | Filter by month (YYYY-MM) |

#### GET /api/finance/salary-slip/[id]

Get a specific salary slip.

#### GET /api/finance/leave-impact

Calculate salary impact of leaves.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Required | User ID |
| month | string | Required | Month (YYYY-MM) |

#### GET /api/finance/resource-request

Get all resource requests.

#### POST /api/finance/resource-request

Create a new resource request.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | Required | [{ name, quantity, reason }] |
| notes | string | Optional | Additional notes |

#### PATCH /api/finance/resource-request

Approve or reject a resource request.

#### GET /api/finance/invoice

Get all client invoices.

#### POST /api/finance/invoice

Create a new client invoice.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientName | string | Required | Client name |
| clientEmail | string | Optional | Client email |
| amount | number | Required | Invoice amount |
| description | string | Optional | Invoice description |
| board | string | Optional | Associated board ID |

#### PATCH /api/finance/invoice

Update invoice status.

#### GET /api/finance/reports

Get financial reports.

#### GET /api/finance/export

Export finance data as CSV.

### Attendance

#### POST /api/attendance/checkin

Check in for the day.

#### GET /api/attendance/checkin

Get attendance history and today's status.

#### POST /api/attendance/checkout

Check out for the day.

#### POST /api/attendance/checkout-request

Request early checkout approval.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| attendanceId | string | Required | Today's attendance ID |
| reason | string | Required | Reason for early checkout |
| assignedTo | string | Optional | Manager to approve |

#### GET /api/attendance/checkout-request

Get pending checkout requests (for managers).

#### PATCH /api/attendance/checkout-request/[id]

Approve or reject a checkout request.

#### GET /api/attendance/holidays

Get all company holidays.

#### POST /api/attendance/holidays

Create a new holiday (HR only).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Optional | Holiday name |
| description | string | Optional | Description |
| startDate | string | Required | Start date (YYYY-MM-DD) |
| endDate | string | Required | End date (YYYY-MM-DD) |

#### PUT /api/attendance/holidays

Update a holiday.

#### DELETE /api/attendance/holidays

Delete a holiday.

#### POST /api/attendance/leave

Request time off (leave).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| startDate | string | Required | Start date (YYYY-MM-DD) |
| endDate | string | Required | End date (YYYY-MM-DD) |
| reason | string | Required | Leave reason |
| attachmentUrl | string | Optional | Attachment URL |
| hrApprover | string | Optional | HR approver user ID |

#### GET /api/attendance/leave

Get leave requests and policy info.

#### PATCH /api/attendance/leave/[id]

Approve, reject, or revoke a leave request.

#### POST /api/attendance/wfh

Request work from home.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| startDate | string | Required | Start date (YYYY-MM-DD) |
| endDate | string | Required | End date (YYYY-MM-DD) |
| reason | string | Required | WFH reason |
| hrApprover | string | Optional | HR approver user ID |

#### GET /api/attendance/wfh

Get WFH requests and policy info.

#### PATCH /api/attendance/wfh/[id]

Approve, reject, or revoke a WFH request.

#### GET /api/attendance/export

Export attendance data as CSV.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| from | string | Required | Start date (YYYY-MM-DD) |
| to | string | Required | End date (YYYY-MM-DD) |

#### GET /api/company/wfh

Get company-wide WFH dates.

#### POST /api/company/wfh

Add company-wide WFH dates (Admin only).

#### PATCH /api/company/wfh

Update company WFH policy (Admin only).

#### DELETE /api/company/wfh

Remove company-wide WFH dates.

#### GET /api/company/weekends

Get company weekend dates.

#### POST /api/company/weekends

Add company weekend dates (Admin only).

#### DELETE /api/company/weekends

Remove company weekend dates.

### Calendar

#### GET /api/events

Get calendar events with optional filters.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| start | string | Optional | Start date filter (ISO) |
| end | string | Optional | End date filter (ISO) |

#### GET /api/company/meetings

Get company meetings for a specific date.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| date | string | Optional | Date filter (YYYY-MM-DD) |

#### POST /api/company/meetings

Create a new meeting.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Required | Meeting title |
| description | string | Optional | Meeting description |
| meetingType | string | Required | Type (online/offsite) |
| meetingLink | string | Optional | Online meeting link |
| location | string | Optional | Physical location |
| date | string | Required | Meeting date (YYYY-MM-DD) |
| time | string | Optional | Meeting time (HH:MM) |
| durationMinutes | number | Optional | Duration in minutes |
| participants | string[] | Required | Array of user IDs |

#### PATCH /api/company/meetings/[id]

Update meeting details or status.

#### POST /api/hr/meeting-invite

Send meeting invites to users.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| meetingId | string | Required | Meeting ID |
| userIds | string[] | Required | Array of user IDs to invite |

### Notifications

#### GET /api/notifications

Get paginated notifications for the current user.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| page | number | Optional | Page number (default: 1) |
| limit | number | Optional | Items per page (default: 20) |

#### PATCH /api/notifications

Mark all notifications as read.

#### DELETE /api/notifications

Delete all read notifications.

#### PATCH /api/notifications/[id]

Mark a specific notification as read.

#### DELETE /api/notifications/[id]

Delete a specific notification.

**Notification Types:** info, approval, project, deadline, system

---

## Recruitment Module

### Recruitment Dashboard

#### GET /api/recruitment/dashboard

Get recruitment dashboard statistics.

**Response:**
```json
{
  "stats": {
    "totalJobs": 15,
    "openJobs": 8,
    "totalCandidates": 120,
    "candidatesInProgress": 45,
    "offersExtended": 12,
    "offersAccepted": 8,
    "interviewsScheduled": 20
  }
}
```

#### GET /api/recruitment/sidebar-counts

Get sidebar badge counts for each section.

#### GET /api/recruitment/assigned-count

Get count of items assigned to current user.

#### GET /api/recruitment/stages

Get all available recruitment stages.

**Stages:** applied, screening, technical-interview, manager-round, hr-round, offer, joined, rejected

#### GET /api/recruitment/users-by-role

Get users filtered by role for assignment.

**Query Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | Required | Role to filter by |

### Recruitment Jobs

#### GET /api/recruitment/jobs

Get all jobs with optional filters.

#### POST /api/recruitment/jobs

Create a new job posting.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Required | Job title |
| department | string | Optional | Department |
| location | string | Optional | Job location |
| employmentType | string | Optional | Type (full-time/part-time/contract/internship) |
| salaryRangeMin | number | Optional | Minimum salary |
| salaryRangeMax | number | Optional | Maximum salary |
| salaryType | string | Optional | Salary type (per-annum/per-month) |
| currency | string | Optional | Currency code |
| openings | number | Optional | Number of openings |
| description | string | Optional | Job description |
| requiredSkills | string[] | Optional | Required skills |
| autoCloseDate | string | Optional | Auto-close date (ISO) |

#### GET /api/recruitment/jobs/[id]

Get a specific job posting.

#### PATCH /api/recruitment/jobs/[id]

Update a job posting.

#### DELETE /api/recruitment/jobs/[id]

Delete a job posting.

#### GET /api/recruitment/jobs/[id]/candidates

Get all candidates for a specific job.

#### POST /api/recruitment/jobs/request

Request HR to create a job posting.

#### GET /api/recruitment/jobs/request

Get all job requests.

#### GET /api/recruitment/jobs/my-tasks

Get jobs assigned to current user.

#### GET /api/recruitment/jobs/my-requests

Get job requests created by current user.

#### GET /api/recruitment/jobs/all-requests

Get all job requests (HR only).

### Recruitment Candidates

#### GET /api/recruitment/candidates

Get all candidates with optional filters.

#### POST /api/recruitment/candidates

Add a new candidate.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firstName | string | Required | First name |
| lastName | string | Optional | Last name |
| email | string | Required | Email address |
| phone | string | Optional | Phone number |
| job | string | Required | Job ID |
| source | string | Optional | Source (Referral/LinkedIn/Naukri/Indeed/Other) |
| currentCompany | string | Optional | Current company |
| experienceYears | number | Optional | Years of experience |
| currentCTC | number | Optional | Current CTC |
| expectedCTC | number | Optional | Expected CTC |
| noticePeriod | string | Optional | Notice period |

#### GET /api/recruitment/candidates/[id]

Get a specific candidate details.

#### PATCH /api/recruitment/candidates/[id]

Update candidate information.

#### DELETE /api/recruitment/candidates/[id]

Delete a candidate.

#### GET /api/recruitment/candidates/[id]/timeline

Get candidate activity timeline.

#### PATCH /api/recruitment/candidates/[id]/stage

Move candidate to a different stage.

#### POST /api/recruitment/candidates/[id]/stage-change-request

Request approval to change candidate stage.

#### POST /api/recruitment/candidates/[id]/resume

Upload or update candidate resume.

#### POST /api/recruitment/candidates/[id]/convert

Convert candidate to company employee.

#### GET /api/recruitment/candidates/[id]/offer

Get offer for a specific candidate.

#### POST /api/recruitment/candidates/[id]/offer

Create an offer for a candidate.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| offeredCTC | number | Required | Offered CTC |
| designation | string | Required | Job designation |
| joiningDate | string | Optional | Expected joining date |
| department | string | Optional | Department |
| officeLocation | string | Optional | Office location |
| perks | string | Optional | Perks description |

#### GET /api/recruitment/candidates/[id]/interviews

Get all interviews for a candidate.

#### POST /api/recruitment/candidates/[id]/interviews

Schedule an interview for a candidate.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| interviewer | string | Required | Interviewer user ID |
| roundType | string | Required | Round type (screening/technical/manager/hr) |
| scheduledAt | string | Required | Scheduled date/time (ISO) |
| meetingLink | string | Optional | Online meeting link |

#### POST /api/recruitment/candidates/[id]/assign-interviewer

Assign an interviewer to a candidate.

#### DELETE /api/recruitment/candidates/[id]/assign-interviewer

Remove an interviewer from a candidate.

### Recruitment Interviews

#### GET /api/recruitment/interviews

Get all interviews with optional filters.

#### PATCH /api/recruitment/interviews/[id]

Update interview status or reschedule.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Optional | New status (scheduled/completed/cancelled/rescheduled) |
| scheduledAt | string | Optional | Reschedule date/time (ISO) |
| meetingLink | string | Optional | Updated meeting link |

#### PATCH /api/recruitment/interviews/[id]/feedback

Submit interview feedback.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| technicalSkills | number | Required | Rating (1-5) |
| communication | number | Required | Rating (1-5) |
| problemSolving | number | Required | Rating (1-5) |
| cultureFit | number | Required | Rating (1-5) |
| overallRecommendation | string | Required | Recommendation (strong-hire/hire/hold/reject) |
| notes | string | Optional | Additional notes |

**Interview Statuses:** scheduled, completed, cancelled, rescheduled

**Round Types:** screening, technical, manager, hr

### Recruitment Offers

#### GET /api/recruitment/offers

Get all offers with optional filters.

#### GET /api/recruitment/offers/[id]

Get a specific offer details.

#### PATCH /api/recruitment/offers/[id]

Update offer status or details.

#### GET /api/recruitment/offers/[id]/letter

Get generated offer letter HTML.

**Offer Statuses:** draft, sent, accepted, rejected

**Salary Types:** per-annum, per-month

### Recruitment Referrals

#### GET /api/recruitment/referrals

Get all referrals with optional filters.

#### POST /api/recruitment/referrals

Create a new referral for a candidate.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firstName | string | Required | Candidate first name |
| lastName | string | Optional | Candidate last name |
| email | string | Required | Candidate email |
| phone | string | Optional | Candidate phone |
| jobId | string | Optional | Job ID to refer for |
| source | string | Optional | Referral source |

#### PATCH /api/recruitment/referrals/[id]

Update referral status.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Required | New status (pending/reviewed/hired/rejected) |

#### GET /api/public/jobs/[id]/verify-referral

Verify a referral ID is valid (public, no auth required).

**Referral Statuses:** pending, reviewed, hired, rejected

---

## Response Format

All endpoints return JSON in the following format:

```json
{
  "success": true,
  "data": { ... }
}
```

## Error Handling

Errors return appropriate HTTP status codes with a message:

```json
{
  "error": "Error message description"
}
```
