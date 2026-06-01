import { NextResponse } from "next/server";
import { execSync } from "child_process";

interface ReleaseEntry {
  type: "feature" | "fix" | "improvement" | "technical" | "other";
  title: string;
}

function aiCategorize(message: string): ReleaseEntry {
  const lower = message.toLowerCase();

  if (
    /^(add|new|feature|create|implement|introduce)/.test(lower) ||
    /added|created|implemented|introduced/.test(lower)
  ) {
    return { type: "feature", title: message };
  }

  if (
    /^(fix|bug|hotfix|patch|resolve|correct)/.test(lower) ||
    /fixed|resolved|bugfix|corrected/.test(lower)
  ) {
    return { type: "fix", title: message };
  }

  if (
    /^(update|improve|refactor|tweak|enhance|optimize|rework|migrate|clean|simplify)/.test(lower) ||
    /updated|improved|refactored|optimized/.test(lower)
  ) {
    return { type: "improvement", title: message };
  }

  if (
    /^(migrate|config|deploy|ci|cd|docker|db|database|build|setup|init|infra|integration|test)/.test(lower) ||
    /migration|infrastructure|deployment/.test(lower)
  ) {
    return { type: "technical", title: message };
  }

  return { type: "other", title: message };
}

function aiSummarize(entries: ReleaseEntry[]) {
  const groups: Record<string, { label: string; emoji: string; prefix: string; items: string[] }> = {
    feature: { label: "Features", emoji: "🚀", prefix: "NEW", items: [] },
    fix: { label: "Fixes", emoji: "🐛", prefix: "FIX", items: [] },
    improvement: { label: "Improvements", emoji: "⚡", prefix: "IMPROVED", items: [] },
    technical: { label: "Technical Changes", emoji: "🔧", prefix: "DEV", items: [] },
    other: { label: "Other Changes", emoji: "📦", prefix: "UPDATE", items: [] },
  };

  for (const entry of entries) {
    let text = entry.title
      .replace(/^[a-z]/, (c) => c.toUpperCase())
      .replace(/\.+$/, "")
      .trim();

    if (!groups[entry.type]) continue;
    if (!groups[entry.type].items.includes(text)) {
      groups[entry.type].items.push(text);
    }
  }

  return Object.entries(groups)
    .filter(([, group]) => group.items.length > 0)
    .map(([key, group]) => ({
      type: key,
      label: group.label,
      emoji: group.emoji,
      prefix: group.prefix,
      items: group.items,
    }));
}

function formatDate(raw: string): string {
  if (!raw) return "N/A";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function GET() {
  try {
    const fs = require('fs/promises');
    const path = require('path');
    const data = await fs.readFile(path.join(process.cwd(), 'public', 'release-notes.json'), 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ version: "v1.0.0", releaseNotes: [] });
  }
}
