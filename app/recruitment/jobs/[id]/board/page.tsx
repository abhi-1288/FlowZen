"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { RecruitmentKanbanBoard } from "@/components/recruitment/recruitment-kanban-board";

function candidateJobId(candidate: { job: { id: string; title: string } | string }): string {
  const job = candidate.job as unknown as { _id?: string; id?: string } | string;
  if (!job) return "";
  if (typeof job === "string") return job;
  return job._id || job.id || "";
}

export default function JobBoardPage() {
  const params = useParams()!;
  const router = useRouter();
  const { candidates, loading, fetchJob, fetchCandidates, jobs, fetchJobs } = useRecruitmentStore();
  const [selectedJobId, setSelectedJobId] = useState<string>((params.id as string) || "");

  useEffect(() => {
    void fetchJobs({ limit: "0" });
  }, [fetchJobs]);

  useEffect(() => {
    if (!selectedJobId) return;
    void fetchJob(selectedJobId);
    void fetchCandidates({ jobId: selectedJobId });
  }, [selectedJobId, fetchJob, fetchCandidates]);

  const boardCandidates = candidates.filter((c) => candidateJobId(c) === selectedJobId);
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  if (selectedJobId && loading && !selectedJob) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-[var(--c-border-light)] bg-[var(--c-bg-card)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push(selectedJobId ? `/recruitment/jobs/${selectedJobId}` : "/recruitment/jobs")}
            className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-slate-500">Job</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="neu-inset mt-0.5 w-full max-w-sm rounded-lg px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a job to view its board…
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
          {selectedJob && (
            <div className="text-right">
              <h1 className="text-lg font-semibold text-slate-900">{selectedJob.title}</h1>
              <p className="text-xs text-slate-500">{boardCandidates.length} candidates</p>
            </div>
          )}
        </div>
      </header>

      {selectedJobId ? (
        <RecruitmentKanbanBoard candidates={boardCandidates} />
      ) : (
        <div className="grid flex-1 place-items-center">
          <p className="text-sm text-slate-500">Select a job above to view its candidate pipeline.</p>
        </div>
      )}
    </div>
  );
}
