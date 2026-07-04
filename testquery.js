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

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  company: mongoose.Schema.Types.ObjectId,
  companyStatus: String,
});

async function run() {
  loadLocalEnv();
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  // Find "finance@flowzen.com"
  const financeUser = await User.findOne({ email: "finance@flowzen.com" });
  console.log("Finance User:", financeUser);

  const members = await User.find({
    company: financeUser.company,
    companyStatus: "approved",
    _id: { $ne: financeUser._id },
  });
  console.log("Found members count:", members.length);
  members.forEach(m => console.log(m.name, m.email));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
