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
  await mongoose.connect(uri);

  // Register models by requiring index
  // Note: we can require from .next or directly require the ts files if ts-node is available,
  // or we can mock/require the models we need.
  // Let's manually register them to see if it throws any schema compile errors.
  
  const CompanySchema = new mongoose.Schema({ name: String });
  const Company = mongoose.models.Company || mongoose.model("Company", CompanySchema);

  const TeamSchema = new mongoose.Schema({ name: String });
  const Team = mongoose.models.Team || mongoose.model("Team", TeamSchema);

  const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String,
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    companyStatus: String,
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    message: String,
    readAt: { type: Date, default: null }
  }, { timestamps: true });
  const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

  const userId = "6a3d025ab166f0aa4ce59012"; // Finance user ID

  console.log("Starting query simulation...");
  const user = await User.findById(userId).select("company companyStatus");
  console.log("User:", user);

  if (!user || !user.company || user.companyStatus !== "approved") {
    console.log("User not approved or has no company");
    process.exit(1);
  }

  const members = await User.find({
    company: user.company,
    companyStatus: "approved",
    _id: { $ne: user._id },
  })
    .select("name email role teamStatus team activeTeams companyJoined companyIdentityCode avatarUrl")
    .populate({ path: "team", select: "name" })
    .populate({ path: "company", select: "name" });

  console.log("Members found:", members.length);

  const enrichedMembers = await Promise.all(
    members.map(async (m) => {
      const memberId = String(m._id);
      const unreadCount = await Message.countDocuments({
        sender: memberId,
        recipient: userId,
        readAt: null,
      });
      const lastMessage = await Message.findOne({
        $or: [
          { sender: userId, recipient: memberId },
          { sender: memberId, recipient: userId }
        ]
      })
        .sort({ createdAt: -1 })
        .select("message createdAt sender");

      return {
        ...m.toObject(),
        unreadCount,
        lastMessage: lastMessage ? {
          message: lastMessage.message,
          createdAt: lastMessage.createdAt,
          sender: String(lastMessage.sender)
        } : null
      };
    })
  );

  console.log("Enriched members:", enrichedMembers);
  process.exit(0);
}

run().catch(err => {
  console.error("Error running simulation:", err);
  process.exit(1);
});
