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
    const hash = execSync("git log -1 --format=%H", { encoding: "utf-8" }).trim();
    const date = execSync("git log -1 --format=%cd --date=short", { encoding: "utf-8" }).trim();
    const commits = execSync("git log --oneline -30", { encoding: "utf-8" }).trim().split("\n").filter(Boolean);
    const total = execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim();
    const tag = execSync("git describe --tags --always 2>nul", { encoding: "utf-8" }).trim();

    const entries: ReleaseEntry[] = commits.map((line: string) => {
      const match = line.match(/^[a-f0-9]+\s(.+)$/);
      return aiCategorize(match ? match[1] : line);
    });

    const releaseNotes = aiSummarize(entries);

    const knownIssues: string[] = [];

    return NextResponse.json({
      version: `v1.0.0-build.${total}`,
      tag: tag === hash ? null : tag,
      lastUpdate: formatDate(date),
      rawDate: date,
      commitHash: hash.slice(0, 7),
      totalCommits: Number(total),
      releaseNotes,
      knownIssues,
    });
  } catch {
    return NextResponse.json({
      version: "v1.0.0",
      lastUpdate: "N/A",
      rawDate: new Date().toISOString().slice(0, 10),
      totalCommits: 0,
      releaseNotes: [],
      knownIssues: [],
    });
  }
}
