// scripts/generate-release-notes.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function aiCategorize(msg) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Categorize the following commit message into: Feature, Fix, or Refactor." }, { role: "user", content: msg }]
        })
    });
    const data = await response.json();
    return { category: data.choices[0].message.content, message: msg };
}

async function aiSummarize(entries) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Summarize these commits into a concise release notes markdown format." }, { role: "user", content: JSON.stringify(entries) }]
        })
    });
    const data = await response.json();
    return data.choices[0].message.content;
}

function formatDate(raw) {
    return new Date(raw).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
}

async function run() {
    const hash = execSync("git log -1 --format=%H", { encoding: "utf-8" }).trim();
    const date = execSync("git log -1 --format=%cd --date=short", { encoding: "utf-8" }).trim();
    const commits = execSync("git log --oneline -30", { encoding: "utf-8" }).trim()
        .split("\n").filter(Boolean);
    const entries = await Promise.all(commits.map(l => aiCategorize(l.replace(/^[a-f0-9]+\s/, ""))));
    const releaseNotes = await aiSummarize(entries);

    const payload = {
        version: `v1.0.0-build.${execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim()}`,
        tag: execSync("git describe --tags --always 2>nul", { encoding: "utf-8" }).trim(),
        lastUpdate: formatDate(date),
        rawDate: date,
        commitHash: hash.slice(0, 7),
        totalCommits: Number(execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim()),
        releaseNotes,
        knownIssues: []
    };

    fs.writeFileSync(path.join(__dirname, "..", "public", "release-notes.json"),
        JSON.stringify(payload, null, 2));
    // Also expose a tiny version string for the UI
    fs.writeFileSync(path.join(__dirname, "..", ".env.production.local"),
        `NEXT_PUBLIC_APP_VERSION=${payload.version}\n`);
}
run();
