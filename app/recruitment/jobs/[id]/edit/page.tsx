"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export default function EditJobPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { activeJob, fetchJob, updateJob } = useRecruitmentStore();

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("full-time");
  const [salaryRangeMin, setSalaryRangeMin] = useState("0");
  const [salaryRangeMax, setSalaryRangeMax] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [openings, setOpenings] = useState("1");
  const [autoCloseDate, setAutoCloseDate] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [status, setStatus] = useState("draft");

  useEffect(() => { void fetchJob(id); }, [id, fetchJob]);
  useEffect(() => {
    if (activeJob) {
      setTitle(activeJob.title);
      setDepartment(activeJob.department);
      setLocation(activeJob.location);
      setEmploymentType(activeJob.employmentType);
      setSalaryRangeMin(String(activeJob.salaryRangeMin));
      setSalaryRangeMax(String(activeJob.salaryRangeMax));
      setCurrency(activeJob.currency || "INR");
      setOpenings(String(activeJob.openings));
      setAutoCloseDate(activeJob.autoCloseDate ? activeJob.autoCloseDate.split("T")[0] : "");
      setDescription(activeJob.description);
      setRequiredSkills(activeJob.requiredSkills.join(", "));
      setStatus(activeJob.status);
    }
  }, [activeJob]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await updateJob(id, {
      title, department, location, employmentType: employmentType as any,
      salaryRangeMin: Number(salaryRangeMin), salaryRangeMax: Number(salaryRangeMax), currency,
      openings: Number(openings), autoCloseDate: autoCloseDate || null, description,
      requiredSkills: requiredSkills.split(",").map((s) => s.trim()).filter(Boolean),
      status: status as any,
    });
    router.push(`/recruitment/jobs/${id}`);
  }

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-semibold text-slate-900">Edit Job</h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Department *</span>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Employment Type</span>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
              <option value="full-time">Full Time</option>
              <option value="part-time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Min Salary</span>
            <input value={salaryRangeMin} onChange={(e) => setSalaryRangeMin(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Max Salary</span>
            <input value={salaryRangeMax} onChange={(e) => setSalaryRangeMax(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
              <option value="JPY">¥ JPY</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Openings</span>
            <input value={openings} onChange={(e) => setOpenings(e.target.value)} type="number" min="1" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Auto-Close Date</span>
            <input value={autoCloseDate} onChange={(e) => setAutoCloseDate(e.target.value)} type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Required Skills (comma separated)</span>
          <input value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <button type="submit" className="rounded-lg bg-slate-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Save Changes</button>
      </form>
    </div>
  );
}
