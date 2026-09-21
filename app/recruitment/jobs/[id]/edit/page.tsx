"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { MarkdownTextarea } from "@/components/recruitment/markdown-textarea";
import { dateInputValue, timeInputValue } from "@/lib/date-utils";

export default function EditJobPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { activeJob, fetchJob, updateJob, saving } = useRecruitmentStore();

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("full-time");
  const [salaryRangeMin, setSalaryRangeMin] = useState("0");
  const [salaryRangeMax, setSalaryRangeMax] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [openings, setOpenings] = useState("1");
  const [autoCloseDate, setAutoCloseDate] = useState("");
  const [autoCloseTime, setAutoCloseTime] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [status, setStatus] = useState("draft");
  const [durationUnit, setDurationUnit] = useState("months");
  const [durationValue, setDurationValue] = useState("");
  const [requiredExperienceYears, setRequiredExperienceYears] = useState("");
  const [requiredExperienceMaxYears, setRequiredExperienceMaxYears] = useState("");
  const [atsScoreThreshold, setAtsScoreThreshold] = useState("");
  const [assessment, setAssessment] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessmentTime, setAssessmentTime] = useState("");

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
      setAutoCloseDate(activeJob.autoCloseDate ? dateInputValue(activeJob.autoCloseDate) : "");
      setAutoCloseTime(activeJob.autoCloseDate ? timeInputValue(activeJob.autoCloseDate) : "");
      setDescription(activeJob.description);
      setRequiredSkills(activeJob.requiredSkills.join(", "));
      setStatus(activeJob.status);
      if (activeJob.durationYears) {
        setDurationUnit("years");
        setDurationValue(String(activeJob.durationYears));
      } else if (activeJob.durationMonths) {
        setDurationUnit("months");
        setDurationValue(String(activeJob.durationMonths));
      } else if (activeJob.durationDays) {
        setDurationUnit("days");
        setDurationValue(String(activeJob.durationDays));
      } else if (activeJob.durationHours) {
        setDurationUnit("hours");
        setDurationValue(String(activeJob.durationHours));
      } else {
        setDurationUnit("months");
        setDurationValue("");
      }
      setRequiredExperienceYears(activeJob.requiredExperienceYears ? String(activeJob.requiredExperienceYears) : "");
      setRequiredExperienceMaxYears(activeJob.requiredExperienceMaxYears ? String(activeJob.requiredExperienceMaxYears) : "");
      setAtsScoreThreshold(activeJob.atsScoreThreshold ? String(activeJob.atsScoreThreshold) : "");
      setAssessment(activeJob.assessment || false);
      setAssessmentDate(activeJob.assessmentDate ? dateInputValue(activeJob.assessmentDate) : "");
      setAssessmentTime(activeJob.assessmentDate ? timeInputValue(activeJob.assessmentDate) : "");
    }
  }, [activeJob]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    await updateJob(id, {
      title, department, location, employmentType: employmentType as any,
      durationMonths: durationUnit === "months" ? (durationValue ? Number(durationValue) : null) : null,
      durationDays: durationUnit === "days" ? (durationValue ? Number(durationValue) : null) : null,
      durationHours: durationUnit === "hours" ? (durationValue ? Number(durationValue) : null) : null,
      durationYears: durationUnit === "years" ? (durationValue ? Number(durationValue) : null) : null,
      requiredExperienceYears: requiredExperienceYears ? Number(requiredExperienceYears) : null,
      requiredExperienceMaxYears: requiredExperienceMaxYears ? Number(requiredExperienceMaxYears) : null,
      atsScoreThreshold: atsScoreThreshold ? Number(atsScoreThreshold) : null,
      assessment,
      assessmentDate: assessment && assessmentDate ? (assessmentTime ? `${assessmentDate}T${assessmentTime}:00` : `${assessmentDate}T00:00:00`) : null,
      salaryRangeMin: Number(salaryRangeMin), salaryRangeMax: Number(salaryRangeMax), currency,
      openings: Number(openings),
      autoCloseDate: autoCloseDate ? (autoCloseTime ? `${autoCloseDate}T${autoCloseTime}:00` : `${autoCloseDate}T23:59:59`) : null,
      description,
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Department *</span>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} required className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Employment Type</span>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
              <option value="full-time">Full Time</option>
              <option value="part-time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          {employmentType !== "full-time" && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Duration</span>
                <div className="flex gap-2">
                  <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} className="neu-inset w-1/3 rounded-lg px-3 py-2.5 text-sm">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                  <input value={durationValue} onChange={(e) => setDurationValue(e.target.value)} type="number" min="0" placeholder="e.g. 6" className="neu-inset w-2/3 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </label>
            </>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Required Experience (years)</span>
            <div className="flex items-center gap-2">
              <input value={requiredExperienceYears} onChange={(e) => setRequiredExperienceYears(e.target.value)} type="number" min="0" max="50" placeholder="Min, e.g. 1" className="neu-inset min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm" />
              <span className="text-sm text-slate-400">to</span>
              <input value={requiredExperienceMaxYears} onChange={(e) => setRequiredExperienceMaxYears(e.target.value)} type="number" min="0" max="50" placeholder="Max, e.g. 2" className="neu-inset min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">ATS Min Score (0-100)</span>
            <input value={atsScoreThreshold} onChange={(e) => setAtsScoreThreshold(e.target.value)} type="number" min="0" max="100" placeholder="e.g. 70" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assessment}
                onChange={(e) => setAssessment(e.currentTarget.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Enable Online Assessment (after Screening)</span>
            </label>
            {assessment && (
              <div className="mt-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Assessment Date & Time</span>
                  <div className="flex gap-2">
                    <input value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} type="date" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
                    <input value={assessmentTime} onChange={(e) => setAssessmentTime(e.target.value)} type="time" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                </label>
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Min Salary</span>
            <input value={salaryRangeMin} onChange={(e) => setSalaryRangeMin(e.target.value)} type="number" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Max Salary</span>
            <input value={salaryRangeMax} onChange={(e) => setSalaryRangeMax(e.target.value)} type="number" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
              <option value="JPY">¥ JPY</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Openings</span>
            <input value={openings} onChange={(e) => setOpenings(e.target.value)} type="number" min="1" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Auto-Close Date & Time</span>
            <div className="flex gap-2">
              <input value={autoCloseDate} onChange={(e) => setAutoCloseDate(e.target.value)} type="date" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
              <input value={autoCloseTime} onChange={(e) => setAutoCloseTime(e.target.value)} type="time" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Required Skills (comma separated)</span>
          <input value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <MarkdownTextarea value={description} onChange={setDescription} rows={5} />
        </div>
        <button type="submit" disabled={saving} className="neu-btn neu-btn-primary rounded-full px-6 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">Save Changes</button>
      </form>
    </div>
  );
}
