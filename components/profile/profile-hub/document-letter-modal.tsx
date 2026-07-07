"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

type Props = {
  mode: "request" | "send";
  onClose: () => void;
  onSuccess: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
};

type HrUser = {
  _id: string;
  name: string;
  email: string;
};

const LETTER_TYPES = [
  { value: "experience", label: "Experience Certificate" },
  { value: "salary-certificate", label: "Salary Certificate" },
  { value: "offer-letter", label: "Offer Letter" },
  { value: "relieving", label: "Relieving Letter" },
  { value: "internship", label: "Internship Certificate" },
  { value: "resignation", label: "Resignation Letter" },
  { value: "other", label: "Other" },
  { value: "id-card", label: "ID Card" },
];

export function DocumentLetterModal({ mode, onClose, onSuccess, showToast }: Props) {
  const [letterType, setLetterType] = useState(mode === "send" ? "resignation" : "experience");
  const availableLetterTypes = LETTER_TYPES.filter(lt => mode === "send" ? lt.value === "resignation" : lt.value !== "resignation");
  const [customType, setCustomType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hrs, setHrs] = useState<HrUser[]>([]);
  const [selectedHrId, setSelectedHrId] = useState("");
  const [internshipStart, setInternshipStart] = useState("");
  const [internshipEnd, setInternshipEnd] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectAchievements, setProjectAchievements] = useState("");
  const [resignationLastWorkingDay, setResignationLastWorkingDay] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [companyJoined, setCompanyJoined] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  function handlePreview() {
    if (letterType === "id-card") {
      setShowPreview(true);
      return;
    }
    if (letterType === "resignation" && !resignationLastWorkingDay) {
      showToast("Please enter the last working day first.", "error");
      return;
    }
    if (letterType === "internship" && (!internshipStart || !internshipEnd || !projectTitle || !projectDescription)) {
      showToast("Please fill in all required internship details first.", "error");
      return;
    }
    if (letterType === "other" && !customType.trim()) {
      showToast("Please enter a custom letter type first.", "error");
      return;
    }
    if (!purpose.trim()) {
      showToast("Please enter a purpose first.", "error");
      return;
    }

    if (!letterContent) {
      let content = "";
      if (letterType === "resignation") {
        const lastDayStr = new Date(resignationLastWorkingDay).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const reasonStr = purpose ? `\n\nReason for resignation: ${purpose}` : "";
        content = `Dear HR,\n\nPlease accept this letter as formal notification that I am resigning from my position. As per my notice period, my last working day will be ${lastDayStr}.${reasonStr}\n\nThank you for the opportunities I've had during my time with the company. I wish the company continued success in the future.\n\nSincerely,\n`;
      } else if (letterType === "internship") {
        const startStr = new Date(internshipStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const endStr = new Date(internshipEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        content = `Dear HR,\n\nI am writing to formally request an Internship Certificate for my work from ${startStr} to ${endStr}.\n\nDuring this time, I worked on the project "${projectTitle}". ${projectDescription}\n${projectAchievements ? `\nKey achievements: ${projectAchievements}\n` : ""}\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information.\n\nSincerely,\n`;
      } else {
        const typeLabel = letterType === "other" ? customType : LETTER_TYPES.find(l => l.value === letterType)?.label || "Document Letter";
        content = `Dear HR,\n\nI am writing to formally request a ${typeLabel}.\n\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information from my side to process this request.\n\nSincerely,\n`;
      }
      setLetterContent(content);
    }
    setShowPreview(true);
  }

  useEffect(() => {
    apiFetch<{ users: HrUser[] }>("/api/users?role=human-resource")
      .then((res) => {
        setHrs(res.users ?? []);
        if (res.users?.length === 1) {
          setSelectedHrId(res.users[0]._id);
        }
      })
      .catch(() => {});
    apiFetch<{ noticePeriodDays?: number; user?: { companyJoined?: string } }>("/api/profile")
      .then((res) => {
        if (res.noticePeriodDays) setNoticePeriodDays(res.noticePeriodDays);
        if (res.user?.companyJoined) setCompanyJoined(res.user.companyJoined);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (letterType === "resignation" && noticePeriodDays > 0) {
      const earliest = new Date();
      earliest.setDate(earliest.getDate() + noticePeriodDays);
      setResignationLastWorkingDay(earliest.toISOString().slice(0, 10));
    }
  }, [letterType, noticePeriodDays]);

  async function handleSubmit() {
    if (letterType === "id-card") {
      try {
        setSubmitting(true);
        await apiFetch("/api/profile/id-card/request", {
          method: "POST",
          body: JSON.stringify({ adminId: selectedHrId || undefined }),
        });
        showToast("ID card request sent for approval.");
        onSuccess();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to send request.", "error");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!purpose.trim()) {
      showToast("Please enter a purpose.", "error");
      return;
    }
    if (letterType === "other" && !customType.trim()) {
      showToast("Please enter a custom letter type.", "error");
      return;
    }
    if (letterType === "internship") {
      if (!internshipStart || !internshipEnd) {
        showToast("Please enter the internship start and end dates.", "error");
        return;
      }
      if (new Date(internshipEnd) <= new Date(internshipStart)) {
        showToast("End date must be after start date.", "error");
        return;
      }
      if (!projectTitle.trim()) {
        showToast("Please enter a project title.", "error");
        return;
      }
      if (!projectDescription.trim()) {
        showToast("Please describe what the project does.", "error");
        return;
      }
    }
    if (letterType === "resignation") {
      if (!resignationLastWorkingDay) {
        showToast("Please enter the last working day.", "error");
        return;
      }
      const earliest = new Date();
      earliest.setDate(earliest.getDate() + noticePeriodDays);
      if (new Date(resignationLastWorkingDay) < earliest) {
        showToast(`Last working day must be at least ${noticePeriodDays} days from today (notice period).`, "error");
        return;
      }
    }

    try {
      setSubmitting(true);
      await apiFetch("/api/hr/document-letter", {
        method: "POST",
        body: JSON.stringify({
          letterType,
          purpose: purpose.trim(),
          customType: customType.trim(),
          approverId: selectedHrId || undefined,
          internshipStart: letterType === "internship" ? internshipStart : undefined,
          internshipEnd: letterType === "internship" ? internshipEnd : undefined,
          projectTitle: letterType === "internship" ? projectTitle.trim() : undefined,
          projectDescription: letterType === "internship" ? projectDescription.trim() : undefined,
          projectAchievements: letterType === "internship" ? projectAchievements.trim() : undefined,
          resignationLastWorkingDay: letterType === "resignation" ? resignationLastWorkingDay : undefined,
          letterContent: letterContent.trim() ? letterContent.trim() : undefined,
        }),
      });
      showToast(mode === "send" ? "Resignation letter sent to HR." : "Document letter request sent for approval.");
      onSuccess();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit request.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-3">
            {showPreview ? (
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div>
              <h4 className="text-lg font-semibold text-slate-900">
                {showPreview ? "Edit Letter Content" : mode === "send" ? "Send Resignation Letter" : "Request Document Letter"}
              </h4>
              <p className="mt-0.5 text-sm text-slate-500">
                {letterType === "id-card" ? "Request an ID card for approval." : showPreview ? "Customize the text before submitting." : mode === "send" ? "Submit your resignation letter to HR." : "Submit a request to HR for a company document letter."}
              </p>
            </div>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {showPreview ? (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Letter Content</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                rows={12}
                value={letterContent}
                onChange={(e) => setLetterContent(e.target.value)}
              />
            </div>
          </div>
        ) : (
        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Letter Type
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
            >
              {availableLetterTypes.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>

          {letterType === "id-card" ? (
            <p className="text-sm text-slate-600">Select an HR to review and approve your ID card request. No additional details are needed.</p>
          ) : null}

          {letterType === "other" ? (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Custom Letter Type
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="e.g., Bonafide Certificate"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
              />
            </div>
          ) : null}

          {letterType === "internship" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    From Date
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={internshipStart}
                    onChange={(e) => setInternshipStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    To Date
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={internshipEnd}
                    onChange={(e) => setInternshipEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="e.g., Task Management Dashboard"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  What does it do? <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Briefly describe what the project does"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Achievements
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  rows={2}
                  placeholder="What did you achieve? (optional)"
                  value={projectAchievements}
                  onChange={(e) => setProjectAchievements(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {letterType === "resignation" ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Last Working Day <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={resignationLastWorkingDay}
                  onChange={(e) => setResignationLastWorkingDay(e.target.value)}
                  min={new Date(Date.now() + noticePeriodDays * 86400000).toISOString().slice(0, 10)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Notice period: {noticePeriodDays} days. Earliest last working day is{" "}
                  {new Date(Date.now() + noticePeriodDays * 86400000).toLocaleDateString("en-IN")}.
                </p>
              </div>
              {companyJoined ? (
                <p className="text-xs text-slate-500">
                  Joined company on: {new Date(companyJoined).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              ) : null}
            </>
          ) : null}

          {letterType !== "id-card" ? (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Purpose
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                rows={3}
                placeholder="e.g., For visa application, higher education, bank loan..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Assign to HR
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedHrId}
              onChange={(e) => setSelectedHrId(e.target.value)}
            >
              <option value="">Auto-assign</option>
              {hrs.map((hr) => (
                <option key={hr._id} value={hr._id}>
                  {hr.name} ({hr.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {letterType === "id-card"
                ? "Select the HR who will review and approve your ID card request."
                : hrs.length === 0
                  ? "No HR members found. The request will be auto-assigned."
                  : hrs.length > 1
                    ? "Select a specific HR or leave as auto-assign."
                    : ""}
            </p>
          </div>

          {letterType !== "id-card" ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePreview}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {letterContent ? "Edit Letter Content" : "Preview & Edit Letter Content"}
              </button>
            </div>
          ) : null}
        </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          {showPreview ? (
            <button
              className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white"
              type="button"
              onClick={() => setShowPreview(false)}
            >
              Done Editing
            </button>
          ) : (
            <>
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? "Submitting..." : (mode === "send" ? "Send Letter" : letterType === "id-card" ? "Request ID Card" : "Submit Request")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
