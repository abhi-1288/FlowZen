import { headers } from "next/headers";
import { connectDb } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";

export type AuditActor = {
  id?: unknown;
  name?: string;
  email?: string;
  role?: string;
};

export type RecordAuditOptions = {
  action: string;
  actionLabel?: string;
  company?: unknown;
  actor?: AuditActor | string | null;
  target?: AuditActor | string | null;
  entityType?: string;
  entityId?: string;
  from?: unknown;
  to?: unknown;
  result?: "success" | "failed";
  metadata?: Record<string, unknown>;
  request?: Request;
};

export function canViewAuditCenter(role: string, isSeniorSecurity?: boolean): boolean {
  const r = String(role ?? "");
  if (["admin", "human-resource", "it-admin", "it-administration"].includes(r)) return true;
  return r === "security" && Boolean(isSeniorSecurity);
}

export function escapeRegex(value: string): string {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDevice(ua: string): string {
  const value = String(ua ?? "");
  let browser = "Browser";
  let os = "Unknown";
  if (/Edg\//.test(value)) browser = "Edge";
  else if (/OPR\//.test(value)) browser = "Opera";
  else if (/Chrome\//.test(value)) browser = "Chrome";
  else if (/Firefox\//.test(value)) browser = "Firefox";
  else if (/Safari\//.test(value)) browser = "Safari";
  if (/Windows/.test(value)) os = "Windows";
  else if (/Android/.test(value)) os = "Android";
  else if (/(iPhone|iPad|iPod)/.test(value)) os = "iOS";
  else if (/Mac OS X|Macintosh/.test(value)) os = "macOS";
  else if (/Linux/.test(value)) os = "Linux";
  return `${browser} / ${os}`;
}

function normalizeRef(ref: AuditActor | string | null | undefined): {
  id?: string;
  name: string;
  email: string;
  role: string;
} {
  if (!ref) return { name: "", email: "", role: "" };
  if (typeof ref === "string" || typeof ref === "object" && (ref as any)._id) {
    const id = typeof ref === "string" ? ref : String((ref as any)._id);
    return { id, name: "", email: "", role: "" };
  }
  const obj = ref as AuditActor;
  return {
    id: obj.id != null ? String(obj.id) : undefined,
    name: String(obj.name ?? ""),
    email: String(obj.email ?? ""),
    role: String(obj.role ?? ""),
  };
}

function headerValue(store: unknown, name: string): string {
  if (!store) return "";
  const anyStore = store as { get?: (key: string) => string | null } & Record<string, string | undefined>;
  if (typeof anyStore.get === "function") return anyStore.get(name) ?? "";
  return anyStore[name] ?? "";
}

/**
 * Record a security/audit event. Purely observational: never throws, never
 * blocks the caller's response. IP + device are derived from the request when
 * provided (route handlers), otherwise from the headers() store.
 */
export async function recordAudit(opts: RecordAuditOptions) {
  try {
    await connectDb();
    const actor = normalizeRef(opts.actor ?? null);
    const target = normalizeRef(opts.target ?? null);

    let ip = "";
    let device = "";
    try {
      if (opts.request) {
        const xff = headerValue(opts.request.headers, "x-forwarded-for");
        ip = xff ? xff.split(",")[0].trim() : headerValue(opts.request.headers, "x-real-ip");
        device = parseDevice(headerValue(opts.request.headers, "user-agent"));
      } else {
        const headerStore = await headers();
        const xff = headerStore.get("x-forwarded-for");
        ip = xff ? xff.split(",")[0].trim() : (headerStore.get("x-real-ip") ?? "");
        device = parseDevice(headerStore.get("user-agent") ?? "");
      }
    } catch {
      // Not in a request context (e.g. lib/auth authorize) — leave ip/device empty.
    }

    const metadata = opts.metadata ?? {};
    if (target.email) metadata.targetEmail = target.email;
    if (target.role) metadata.targetRole = target.role;

    await AuditLog.create({
      company: opts.company ?? null,
      actor: actor.id ?? null,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      target: target.id ?? null,
      targetName: target.name,
      action: opts.action,
      actionLabel: opts.actionLabel ?? "",
      entityType: opts.entityType ?? "",
      entityId: opts.entityId ?? "",
      from: opts.from ?? null,
      to: opts.to ?? null,
      metadata,
      ip,
      device,
      result: opts.result ?? "success",
    });
  } catch (error) {
    console.error("recordAudit failed:", error);
  }
}