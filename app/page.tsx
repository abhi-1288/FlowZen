import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing/landing-page";
import { faqs } from "@/components/landing/faq-data";

const softwareApplicationLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FlowZen",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "FlowZen is an all-in-one HRMS platform for managing kanban boards, attendance, payroll finance, HR, document letters, recruitment, IT support, and team chat.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available with optional paid plans",
  },
  url: "https://flowzen.app",
  logo: "https://flowzen.app/Logos/logo.jpg",
  featureList: [
    "All-in-One HRMS",
    "Kanban Boards",
    "Real-time Sync",
    "Attendance Tracking",
    "Finance & Invoicing",
    "Document Letters & Co-signatures",
    "Recruitment Pipeline",
    "Team Chat",
    "IT Support Helpdesk",
    "Role-based Access Control",
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
  },
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FlowZen",
  url: "https://flowzen.app",
  logo: "https://flowzen.app/Logos/logo.jpg",
  description:
    "FlowZen is an all-in-one HRMS platform that unifies HR, recruitment, attendance, finance, boards, and team chat.",
};

const webSiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "FlowZen",
  url: "https://flowzen.app",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://flowzen.app/docs?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/profile");
  }

  return (
    <>
      {[softwareApplicationLd, organizationLd, webSiteLd, faqLd].map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      <LandingPage />
    </>
  );
}
