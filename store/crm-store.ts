"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/client-utils";

export type CrmEntity =
  | "companies"
  | "contacts"
  | "leads"
  | "deals"
  | "activities"
  | "quotations"
  | "tickets"
  | "workflows";

type RecordLike = { id?: string; _id?: string; [key: string]: unknown };

type CrmState = {
  companies: RecordLike[];
  contacts: RecordLike[];
  leads: RecordLike[];
  deals: RecordLike[];
  activities: RecordLike[];
  quotations: RecordLike[];
  tickets: RecordLike[];
  workflows: RecordLike[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  fetchEntity: (entity: CrmEntity) => Promise<void>;
  createRecord: (entity: CrmEntity, payload: Record<string, unknown>) => Promise<RecordLike | null>;
  updateRecord: (entity: CrmEntity, id: string, payload: Record<string, unknown>) => Promise<void>;
  deleteRecord: (entity: CrmEntity, id: string) => Promise<void>;
  patchRecord: (entity: CrmEntity, id: string, payload: Record<string, unknown>) => Promise<void>;
};

const singular: Record<CrmEntity, string> = {
  companies: "company",
  contacts: "contact",
  leads: "lead",
  deals: "deal",
  activities: "activity",
  quotations: "quotation",
  tickets: "ticket",
  workflows: "workflow",
};

export const useCrmStore = create<CrmState>((set, get) => ({
  companies: [],
  contacts: [],
  leads: [],
  deals: [],
  activities: [],
  quotations: [],
  tickets: [],
  workflows: [],
  loading: false,
  error: null,

  fetchEntity: async (entity) => {
    try {
      const result = await apiFetch<Record<string, unknown>>(`/api/crm/${entity}`, undefined, { toast: false });
      const list = Array.isArray(result?.[entity]) ? (result[entity] as RecordLike[]) : [];
      set({ [entity]: list } as Partial<CrmState>);
    } catch {
      set({ error: `Unable to load CRM ${entity}.` });
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    await Promise.all(
      (Object.keys(singular) as CrmEntity[]).map((entity) => get().fetchEntity(entity)),
    );
    set({ loading: false });
  },

  createRecord: async (entity, payload) => {
    const result = await apiFetch<Record<string, unknown>>(`/api/crm/${entity}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const record = result?.[singular[entity]] as RecordLike | undefined;
    if (record) {
      set({ [entity]: [record, ...(get()[entity] as RecordLike[])] } as Partial<CrmState>);
    } else {
      await get().fetchEntity(entity);
    }
    return record ?? null;
  },

  updateRecord: async (entity, id, payload) => {
    const result = await apiFetch<Record<string, unknown>>(`/api/crm/${entity}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const record = result?.[singular[entity]] as RecordLike | undefined;
    if (record) {
      set({
        [entity]: (get()[entity] as RecordLike[]).map((item) =>
          String(item.id ?? item._id) === id ? record : item,
        ),
      } as Partial<CrmState>);
    } else {
      await get().fetchEntity(entity);
    }
  },

  patchRecord: async (entity, id, payload) => {
    await get().updateRecord(entity, id, payload);
  },

  deleteRecord: async (entity, id) => {
    await apiFetch(`/api/crm/${entity}/${id}`, { method: "DELETE" });
    set({
      [entity]: (get()[entity] as RecordLike[]).filter(
        (item) => String(item.id ?? item._id) !== id,
      ),
    } as Partial<CrmState>);
  },
}));
