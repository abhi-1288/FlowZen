"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client-utils";

type CompanyAddress = {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type EventData = {
  id: string;
  visitorCompany: string;
  expectedDate: string;
  purpose: string;
  hostName: string;
  hostEmail: string;
  notes: string;
  status: string;
  company?: { name?: string; icon?: string; multiOffice?: boolean; addresses?: CompanyAddress[]; address?: string };
};

function formatAddress(a: CompanyAddress): string {
  const parts = [a.line1, a.city, a.state, a.zip, a.country].filter(Boolean);
  return parts.join(", ");
}

export default function VisitorRegisterPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [purpose, setPurpose] = useState("");
  const [region, setRegion] = useState("");
  const [idDocument, setIdDocument] = useState<File | null>(null);

  const addresses = useMemo(() => {
    if (!event?.company?.multiOffice || !Array.isArray(event.company.addresses)) return [];
    return event.company.addresses as CompanyAddress[];
  }, [event]);

  const singleAddress = useMemo(() => {
    if (event?.company?.multiOffice) return "";
    return event?.company?.address?.trim() ?? "";
  }, [event]);

  const regionOptions = useMemo(() => {
    if (addresses.length > 0) {
      return addresses.map((a) => ({ label: a.label, address: formatAddress(a) }));
    }
    if (singleAddress) {
      return [{ label: "Main Office", address: singleAddress }];
    }
    return [];
  }, [addresses, singleAddress]);

  const selectedAddress = useMemo(() => {
    if (!region) return null;
    return regionOptions.find((r) => r.label === region) ?? null;
  }, [region, regionOptions]);

  const visitAddress = selectedAddress ? selectedAddress.address : "";

  // Auto-select when only one option
  useEffect(() => {
    if (!region && regionOptions.length === 1) {
      setRegion(regionOptions[0].label);
    }
  }, [regionOptions, region]);

  useEffect(() => {
    if (!slug) return;
    apiFetch<{ event: EventData }>(`/api/public/visitor/event/${slug}`)
      .then((data) => {
        setEvent(data.event);
        setVisitorCompany(data.event.visitorCompany || "");
        setPurpose(data.event.purpose || "");
      })
      .catch(() => setError("Visit not found."))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!visitorName || !visitorEmail) return;
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("visitorName", visitorName);
      formData.set("visitorEmail", visitorEmail);
      if (visitorPhone) formData.set("visitorPhone", visitorPhone);
      if (visitorCompany) formData.set("visitorCompany", visitorCompany);
      if (purpose) formData.set("purpose", purpose);
      if (region) formData.set("region", region);
      if (visitAddress) formData.set("visitAddress", visitAddress);
      if (idDocument) formData.set("idDocument", idDocument);

      await fetch(`/api/public/visitor/register/${slug}`, {
        method: "POST",
        body: formData,
      });

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Visit Not Found</h1>
        <p className="text-slate-500">This visit registration link is invalid or has expired.</p>
        <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  if (submitted) {
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
        <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Visitor Registration</h1>
          {event?.visitorCompany ? (
            <p className="mb-6 text-sm text-slate-500">
              Visit from <span className="font-semibold text-slate-700">{event.visitorCompany}</span>
              {event.expectedDate ? (
                <> &middot; {new Date(event.expectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
              ) : null}
            </p>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={visitorName} onChange={(e) => setVisitorName(e.target.value)} required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={visitorCompany} onChange={(e) => setVisitorCompany(e.target.value)}
                readOnly={!!event?.visitorCompany}
              />
            </div>

            {regionOptions.length > 0 ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Visiting Office / Region</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {regionOptions.length > 1 ? <option value="">Select an office</option> : null}
                  {regionOptions.map((r) => (
                    <option key={r.label} value={r.label}>{r.label}</option>
                  ))}
                </select>
                {visitAddress ? (
                  <p className="mt-1 text-xs text-slate-400">{visitAddress}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Purpose of Visit</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                rows={3}
                value={purpose} onChange={(e) => setPurpose(e.target.value)}
                readOnly={!!event?.purpose}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ID Document (photo)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={(e) => setIdDocument(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-slate-400">Max 10 MB. Image or PDF.</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
