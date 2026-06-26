import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { jsonError } from "@/lib/api";
import { companyCodePrefix } from "@/lib/company-identity";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDb();
  const { id } = await params;
  const { searchParams } = new URL(_request.url);
  const referralId = searchParams.get("referralId")?.trim();

  if (!referralId) {
    return jsonError("referralId query parameter is required.");
  }

  const job = await ATSJob.findById(id);
  if (!job) return jsonError("Job not found.", 404);

  const companyDoc = await Company.findOne({ _id: job.company });
  if (!companyDoc) return jsonError("Company not found.", 404);

  const expectedPrefix = companyCodePrefix(companyDoc.name);
  const actualPrefix = referralId.includes("-") ? referralId.slice(0, referralId.lastIndexOf("-")) : "";
  if (!actualPrefix || expectedPrefix !== actualPrefix) {
    return jsonError("Referral company does not match this job's company.");
  }

  const employee = await User.findOne({
    companyIdentityCode: referralId,
    company: job.company,
  }).populate("company", "name icon");

  if (!employee) {
    return jsonError("Referral employee not found. Please check the referral ID.");
  }

  return NextResponse.json({
    name: employee.name,
    company: companyDoc.name,
  });
}
