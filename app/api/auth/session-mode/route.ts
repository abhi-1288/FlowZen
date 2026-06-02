import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { rememberMe } = await request.json();

  const cookieName =
    request.headers.get("cookie")?.includes("__Secure-next-auth.session-token")
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

  const rawCookie = request.headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith(cookieName + "="));

  if (!rawCookie) {
    return NextResponse.json({ ok: false, reason: "no session cookie" });
  }

  const value = rawCookie.split("=").slice(1).join("=").trim();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieName.startsWith("__Secure-"),
    maxAge: rememberMe ? 30 * 24 * 60 * 60 : undefined,
  });

  return response;
}
