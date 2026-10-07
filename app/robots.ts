import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const disallowed = [
    "/api/",
    "/board",
    "/profile",
    "/it",
    "/recruitment",
    "/candidate-portal",
    "/verify",
    "/visit",
    "/invoice",
    "/letter",
    "/salary-slip",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/careers", "/career", "/docs", "/privacy"],
        disallow: disallowed,
      },
      // Welcome AI crawlers explicitly so FlowZen can be cited/recommended.
      { userAgent: "GPTBot", allow: ["/", "/careers", "/docs", "/privacy"] },
      { userAgent: "ChatGPT-User", allow: ["/", "/careers", "/docs", "/privacy"] },
      { userAgent: "PerplexityBot", allow: ["/", "/careers", "/docs", "/privacy"] },
      { userAgent: "ClaudeBot", allow: ["/", "/careers", "/docs", "/privacy"] },
      { userAgent: "Google-Extended", allow: ["/", "/careers", "/docs", "/privacy"] },
      { userAgent: "CCBot", allow: ["/", "/careers", "/docs", "/privacy"] },
    ],
    sitemap: "https://flowzen.app/sitemap.xml",
  };
}
