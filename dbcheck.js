const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function run() {
  loadLocalEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not defined in env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to DB");
  const users = await mongoose.connection.db.collection("users").find({}).toArray();
  console.log(`Total users in DB: ${users.length}`);
  users.forEach(u => {
    console.log(`User: ${u.name}, Email: ${u.email}, Role: ${u.role}, Company: ${u.company}, CompanyStatus: ${u.companyStatus}`);
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
