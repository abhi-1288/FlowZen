import { Trash2 } from "lucide-react";
import { FormEvent } from "react";
import { ActionButton, SectionHeader } from "../shared";

export function SecuritySection({
  passwordResetRequired,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  onUpdatePassword,
  onDeleteAccount,
}: {
  passwordResetRequired: boolean;
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onUpdatePassword: (event: FormEvent) => Promise<void>;
  onDeleteAccount: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <SectionHeader title="Security" description="Password &amp; account management" accent="rose" />
      {passwordResetRequired ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          You signed in with a reset link. Create a new password to finish securing your account.
        </p>
      ) : null}
      <form className="mt-4 space-y-3" onSubmit={onUpdatePassword}>
        {!passwordResetRequired ? (
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-800 dark:bg-[#000000]"
            placeholder="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => onCurrentPasswordChange(event.target.value)}
          />
        ) : null}
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-800 dark:bg-[#000000]"
          placeholder="New password"
          type="password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          minLength={8}
        />
        <ActionButton variant="primary">Update password</ActionButton>
      </form>
      <ActionButton variant="danger" className="mt-5" onClick={onDeleteAccount}>
        <Trash2 size={16} />
        Delete account
      </ActionButton>
    </section>
  );
}
