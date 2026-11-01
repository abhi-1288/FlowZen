export const faqs = [
  {
    q: "What is FlowZen?",
    a: "FlowZen is a full-stack workspace that brings kanban boards, attendance and leave, finance and invoicing, HR and recruitment, IT support, office store and procurement, security, and company operations into one platform with role-based access.",
  },
  {
    q: "Can I use FlowZen without creating a company?",
    a: "Yes. You can use kanban boards and your personal profile as an individual. Company features such as HR, finance, recruitment, the office store, IT support, and the Command Center become available once you register or join a company.",
  },
  {
    q: "How does the recruitment pipeline work?",
    a: "HR and admins create job postings, manage candidates through the pipeline (new → screened → shortlisted → interviewed → offered → joined → rejected), schedule interviews with feedback, write structured notes, generate offer letters with a full CTC breakdown, and convert joined candidates into employees with provisioning handled by IT.",
  },
  {
    q: "What does the Command Center show?",
    a: "The Command Center is a role-aware dashboard for admins, HR, finance, project managers, IT, security, and individual members. It surfaces KPIs, trends, project health, items needing attention, upcoming events, and quick actions, scoped to a 7-day, 30-day, 3-month, or 1-year period and your region.",
  },
  {
    q: "How do store orders and procurement work?",
    a: "The office store is region-scoped: members browse the catalogue, add items to a cart, and submit an order that moves through pending → approved → fulfilled, with delivery or take-away fulfilment and printable issue invoices. Procurement is a separate request flow for laptops, desktops, software, electronics, internet, email, and office supplies — routed to IT or finance based on the requester's role and tracked end to end.",
  },
  {
    q: "What is temporary feature delegation?",
    a: "Delegation lets you hand a specific HR, finance, project, QA, IT, warehouse, or security action to a colleague for a limited period — up to 366 days. It is protected by an 8-digit Green-PIN, locks after five failed attempts, and requires the authorizer to verify before the delegated action is completed.",
  },
  {
    q: "Which games and audit features are included?",
    a: "FlowZen ships eight games — reaction, memory, pattern, typing, number, word, snakes & ladders, and chess — with company leaderboards, personal bests, and challenges. The Audit Center gives permitted roles a searchable trail of logins, approvals, role changes, delegations, store orders, provisioning, and other sensitive actions with IP, device, and result metadata.",
  },
  {
    q: "How do I get help?",
    a: "Start with the in-app documentation at /docs, which covers every module and API endpoint. Members can also raise an IT support ticket from /profile/it or the /it helpdesk, and HR can broadcast announcements from the profile hub.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Traffic is encrypted with TLS, passwords are hashed, sessions use NextAuth JWTs, and sensitive actions are recorded in the Audit Center. Access is enforced by eleven roles plus per-board and per-tab permissions, and high-risk actions such as delegation require PIN verification.",
  },
];
