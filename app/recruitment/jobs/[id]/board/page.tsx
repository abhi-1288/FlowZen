"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { RecruitmentKanbanBoard } from "@/components/recruitment/recruitment-kanban-board";

export default function JobBoardPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { activeJob, candidates, loading, fetchJob, fetchCandidates } = useRecruitmentStore();

  useEffect(() => { void fetchJob(id); void fetchCandidates({ jobId: id }); }, [id, fetchJob, fetchCandidates]);

  if (loading && !activeJob) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/recruitment/jobs/${id}`)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{activeJob?.title || "Job Board"}</h1>
            <p className="text-xs text-slate-500">{candidates.length} candidates</p>
          </div>
        </div>
      </header>
      <RecruitmentKanbanBoard candidates={candidates} />
    </div>
  );
}
