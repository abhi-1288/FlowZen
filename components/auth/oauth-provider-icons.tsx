"use client";

import { signIn } from "next-auth/react";
import { FaGithub, FaGoogle } from "react-icons/fa";

const providers = [
  { id: "google", label: "Google", icon: FaGoogle },
  { id: "github", label: "GitHub", icon: FaGithub },
];

export function OAuthProviderIcons({ callbackUrl = "/board" }: { callbackUrl?: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {providers.map((provider) => {
        const Icon = provider.icon;
        return (
          <button
            aria-label={`Continue with ${provider.label}`}
            className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:bg-slate-100"
            key={provider.id}
            onClick={() => signIn(provider.id, { callbackUrl })}
            title={`Continue with ${provider.label}`}
            suppressHydrationWarning
            type="button"
          >
            <Icon aria-hidden="true" size={18} />
            {provider.label}
          </button>
        );
      })}
    </div>
  );
}
