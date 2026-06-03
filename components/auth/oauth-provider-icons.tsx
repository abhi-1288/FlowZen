"use client";

import { signIn } from "next-auth/react";
import { FaApple, FaDiscord, FaGithub, FaGoogle, FaMicrosoft } from "react-icons/fa";

const providers = [
  { id: "google", label: "Google", icon: FaGoogle },
  // { id: "azure-ad", label: "Microsoft", icon: FaMicrosoft },
  // { id: "apple", label: "Apple", icon: FaApple },
  { id: "github", label: "GitHub", icon: FaGithub },
  // { id: "discord", label: "Discord", icon: FaDiscord }
];

export function OAuthProviderIcons({ callbackUrl = "/board" }: { callbackUrl?: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {providers.map((provider) => {
        const Icon = provider.icon;
        return (
          <button
            aria-label={`Continue with ${provider.label}`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            key={provider.id}
            onClick={() => signIn(provider.id, { callbackUrl })}
            title={`Continue with ${provider.label}`}
            type="button"
          >
            <Icon aria-hidden="true" size={20} />
          </button>
        );
      })}
    </div>
  );
}
