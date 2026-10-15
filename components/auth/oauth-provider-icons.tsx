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
            className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/80 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:bg-white/15"
            key={provider.id}
            onClick={() => signIn(provider.id, { callbackUrl })}
            title={`Continue with ${provider.label}`}
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
