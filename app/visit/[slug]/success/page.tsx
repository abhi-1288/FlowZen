"use client";

import Link from "next/link";

export default function VisitorRegistrationSuccess() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6">
      <div className="rounded-full bg-green-100 p-4">
        <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Registration Submitted</h1>
      <p className="max-w-md text-center text-slate-500">
        Your visit registration has been submitted for approval. You will receive a confirmation once processed.
      </p>
      <Link href="/" className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
        Go to Home
      </Link>
    </div>
  );
}
