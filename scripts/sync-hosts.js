/**
 * Hosts file helper for local subdomain development.
 *
 * Usage:
 *   node scripts/sync-hosts.js          — add all company slugs to hosts file
 *   node scripts/sync-hosts.js remove   — remove all flowzen entries from hosts file
 *
 * Requires admin/root privileges on Windows.
 */

const os = require("os");
const path = require("path");

const BASE_DOMAIN = "localhost";
const MARKER = "# flowzen-subdomains";

function getHostsPath() {
  if (os.platform() === "win32") {
    return path.join("C:", "Windows", "System32", "drivers", "etc", "hosts");
  }
  return "/etc/hosts";
}

async function getSlugs() {
  const mongoose = require("mongoose");
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/flowzen";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const companies = await db.collection("companies").find({ slug: { $exists: true, $ne: null } }).project({ slug: 1, _id: 0 }).toArray();
  await mongoose.disconnect();
  return companies.map((c) => c.slug).filter(Boolean);
}

function readHosts(hostsPath) {
  const fs = require("fs");
  return fs.readFileSync(hostsPath, "utf-8");
}

function writeHosts(hostsPath, content) {
  const fs = require("fs");
  fs.writeFileSync(hostsPath, content, "utf-8");
}

async function add(slugs) {
  const hostsPath = getHostsPath();
  let content = readHosts(hostsPath);

  // Remove old block
  const re = new RegExp(`\\n?${MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?(?=\\n(?:\\s*\\n|$))`, "s");
  content = content.replace(re, "");

  if (slugs.length === 0) {
    writeHosts(hostsPath, content);
    console.log("No company slugs found. Hosts file unchanged.");
    return;
  }

  const block = [
    "",
    MARKER,
    ...slugs.map((slug) => `127.0.0.1   ${slug}.${BASE_DOMAIN}`),
    "",
  ].join("\n");

  content = content.trimEnd() + "\n" + block;
  writeHosts(hostsPath, content);
  console.log(`Added ${slugs.length} entries to ${hostsPath}:`);
  slugs.forEach((s) => console.log(`  ${s}.${BASE_DOMAIN}`));
}

function remove() {
  const hostsPath = getHostsPath();
  let content = readHosts(hostsPath);
  const re = new RegExp(`\\n?${MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?(?=\\n(?:\\s*\\n|$))`, "s");
  content = content.replace(re, "");
  writeHosts(hostsPath, content);
  console.log("Removed flowzen entries from hosts file.");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "remove") {
    remove();
    return;
  }

  try {
    const slugs = await getSlugs();
    await add(slugs);
  } catch (err) {
    console.error("Failed to connect to MongoDB or update hosts:", err.message);
    console.error("Make sure MongoDB is running and you have admin privileges.");
    process.exit(1);
  }
}

main();
