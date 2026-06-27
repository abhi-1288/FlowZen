import { Camera, Info, Trash2 } from "lucide-react";
import type { AnyRecord } from "../shared";
import { AvatarBadge, Row, SectionHeader } from "../shared";

export function PersonalInfoSection({
  profile,
  session,
  avatarUrl,
  displayName,
  uploading,
  onAvatarDelete,
  onAvatarFileSelect,
  effectiveRole,
  displayRole,
}: {
  profile: AnyRecord | null;
  session: { user?: { name?: string; email?: string } } | null;
  avatarUrl: string;
  displayName: string;
  uploading: boolean;
  onAvatarDelete: () => void;
  onAvatarFileSelect: (file: File) => void;
  effectiveRole: string;
  displayRole: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Personal Info" description="Basic details and identity" accent="indigo" />
      <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="lg" />
        {avatarUrl ? (
          <button
            aria-label="Delete avatar"
            className="inline-flex h-9 p-4 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
            onClick={onAvatarDelete}
            title="Delete avatar"
            type="button"
          >
            <Trash2 size={16} />
            <p className="text-sm font-medium ml-2 text-slate-700">Delete Profile Image</p>
          </button>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Camera size={16} />
            {uploading ? "Uploading..." : "Upload avatar"}
            <input
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAvatarFileSelect(file);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        )}
        <button
          aria-label="Avatar upload restrictions"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          title="PNG, JPG, or WEBP only. Max size: 2MB."
          type="button"
        >
          <Info size={16} />
        </button>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Name" value={profile?.name ? String(profile.name) : session?.user?.name ? String(session.user.name) : undefined} />
        <Row label="Email" value={profile?.email ? String(profile.email) : session?.user?.email ? String(session.user.email) : undefined} />
        <Row label="Email-Verified" value={profile?.emailVerified ? String(profile.emailVerified) : undefined} />
        <Row label="Role" value={effectiveRole ? displayRole : undefined} />
        <Row label="Unique Identity" value={profile?.companyIdentityCode ? String(profile.companyIdentityCode) : undefined} />
      </dl>
      {Array.isArray(profile?.roleHistory) && profile.roleHistory.length > 0 ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Role History</p>
          <div className="space-y-2">
            {(profile.roleHistory as { oldRole: string; newRole: string; changedBy: string; changedAt: string }[]).map((entry, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-900">{entry.oldRole}</span>
                <span className="text-slate-400">→</span>
                <span className="font-medium text-emerald-700">{entry.newRole}</span>
                <span className="ml-auto whitespace-nowrap text-slate-400">{new Date(entry.changedAt).toLocaleDateString()}</span>
                <span className="text-slate-400">by {entry.changedBy}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
