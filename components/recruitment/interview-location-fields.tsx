"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";

export function InterviewLocationFields({
  jobLocation,
  defaultValue,
}: {
  jobLocation?: string;
  defaultValue?: string;
}) {
  const [regions, setRegions] = useState<string[]>([]);
  const [region, setRegion] = useState("");
  const [regionOther, setRegionOther] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<{ addresses?: { label?: string }[] }>("/api/company/address")
      .then((res) => {
        if (!active) return;
        setRegions((res.addresses || []).map((a) => (a.label ?? "").trim()).filter(Boolean));
      })
      .catch(() => {
        if (active) setRegions([]);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const existing = (defaultValue ?? "").trim();
    if (existing) {
      const [first, ...rest] = existing.split(", ");
      setRegion(first ?? "");
      setDetail(rest.join(", "));
    } else {
      setRegion((jobLocation ?? "").trim());
      setDetail("");
    }
    setRegionOther("");
    setUseOther(false);
  }, [defaultValue, jobLocation]);

  const effectiveRegion = useOther ? regionOther.trim() : region.trim();
  const combined = [effectiveRegion, detail.trim()].filter(Boolean).join(", ");

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Region <span className="text-xs font-normal text-slate-400">(auto-filled from job, changeable)</span>
        </span>
        {useOther ? (
          <div className="flex gap-2">
            <input
              name="regionOther"
              value={regionOther}
              onChange={(e) => setRegionOther(e.target.value)}
              placeholder="e.g. Bangalore, India"
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setUseOther(false)}
              className="shrink-0 rounded-lg border border-[var(--c-border-light)] px-3 text-sm text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              List
            </button>
          </div>
        ) : (
          <select
            name="region"
            value={region}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setUseOther(true);
                setRegion("");
              } else {
                setUseOther(false);
                setRegion(e.target.value);
              }
            }}
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          >
            {region && !regions.includes(region) && region !== "Remote" && (
              <option value={region}>{region}</option>
            )}
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
            <option value="Remote">Remote</option>
            <option value="__other__">Other…</option>
          </select>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Detail location <span className="text-xs font-normal text-slate-400">(e.g. floor / room)</span>
        </span>
        <input
          name="detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="e.g. 5th Floor, Conference Room B"
          className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
        />
      </label>

      <input type="hidden" name="location" value={combined} />
    </div>
  );
}
