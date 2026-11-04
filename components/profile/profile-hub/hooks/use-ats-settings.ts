"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ATS_PROVIDERS, type AtsProvider } from "@/lib/ats-providers";

type AtsSettingsResponse = {
  provider: AtsProvider;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  defaults: Record<string, string>;
};

const FALLBACK_DEFAULTS: Record<string, string> = Object.fromEntries(
  Object.values(ATS_PROVIDERS).map((meta) => [meta.id, meta.defaultModel]),
);

export function useAtsSettings(
  company: unknown,
  showToast: (text: string, type?: "success" | "error") => void,
) {
  const [provider, setProvider] = useState<AtsProvider>("openrouter");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [defaults, setDefaults] = useState(FALLBACK_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    apiFetch<AtsSettingsResponse>("/api/hr/ats-settings", undefined, { toast: false })
      .then((data) => {
        setProvider(data.provider);
        setModel(data.model ?? "");
        setBaseUrl(data.baseUrl ?? "");
        setHasApiKey(Boolean(data.hasApiKey));
        setMaskedApiKey(data.maskedApiKey ?? "");
        if (data.defaults) setDefaults(data.defaults);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [company]);

  function startEditingKey() {
    setEditingKey(true);
    setApiKeyDraft("");
  }

  function cancelEditingKey() {
    setEditingKey(false);
    setApiKeyDraft("");
  }

  async function save(): Promise<boolean> {
    try {
      setSaving(true);
      const body: Record<string, unknown> = { provider, model, baseUrl };
      // Only send the key when the user actually changed it, so an untouched
      // masked value never round-trips back to the server.
      if (editingKey) body.apiKey = apiKeyDraft;
      const data = await apiFetch<AtsSettingsResponse & { ok: boolean }>("/api/hr/ats-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setProvider(data.provider);
      setModel(data.model ?? "");
      setBaseUrl(data.baseUrl ?? "");
      setHasApiKey(Boolean(data.hasApiKey));
      setMaskedApiKey(data.maskedApiKey ?? "");
      if (data.defaults) setDefaults(data.defaults);
      setEditingKey(false);
      setApiKeyDraft("");
      showToast("ATS scoring settings updated.", "success");
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update ATS settings.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    provider,
    setProvider,
    model,
    setModel,
    baseUrl,
    setBaseUrl,
    hasApiKey,
    maskedApiKey,
    apiKeyDraft,
    setApiKeyDraft,
    editingKey,
    startEditingKey,
    cancelEditingKey,
    defaults,
    loaded,
    saving,
    save,
  };
}

export type AtsSettingsState = ReturnType<typeof useAtsSettings>;
