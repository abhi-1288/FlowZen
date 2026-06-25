"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/client-utils";
import type {
  ATSJob,
  ATSCandidate,
  ATSInterview,
  ATSOffer,
  ATSTimelineEntry,
  ATSReferral,
  DashboardData,
  Stage,
} from "@/lib/recruitment-types";

type ModalState =
  | { type: "create-job" }
  | { type: "edit-job"; jobId: string }
  | { type: "create-candidate"; jobId?: string }
  | { type: "edit-candidate"; candidateId: string }
  | { type: "schedule-interview"; candidateId: string }
  | { type: "edit-interview"; interviewId: string }
  | { type: "add-feedback"; interviewId: string }
  | { type: "generate-offer"; candidateId: string }
  | { type: "view-offer"; offerId: string }
  | { type: "view-job-description"; jobId: string }
  | { type: "delete-job"; jobId: string }
  | { type: "submit-referral" }
  | null;

type RecruitmentStore = {
  jobs: ATSJob[];
  candidates: ATSCandidate[];
  interviews: ATSInterview[];
  offers: ATSOffer[];
  timeline: ATSTimelineEntry[];
  referrals: ATSReferral[];
  dashboard: DashboardData | null;
  activeJob: ATSJob | null;
  activeCandidate: ATSCandidate | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  modal: ModalState;

  setModal: (modal: ModalState) => void;
  setError: (error: string | null) => void;

  fetchDashboard: () => Promise<void>;
  fetchJobs: (params?: Record<string, string>) => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  createJob: (data: Partial<ATSJob>) => Promise<ATSJob>;
  updateJob: (id: string, data: Partial<ATSJob>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;

  fetchCandidates: (params?: Record<string, string>) => Promise<void>;
  fetchCandidate: (id: string) => Promise<void>;
  createCandidate: (data: Partial<ATSCandidate>) => Promise<ATSCandidate>;
  updateCandidate: (id: string, data: Partial<ATSCandidate>) => Promise<void>;
  moveCandidateStage: (candidateId: string, toStage: Stage) => Promise<void>;
  convertToEmployee: (candidateId: string, password: string) => Promise<void>;
  deleteCandidate: (candidateId: string) => Promise<void>;
  silentRefreshCandidates: () => Promise<void>;

  fetchInterviews: (params?: Record<string, string>) => Promise<void>;
  createInterview: (data: Partial<ATSInterview>) => Promise<void>;
  updateInterview: (id: string, data: Partial<ATSInterview>) => Promise<void>;
  addFeedback: (id: string, feedback: ATSInterview["feedback"]) => Promise<void>;

  fetchOffers: (params?: Record<string, string>) => Promise<void>;
  createOffer: (data: Partial<ATSOffer>) => Promise<void>;
  updateOffer: (id: string, data: Partial<ATSOffer>) => Promise<void>;

  fetchTimeline: (candidateId: string) => Promise<void>;

  fetchReferrals: () => Promise<void>;
  createReferral: (data: { candidateId: string; referralBonusEligible: boolean }) => Promise<void>;

  uploadResume: (candidateId: string, file: File) => Promise<void>;
};

export const useRecruitmentStore = create<RecruitmentStore>((set, get) => ({
  jobs: [],
  candidates: [],
  interviews: [],
  offers: [],
  timeline: [],
  referrals: [],
  dashboard: null,
  activeJob: null,
  activeCandidate: null,
  loading: false,
  saving: false,
  error: null,
  modal: null,

  setModal: (modal) => set({ modal }),
  setError: (error) => set({ error }),

  fetchDashboard: async () => {
    try {
      const data = await apiFetch<DashboardData>("/api/recruitment/dashboard");
      set({ dashboard: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load dashboard." });
    }
  },

  fetchJobs: async (params) => {
    set({ loading: true, error: null });
    try {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      const { jobs } = await apiFetch<{ jobs: ATSJob[] }>(`/api/recruitment/jobs${query}`);
      set({ jobs });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load jobs." });
    } finally {
      set({ loading: false });
    }
  },

  fetchJob: async (id) => {
    set({ loading: true, error: null });
    try {
      const { job } = await apiFetch<{ job: ATSJob }>(`/api/recruitment/jobs/${id}`);
      set({ activeJob: job });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load job." });
    } finally {
      set({ loading: false });
    }
  },

  createJob: async (data) => {
    set({ saving: true, error: null });
    try {
      const { job } = await apiFetch<{ job: ATSJob }>("/api/recruitment/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      });
      set((state) => ({ jobs: [job, ...state.jobs] }));
      return job;
    } finally {
      set({ saving: false });
    }
  },

  updateJob: async (id, data) => {
    set({ saving: true, error: null });
    try {
      const { job } = await apiFetch<{ job: ATSJob }>(`/api/recruitment/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? job : j)),
        activeJob: state.activeJob?.id === id ? job : state.activeJob,
      }));
    } finally {
      set({ saving: false });
    }
  },

  deleteJob: async (id) => {
    await apiFetch(`/api/recruitment/jobs/${id}`, { method: "DELETE" });
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      activeJob: state.activeJob?.id === id ? null : state.activeJob,
    }));
  },

  fetchCandidates: async (params) => {
    set({ loading: true, error: null });
    try {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      const { candidates } = await apiFetch<{ candidates: ATSCandidate[] }>(`/api/recruitment/candidates${query}`);
      set({ candidates });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load candidates." });
    } finally {
      set({ loading: false });
    }
  },

  fetchCandidate: async (id) => {
    set({ loading: true, error: null });
    try {
      const { candidate } = await apiFetch<{ candidate: ATSCandidate }>(`/api/recruitment/candidates/${id}`);
      set({ activeCandidate: candidate });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load candidate." });
    } finally {
      set({ loading: false });
    }
  },

  createCandidate: async (data) => {
    set({ saving: true, error: null });
    try {
      const { candidate } = await apiFetch<{ candidate: ATSCandidate }>("/api/recruitment/candidates", {
        method: "POST",
        body: JSON.stringify(data),
      });
      set((state) => ({ candidates: [...state.candidates, candidate] }));
      return candidate;
    } finally {
      set({ saving: false });
    }
  },

  updateCandidate: async (id, data) => {
    set({ saving: true, error: null });
    try {
      const { candidate } = await apiFetch<{ candidate: ATSCandidate }>(`/api/recruitment/candidates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      set((state) => ({
        candidates: state.candidates.map((c) => (c.id === id ? candidate : c)),
        activeCandidate: state.activeCandidate?.id === id ? candidate : state.activeCandidate,
      }));
    } finally {
      set({ saving: false });
    }
  },

  moveCandidateStage: async (candidateId, toStage) => {
    set({ saving: true, error: null });
    try {
      const { candidate } = await apiFetch<{ candidate: ATSCandidate }>(
        `/api/recruitment/candidates/${candidateId}/stage`,
        { method: "PATCH", body: JSON.stringify({ stage: toStage }) }
      );
      set((state) => ({
        candidates: state.candidates.map((c) => (c.id === candidateId ? candidate : c)),
        activeCandidate: state.activeCandidate?.id === candidateId ? candidate : state.activeCandidate,
      }));
    } finally {
      set({ saving: false });
    }
  },

  convertToEmployee: async (candidateId, password) => {
    set({ saving: true, error: null });
    try {
      await apiFetch(`/api/recruitment/candidates/${candidateId}/convert`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
    } finally {
      set({ saving: false });
    }
  },

  deleteCandidate: async (candidateId) => {
    set({ saving: true, error: null });
    try {
      await apiFetch(`/api/recruitment/candidates/${candidateId}`, { method: "DELETE" });
      set((state) => ({
        candidates: state.candidates.filter((c) => c.id !== candidateId),
        activeCandidate: state.activeCandidate?.id === candidateId ? null : state.activeCandidate,
      }));
    } finally {
      set({ saving: false });
    }
  },

  silentRefreshCandidates: async () => {
    try {
      const { candidates } = await apiFetch<{ candidates: ATSCandidate[] }>("/api/recruitment/candidates");
      set({ candidates });
    } catch {}
  },

  fetchInterviews: async (params) => {
    set({ loading: true, error: null });
    try {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      const { interviews } = await apiFetch<{ interviews: ATSInterview[] }>(`/api/recruitment/interviews${query}`);
      set({ interviews });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load interviews." });
    } finally {
      set({ loading: false });
    }
  },

  createInterview: async (data) => {
    set({ saving: true, error: null });
    try {
      const { interview } = await apiFetch<{ interview: ATSInterview }>(`/api/recruitment/candidates/${data.candidate}/interviews`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      set((state) => ({ interviews: [...state.interviews, interview] }));
    } finally {
      set({ saving: false });
    }
  },

  updateInterview: async (id, data) => {
    set({ saving: true, error: null });
    try {
      const { interview } = await apiFetch<{ interview: ATSInterview }>(`/api/recruitment/interviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      set((state) => ({
        interviews: state.interviews.map((i) => (i.id === id ? interview : i)),
      }));
    } finally {
      set({ saving: false });
    }
  },

  addFeedback: async (id, feedback) => {
    set({ saving: true, error: null });
    try {
      const { interview } = await apiFetch<{ interview: ATSInterview }>(
        `/api/recruitment/interviews/${id}/feedback`,
        { method: "PATCH", body: JSON.stringify({ feedback }) }
      );
      set((state) => ({
        interviews: state.interviews.map((i) => (i.id === id ? interview : i)),
      }));
    } finally {
      set({ saving: false });
    }
  },

  fetchOffers: async (params) => {
    set({ loading: true, error: null });
    try {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      const { offers } = await apiFetch<{ offers: ATSOffer[] }>(`/api/recruitment/offers${query}`);
      set({ offers });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load offers." });
    } finally {
      set({ loading: false });
    }
  },

  createOffer: async (data) => {
    set({ saving: true, error: null });
    try {
      const { offer } = await apiFetch<{ offer: ATSOffer }>(`/api/recruitment/candidates/${data.candidate}/offer`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      set((state) => ({ offers: [...state.offers, offer] }));
    } finally {
      set({ saving: false });
    }
  },

  updateOffer: async (id, data) => {
    set({ saving: true, error: null });
    try {
      const { offer } = await apiFetch<{ offer: ATSOffer }>(`/api/recruitment/offers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      set((state) => ({
        offers: state.offers.map((o) => (o.id === id ? offer : o)),
      }));
    } finally {
      set({ saving: false });
    }
  },

  fetchTimeline: async (candidateId) => {
    set({ loading: true, error: null });
    try {
      const { timeline } = await apiFetch<{ timeline: ATSTimelineEntry[] }>(
        `/api/recruitment/candidates/${candidateId}/timeline`
      );
      set({ timeline });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load timeline." });
    } finally {
      set({ loading: false });
    }
  },

  fetchReferrals: async () => {
    set({ loading: true, error: null });
    try {
      const { referrals } = await apiFetch<{ referrals: ATSReferral[] }>("/api/recruitment/referrals");
      set({ referrals });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load referrals." });
    } finally {
      set({ loading: false });
    }
  },

  createReferral: async (data) => {
    set({ saving: true, error: null });
    try {
      const { referral } = await apiFetch<{ referral: ATSReferral }>("/api/recruitment/referrals", {
        method: "POST",
        body: JSON.stringify(data),
      });
      set((state) => ({ referrals: [...state.referrals, referral] }));
    } finally {
      set({ saving: false });
    }
  },

  uploadResume: async (candidateId, file) => {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File exceeds 2 MB limit.");
    }
    set({ saving: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/recruitment/candidates/${candidateId}/resume`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Resume upload failed.");
      set((state) => ({
        activeCandidate: state.activeCandidate?.id === candidateId
          ? { ...state.activeCandidate, resumeUrl: payload.url }
          : state.activeCandidate,
      }));
    } finally {
      set({ saving: false });
    }
  },
}));
