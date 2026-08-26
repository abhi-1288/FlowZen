const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/flowzen";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const companies = await db.collection("companies").find({ slug: { $exists: false } }).toArray();

  for (const company of companies) {
    const name = String(company.name || "company");
    let slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 40);

    if (slug.length < 2) slug = "company";

    const exists = await db.collection("companies").findOne({ slug, _id: { $ne: company._id } });
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    await db.collection("companies").updateOne({ _id: company._id }, { $set: { slug } });
    console.log(`Backfilled: "${company.name}" -> slug "${slug}"`);
  }

  if (companies.length === 0) {
    console.log("All companies already have slugs.");
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
