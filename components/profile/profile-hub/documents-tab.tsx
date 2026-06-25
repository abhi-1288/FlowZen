"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord } from "./shared";

type DocField = { label: string; type: string };
type DocCategory = { name: string; mandatory: boolean; acceptedFileTypes: string[]; fields: DocField[] };
type FieldValue = { label: string; value: string };
type DocInfo = { fileName: string; fileUrl: string; fileType: string; fileSize: number; fieldValues: FieldValue[] };

const FILE_TYPE_OPTIONS = ["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"];

export function DocumentsTab({
  actorRole,
  showToast,
}: {
  actorRole?: string;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const isHrOrAdmin = ["human-resource", "admin", "finance"].includes(String(actorRole ?? ""));
  const [subTab, setSubTab] = useState<"required" | "upload">("upload");

  const sectionClass =
    "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";

  return (
    <div className="space-y-6">
      {isHrOrAdmin ? (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              subTab === "required"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setSubTab("required")}
          >
            Required Documents
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              subTab === "upload"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setSubTab("upload")}
          >
            Upload Documents
          </button>
        </div>
      ) : null}

      {isHrOrAdmin && subTab === "required" ? (
        <RequiredDocumentsSection showToast={showToast} />
      ) : (
        <section className={sectionClass}>
          <div className="mb-5 border-l-4 border-violet-500 pl-4">
            <h3 className="text-base font-semibold text-slate-900">Upload Documents</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Upload required documents as defined by HR.
            </p>
          </div>
          <DocumentsUploadSection showToast={showToast} />
        </section>
      )}
    </div>
  );
}

/* ─── HR: Define required categories + their input fields + file types ─── */

function RequiredDocumentsSection({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newMandatory, setNewMandatory] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch<{ categories: DocCategory[] }>("/api/hr/document-categories");
      setCategories(res.categories ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    try {
      setSaving(true);
      await apiFetch("/api/hr/document-categories", {
        method: "PATCH",
        body: JSON.stringify({ categories }),
      });
      showToast("Document categories saved.");
      setDirty(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  function addField(catIndex: number) {
    setCategories(categories.map((c, i) =>
      i === catIndex ? { ...c, fields: [...c.fields, { label: "", type: "text" }] } : c
    ));
    setDirty(true);
  }

  function removeField(catIndex: number, fieldIndex: number) {
    setCategories(categories.map((c, i) =>
      i === catIndex ? { ...c, fields: c.fields.filter((_, fi) => fi !== fieldIndex) } : c
    ));
    setDirty(true);
  }

  function updateField(catIndex: number, fieldIndex: number, key: "label" | "type", value: string) {
    setCategories(categories.map((c, i) =>
      i === catIndex ? {
        ...c,
        fields: c.fields.map((f, fi) => fi === fieldIndex ? { ...f, [key]: value } : f),
      } : c
    ));
    setDirty(true);
  }

  function toggleFileType(catIndex: number, ext: string) {
    setCategories(categories.map((c, i) => {
      if (i !== catIndex) return c;
      const current = c.acceptedFileTypes ?? [];
      const next = current.includes(ext)
        ? current.filter((t) => t !== ext)
        : [...current, ext];
      return { ...c, acceptedFileTypes: next };
    }));
    setDirty(true);
  }

  const sectionClass =
    "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";

  return (
    <section className={sectionClass}>
      <div className="mb-5 border-l-4 border-violet-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Required Document Categories</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Define the document types and their input fields members must fill.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <>
          {categories.length > 0 ? (
            <div className="mb-4 space-y-2">
              {categories.map((cat, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600"
                      onClick={() => setExpanded({ ...expanded, [i]: !expanded[i] })}
                    >
                      {expanded[i] ? "▾" : "▸"}
                    </button>
                    <span className="flex-1 font-medium text-slate-800">{cat.name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.mandatory ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                      {cat.mandatory ? "Mandatory" : "Optional"}
                    </span>
                    <button
                      type="button"
                      className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                      onClick={() => {
                        setCategories(categories.filter((_, j) => j !== i));
                        setDirty(true);
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  {expanded[i] ? (
                    <div className="border-t border-slate-200 px-4 pb-3 pt-2 space-y-3">
                      {/* File type toggles */}
                      <div>
                        <p className="mb-1 text-xs font-medium text-slate-500">Accepted file types</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILE_TYPE_OPTIONS.map((ext) => {
                            const selected = (cat.acceptedFileTypes ?? []).includes(ext);
                            return (
                              <button
                                key={ext}
                                type="button"
                                className={`rounded px-2 py-1 text-xs font-medium border transition ${
                                  selected
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                                }`}
                                onClick={() => toggleFileType(i, ext)}
                              >
                                .{ext}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Fields */}
                      <div>
                        <p className="mb-1 text-xs font-medium text-slate-500">Input fields</p>
                        {cat.fields.length > 0 ? (
                          <div className="mb-2 space-y-1.5">
                            {cat.fields.map((f, fi) => (
                              <div key={fi} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Field label (e.g. Aadhaar Number)"
                                  value={f.label}
                                  onChange={(e) => updateField(i, fi, "label", e.target.value)}
                                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-slate-950"
                                />
                                <select
                                  value={f.type}
                                  onChange={(e) => updateField(i, fi, "type", e.target.value)}
                                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                                >
                                  <option value="text">Text</option>
                                  <option value="number">Number</option>
                                  <option value="email">Email</option>
                                </select>
                                <button
                                  type="button"
                                  className="text-rose-400 hover:text-rose-600 text-xs"
                                  onClick={() => removeField(i, fi)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mb-2 text-xs text-slate-400">No input fields defined.</p>
                        )}
                        <button
                          type="button"
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          onClick={() => addField(i)}
                        >
                          + Add field
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-slate-200 px-4 pb-2 pt-1 text-xs text-slate-400">
                      {(cat.acceptedFileTypes ?? []).length > 0
                        ? `Types: ${cat.acceptedFileTypes.map((t) => `.${t}`).join(", ")}`
                        : "No file type restriction"}
                      {cat.fields.length > 0 ? ` · ${cat.fields.length} field${cat.fields.length > 1 ? "s" : ""}: ${cat.fields.map((f) => f.label || "(unnamed)").join(", ")}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-400">No document categories defined yet.</p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Document name (e.g. Resume, Aadhaar)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
            />
            <select
              value={newMandatory ? "yes" : "no"}
              onChange={(e) => setNewMandatory(e.target.value === "yes")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="no">Optional</option>
              <option value="yes">Mandatory</option>
            </select>
            <ActionButton
              variant="primary"
              disabled={!newName.trim()}
              type="button"
              onClick={() => {
                const name = newName.trim();
                if (!name) return;
                if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
                  showToast("Category already exists.", "error");
                  return;
                }
                setCategories([...categories, { name, mandatory: newMandatory, acceptedFileTypes: [], fields: [] }]);
                setNewName("");
                setNewMandatory(false);
                setDirty(true);
              }}
            >
              Add
            </ActionButton>
          </div>

          {dirty ? (
            <div className="mt-5 flex justify-end">
              <ActionButton
                variant="primary"
                disabled={saving}
                type="button"
                onClick={() => void save()}
              >
                {saving ? "Saving..." : "Save changes"}
              </ActionButton>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ─── Member: Upload documents + fill field values with preview modal ─── */

function DocumentsUploadSection({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [documents, setDocuments] = useState<Record<string, DocInfo>>({});
  const [loading, setLoading] = useState(true);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, Record<string, string>>>({});
  const [preview, setPreview] = useState<{
    category: string;
    file: File;
    previewUrl: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch<{
        categories: DocCategory[];
        documents: ({ category: string } & DocInfo)[];
      }>("/api/profile/documents");
      setCategories(res.categories ?? []);
      const docMap: Record<string, DocInfo> = {};
      for (const d of res.documents ?? []) {
        const { category, ...info } = d;
        docMap[category] = info;
      }
      setDocuments(docMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function handlePickFile(category: string) {
    setPendingCategory(category);
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const cat = pendingCategory;
    e.target.value = "";
    setPendingCategory(null);
    if (!file || !cat) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("File exceeds 2 MB limit.", "error");
      return;
    }

    const categoryDef = categories.find((c) => c.name === cat);
    const allowed = categoryDef?.acceptedFileTypes ?? [];
    if (allowed.length > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.includes(ext)) {
        showToast(`File type .${ext} not accepted. Allowed: ${allowed.map((t) => `.${t}`).join(", ")}`, "error");
        return;
      }
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview({ category: cat, file, previewUrl });
  }

  async function handleUpload() {
    if (!preview) return;
    const { category, file } = preview;
    const cat = categories.find((c) => c.name === category);
    if (!cat) return;

    const values = fieldDrafts[category] ?? {};
    for (const f of cat.fields) {
      if (f.label && !values[f.label]?.trim()) {
        showToast(`Please fill in "${f.label}".`, "error");
        return;
      }
    }

    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      form.append("fieldValues", JSON.stringify(
        cat.fields.filter((f) => f.label && values[f.label]?.trim()).map((f) => ({
          label: f.label,
          value: values[f.label]?.trim() ?? "",
        }))
      ));
      const res = await fetch("/api/profile/documents", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        showToast(String(err.error ?? "Upload failed"), "error");
        return;
      }
      showToast("Document uploaded.");
      setPreview(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  function closePreview() {
    if (preview) {
      URL.revokeObjectURL(preview.previewUrl);
    }
    setPreview(null);
  }

  async function handleDelete(category: string) {
    try {
      const res = await fetch(`/api/profile/documents?category=${encodeURIComponent(category)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Delete failed" }));
        showToast(String(err.error ?? "Delete failed"), "error");
        return;
      }
      showToast("Document removed.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed.", "error");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  if (categories.length === 0) {
    return <p className="text-sm text-slate-400">No document categories have been defined by HR yet.</p>;
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
        accept={
          pendingCategory
            ? (() => {
                const cat = categories.find((c) => c.name === pendingCategory);
                const catAllowed = cat?.acceptedFileTypes ?? [];
                if (catAllowed.length > 0)
                  return catAllowed.map((t) => `.${t}`).join(",");
                return undefined;
              })()
            : undefined
        }
      />

      <div className="space-y-4">
        {categories.map((cat) => {
          const doc = documents[cat.name];
          return (
            <div key={cat.name} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cat.mandatory ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                  {cat.mandatory ? "Required" : "Optional"}
                </span>
                {(cat.acceptedFileTypes ?? []).length > 0 ? (
                  <span className="text-[10px] text-slate-400">({(cat.acceptedFileTypes ?? []).map((t) => `.${t}`).join(", ")})</span>
                ) : null}
              </div>

              {cat.fields.length > 0 ? (
                <div className="mb-3 space-y-2">
                  {cat.fields.map((f, fi) => {
                    const fieldValue = doc?.fieldValues?.find((fv) => fv.label === f.label);
                    return (
                      <div key={fi}>
                        <label className="text-xs font-medium text-slate-500 mb-0.5 block">{f.label}</label>
                        {doc ? (
                          <p className="text-sm font-medium text-slate-800">{fieldValue?.value ?? "—"}</p>
                        ) : (
                          <input
                            type={f.type}
                            placeholder={`Enter ${f.label}`}
                            value={fieldDrafts[cat.name]?.[f.label] ?? ""}
                            onChange={(e) =>
                              setFieldDrafts({
                                ...fieldDrafts,
                                [cat.name]: { ...(fieldDrafts[cat.name] ?? {}), [f.label]: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : doc ? null : null}

              <div className="flex items-center gap-2">
                {doc ? (
                  <>
                    <div className="flex-1 text-xs text-slate-500">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{doc.fileName}</a>
                      <span className="ml-1">({(doc.fileSize / 1024).toFixed(0)} KB)</span>
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      View
                    </a>
                    <button type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                      onClick={() => void handleDelete(cat.name)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1" />
                    <div className="flex flex-col items-end gap-1">
                      <button type="button"
                        className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
                        onClick={() => handlePickFile(cat.name)}
                      >
                        Upload
                      </button>
                      <p className="text-[10px] text-slate-400">Max file size: 2 MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload preview modal */}
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h4 className="text-lg font-semibold text-slate-900">Preview & Upload</h4>
              <p className="mt-0.5 text-sm text-slate-500">{preview.category}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* File preview */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                {preview.file.type.startsWith("image/") ? (
                  <img
                    src={preview.previewUrl}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium text-slate-600">{preview.file.name}</p>
                    <p className="text-xs text-slate-400">{(preview.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                )}
              </div>

              {/* Field inputs inside modal */}
              {(() => {
                const cat = categories.find((c) => c.name === preview.category);
                if (!cat || cat.fields.length === 0) return null;
                return (
                  <div className="space-y-2">
                    {cat.fields.map((f, fi) => (
                      <div key={fi}>
                        <label className="text-xs font-medium text-slate-500 mb-0.5 block">{f.label}</label>
                        <input
                          type={f.type}
                          placeholder={`Enter ${f.label}`}
                          value={fieldDrafts[cat.name]?.[f.label] ?? ""}
                          onChange={(e) =>
                            setFieldDrafts({
                              ...fieldDrafts,
                              [cat.name]: { ...(fieldDrafts[cat.name] ?? {}), [f.label]: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <ActionButton variant="secondary" type="button" onClick={closePreview}>
                Cancel
              </ActionButton>
              <ActionButton variant="primary" disabled={uploading} type="button" onClick={() => void handleUpload()}>
                {uploading ? "Uploading..." : "Upload"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
