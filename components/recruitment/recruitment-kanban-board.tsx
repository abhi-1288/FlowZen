"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/client-utils";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { STAGES, STAGE_LABELS, type Stage, type ATSCandidate } from "@/lib/recruitment-types";

export function RecruitmentKanbanBoard({ candidates }: { candidates: ATSCandidate[] }) {
  const moveCandidateStage = useRecruitmentStore((s) => s.moveCandidateStage);
  const [activeCandidate, setActiveCandidate] = useState<ATSCandidate | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } })
  );

  function onDragStart(event: DragStartEvent) {
    const candidateId = event.active.id as string;
    const candidate = candidates.find((c) => c.id === candidateId);
    if (candidate) setActiveCandidate(candidate);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCandidate(null);
    const { active, over } = event;
    if (!over || !active) return;

    const candidateId = active.id as string;
    const overId = over.id as string;

    const toStage = STAGES.find((s) => overId === `column-${s}` || candidates.find((c) => c.id === overId));
    const targetStage = toStage || (STAGES.find((s) => overId === `column-${s}`));

    if (!targetStage) return;

    const candidate = candidates.find((c) => c.id === candidateId);
    if (candidate && candidate.stage !== targetStage) {
      void moveCandidateStage(candidateId, targetStage);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="task-scrollbar flex flex-1 gap-4 overflow-x-auto p-4 sm:p-6">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            candidates={candidates.filter((c) => c.stage === stage)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCandidate ? (
          <div className="w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-soft dark:border-zinc-800 dark:bg-[#000000]">
            <p className="text-sm font-semibold">{activeCandidate.firstName} {activeCandidate.lastName}</p>
            <p className="text-xs text-slate-500">{activeCandidate.experienceYears}y exp</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ stage, candidates }: { stage: Stage; candidates: ATSCandidate[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}`, data: { type: "column", stage } });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex max-h-full w-64 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-100/80 dark:border-zinc-800 dark:bg-[#000000]",
        isOver && "ring-2 ring-emerald-400"
      )}
    >
      <header className="flex items-center justify-between px-3 py-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{STAGE_LABELS[stage]}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-zinc-700 dark:text-zinc-300">{candidates.length}</span>
      </header>
      <div className="task-scrollbar min-h-24 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {candidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} />
        ))}
        {candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-700/70 dark:text-zinc-400">
            Drop here
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CandidateCard({ candidate }: { candidate: ATSCandidate }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    data: { type: "candidate", candidate },
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const recruiterName = candidate.assignedRecruiter
    ? typeof candidate.assignedRecruiter === "object"
      ? candidate.assignedRecruiter.name
      : ""
    : "";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-[#000000]",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          type="button"
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{candidate.firstName} {candidate.lastName}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {candidate.experienceYears > 0 ? `${candidate.experienceYears}y exp` : "Fresher"}
            {candidate.currentCompany ? ` - ${candidate.currentCompany}` : ""}
          </p>
          {(candidate as any).job && typeof (candidate as any).job === "object" && (candidate as any).job.title ? (
            <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">{(candidate as any).job.title}</p>
          ) : null}
        </div>
      </div>
      {(recruiterName || candidate.rating > 0) ? (
        <div className="mt-2 flex items-center justify-between">
          {recruiterName ? (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {recruiterName}
            </span>
          ) : <span />}
          {candidate.rating > 0 && (
            <span className="text-xs text-amber-500">{'★'.repeat(candidate.rating)}</span>
          )}
        </div>
      ) : null}
    </article>
  );
}
