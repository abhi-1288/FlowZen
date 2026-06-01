// scripts/generate-release-notes.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function aiCategorize(msg) { /* … same logic as in the route … */ }
function aiSummarize(entries) { /* … same logic … */ }
function formatDate(raw) { /* … same logic … */ }

function run() {
    const hash = execSync("git log -1 --format=%H", { encoding: "utf-8" }).trim();
    const date = execSync("git log -1 --format=%cd --date=short", { encoding: "utf-8" }).trim();
    const commits = execSync("git log --oneline -30", { encoding: "utf-8" }).trim()
        .split("\n").filter(Boolean);
    const entries = commits.map(l => aiCategorize(l.replace(/^[a-f0-9]+\s/, "")));
    const releaseNotes = aiSummarize(entries);

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
