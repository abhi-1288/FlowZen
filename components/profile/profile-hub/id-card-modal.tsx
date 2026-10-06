"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { darken, lighten } from "@/lib/theme";
import { withMainOfficeSuffix } from "@/lib/company-regions";
import {
  X,
  Printer,
  RotateCw,
  IdCard,
  User,
  Briefcase,
  Phone,
  Mail,
  CalendarDays,
  PhoneCall,
  Droplets,
  FileDown,
  ImageDown,
  Building2,
  MapPin,
  Columns,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import type { AnyRecord } from "./shared";

/* ─── helpers ─── */

function formatDate(val: unknown): string {
  if (!val) return "—";
  try {
    return new Date(String(val)).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function deriveCompanyDomain(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 20) || "company"
  );
}

function renderMultiline(text: string) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line || "\u00A0"}
    </span>
  ));
}

function maskPhoneNumber(phone: string): string {
  if (!phone || phone === "—") return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  const last4 = digits.slice(-4);
  const prefix = phone
    .slice(0, phone.length - last4.length)
    .replace(/\d/g, "*");
  return prefix + last4;
}

/* ─── inline styles tokens ─── */

const SLATE_50 = "#f8fafc";
const SLATE_200 = "#e2e8f0";
const SLATE_400 = "#94a3b8";
const SLATE_500 = "#64748b";
const SLATE_700 = "#334155";
const SLATE_900 = "#0f172a";

/* ─── component ─── */

export function IdCardModal({
  open,
  onClose,
  profile,
  company,
  avatarUrl,
  displayName,
  displayRole,
  signature,
  issueDate,
  onSign,
  signerName,
  signerRole,
  variant = "employee",
}: {
  open: boolean;
  onClose: () => void;
  profile: AnyRecord | null;
  company: AnyRecord | null;
  avatarUrl: string;
  displayName: string;
  displayRole: string;
  signature?: { name: string; role: string; signedAt: string } | null;
  issueDate?: string | null;
  onSign?: () => void;
  signerName?: string;
  signerRole?: string;
  variant?: "employee" | "visitor";
}) {
  const [signing, setSigning] = useState(false);
  const [localSigned, setLocalSigned] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [viewMode, setViewMode] = useState<"side-by-side" | "flip">("side-by-side");
  const [isFlipped, setIsFlipped] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  const uniqueId = profile?.companyIdentityCode
    ? String(profile.companyIdentityCode)
    : variant === "visitor" && profile?.identityCode
      ? String(profile.identityCode)
      : "—";
  const isVisitor = variant === "visitor";
  const qrValue =
    typeof window !== "undefined"
      ? `${window.location.origin}/${isVisitor ? "verify-visitor" : "verify"}/${uniqueId}`
      : "";

  useEffect(() => {
    if (!qrValue || !open) return;
    QRCode.toDataURL(qrValue, {
      width: 200,
      margin: 1,
      color: { dark: "#1e293b", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [qrValue, open]);

  /* ── download & print helpers ── */

  const displaySignature =
    signature ||
    (localSigned
      ? {
        name: signerName ?? "",
        role: signerRole ?? "",
        signedAt: new Date().toISOString(),
      }
      : null);

  function handleESign() {
    if (!onSign) return;
    setLocalSigned(true);
  }

  async function handleApprove() {
    if (!onSign) return;
    setSigning(true);
    try {
      await Promise.resolve(onSign());
    } finally {
      setSigning(false);
    }
  }

  const isHrPreview = !!onSign;

  const captureCard = useCallback(async () => {
    if (!exportRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(exportRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#f1f5f9",
      logging: false,
    });
  }, []);

  const downloadPNG = useCallback(async () => {
    const canvas = await captureCard();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `ID-Card-${displayName.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [captureCard, displayName]);

  const downloadPDF = useCallback(async () => {
    const canvas = await captureCard();
    if (!canvas) return;
    const { jsPDF } = await import("jspdf");
    const imgData = canvas.toDataURL("image/png");
    const pxW = canvas.width;
    const pxH = canvas.height;
    const pdfW = pxW * 0.264583; // px→mm at 96 dpi
    const pdfH = pxH * 0.264583;
    const pdf = new jsPDF({
      orientation: pdfW > pdfH ? "landscape" : "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`ID-Card-${displayName.replace(/\s+/g, "_")}.pdf`);
  }, [captureCard, displayName]);

  const printCard = useCallback(async () => {
    const canvas = await captureCard();
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
    <html>
      <head>
        <title>ID Card</title>
        <style>
          html,body{
            margin:0;
            padding:20px;
            display:flex;
            justify-content:center;
            align-items:flex-start;
            background:white;
          }

          img{
            max-width:100%;
            height:auto;
          }

          @page{
            size: A4 landscape;
            margin:10px;
            padding:10px;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" />
      </body>
    </html>
  `);

    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  }, [captureCard]);

  /* ── data computations ── */

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const phoneRaw = profile?.phone ? String(profile.phone) : "—";
  const maskPhone = profile?.maskPhone ? Boolean(profile.maskPhone) : false;
  const phone = maskPhone ? maskPhoneNumber(phoneRaw) : phoneRaw;
  const email = profile?.email ? String(profile.email) : "—";
  const companyName = company?.name ? String(company.name) : "—";
  const companyAddr = company?.address ? String(company.address) : "";
  const companyIcon = company?.icon ? String(company.icon) : "/Logos/logo.jpg";
  const PRIMARY = useMemo(() => {
    if (isVisitor) {
      return { hex: "#d97706", dark: "#b45309", light: "#fef3c7" };
    }
    const hex = company?.primaryColor
      ? String(company.primaryColor)
      : "#2563eb";
    return { hex, dark: darken(hex, 14), light: lighten(hex, 95) };
  }, [company?.primaryColor, isVisitor]);

  const joinedEvent = Array.isArray(profile?.membershipHistory)
    ? (profile.membershipHistory as AnyRecord[]).find(
      (m) =>
        String((m as AnyRecord)?.action ?? "") === "joined-company",
    )
    : null;
  const joiningDate = formatDate(
    profile?.companyJoined ||
    (joinedEvent as AnyRecord | null)?.at ||
    profile?.createdAt,
  );
  const issueDateStr = issueDate
    ? formatDate(issueDate)
    : formatDate(new Date().toISOString());
  const domain = deriveCompanyDomain(companyName);
  const storedSupportEmail = company?.supportEmail
    ? String(company.supportEmail)
    : "";
  const storedWebsite = company?.website ? String(company.website) : "";

  const supportEmail = storedSupportEmail || `support@${domain}.com`;
  const website = storedWebsite || `www.${domain}.com`;
  const bloodGroup = profile?.bloodGroup ? String(profile.bloodGroup) : "—";
  const emergencyContact = profile?.emergencyContact
    ? String(profile.emergencyContact)
    : "—";

  const userRegionLabel = profile?.regionLabel
    ? String(profile.regionLabel).trim()
    : "";
  const companyAddresses =
    Array.isArray(company?.addresses) ? (company.addresses as AnyRecord[]) : [];
  const userAddr = userRegionLabel
    ? companyAddresses.find(
      (a) =>
        String(a.label ?? "").trim().toLowerCase() ===
        userRegionLabel.toLowerCase(),
    )
    : null;
  const mainAddr =
    userAddr ||
    companyAddresses.find((a) => Boolean((a as AnyRecord).isMain)) ||
    (companyAddresses.length > 0 ? companyAddresses[0] : null);

  let addrLine1 = "";
  let addrLine2 = "";
  let regionLabel = userRegionLabel;
  let regionAddrText = "";
  let regionContact = { name: "", phone: "", email: "" };

  if (mainAddr) {
    const a = mainAddr as AnyRecord;
    if (!regionLabel) regionLabel = String(a.label ?? "").trim();
    const line1 = String(a.line1 ?? "");
    const city = String(a.city ?? "");
    const state = String(a.state ?? "");
    const zip = String(a.zip ?? "");
    const country = String(a.country ?? "");
    addrLine1 = line1;
    const parts = [city, state].filter(Boolean).join(", ");
    const parts2 = [country, zip].filter(Boolean).join(", ");
    addrLine2 = [parts, parts2].filter(Boolean).join("\n");
    regionAddrText = [line1, city, state, zip, country]
      .filter(Boolean)
      .join(", ");

    // Get primary contact from address contacts
    const contacts = Array.isArray(a.contacts) ? a.contacts : [];
    const primaryContact = contacts.find((c: any) => c.isPrimary) || contacts[0];
    if (primaryContact) {
      regionContact = {
        name: String(primaryContact.name ?? ""),
        phone: String(primaryContact.phone ?? ""),
        email: String(primaryContact.email ?? ""),
      };
    }
  } else {
    const addrParts = companyAddr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    addrLine1 = addrParts.slice(0, 2).join(", ");
    addrLine2 = addrParts.slice(2).join(", ");
    if (!regionLabel) regionLabel = addrParts[0] ?? "";
    if (addrParts.length > 0) regionAddrText = addrParts.join(", ");
  }

  /* ── Card Face Renderers ── */

  const renderFrontCardContent = () => (
    <div className="idc-card border-2 border-gray-300 border-dashed">
      <div>
        {/* Blue header */}
        <div className="idc-front-header">
          <img src={companyIcon} alt={companyName} />
          <p className="idc-front-company-name">{companyName}</p>
          {isVisitor ? (
            <span
              className="idc-region-tag"
              style={{ background: "#d97706", color: "#fff", border: "none" }}
            >
              VISITOR
            </span>
          ) : null}
          {regionLabel ? (
            <span className="idc-region-tag">
              {withMainOfficeSuffix(company, regionLabel)}
            </span>
          ) : null}
        </div>

        {/* ID Card title */}
        <div className="idc-eid-title">
          <span className="idc-eid-line" />
          <span className="idc-eid-text">
            {isVisitor ? "Visitor ID Card" : "Employee ID Card"}
          </span>
          <span className="idc-eid-line" />
        </div>

        {/* Photo + details */}
        <div className="idc-front-body">
          <div className="idc-avatar-frame">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} />
            ) : (
              <div className="idc-avatar-initials">{initials}</div>
            )}
          </div>

          <div className="idc-detail-rows">
            <div className="idc-detail-row">
              <div className="idc-detail-icon">
                <IdCard size={14} />
              </div>
              <div className="idc-detail-content">
                <p className="idc-detail-label">
                  {isVisitor ? "Pass ID" : "Employee ID"}
                </p>
                <p className="idc-detail-value blue">{uniqueId}</p>
              </div>
            </div>

            <div className="idc-detail-row">
              <div className="idc-detail-icon">
                <User size={14} />
              </div>
              <div className="idc-detail-content">
                <p className="idc-detail-label">Name</p>
                <p className="idc-detail-value">{displayName}</p>
              </div>
            </div>

            <div className="idc-detail-row">
              <div className="idc-detail-icon">
                <Briefcase size={14} />
              </div>
              <div className="idc-detail-content">
                <p className="idc-detail-label">
                  {isVisitor ? "Type" : "Designation"}
                </p>
                <p className="idc-detail-value">
                  {isVisitor ? "Visitor" : displayRole}
                </p>
              </div>
            </div>

            <div className="idc-detail-row">
              <div className="idc-detail-icon">
                <Phone size={14} />
              </div>
              <div className="idc-detail-content">
                <p className="idc-detail-label">Phone</p>
                <p className="idc-detail-value">{phone}</p>
              </div>
            </div>

            <div className="idc-detail-row">
              <div className="idc-detail-icon">
                <Mail size={14} />
              </div>
              <div className="idc-detail-content">
                <p className="idc-detail-label">Email</p>
                <p className="idc-detail-value">{email}</p>
              </div>
            </div>

            {(regionContact.name || regionContact.phone || regionContact.email) && !isVisitor && (
              <>
                <div className="idc-detail-row" style={{ borderTop: "1px dashed " + SLATE_200, paddingTop: 8, marginTop: 4 }}>
                  <div className="idc-detail-icon" style={{ background: "#fef3c7" }}>
                    <Users size={14} style={{ color: "#d97706" }} />
                  </div>
                  <div className="idc-detail-content">
                    <p className="idc-detail-label" style={{ color: "#d97706" }}>Region Office Contact</p>
                    <p className="idc-detail-value" style={{ color: SLATE_700 }}>{regionContact.name}</p>
                  </div>
                </div>
                {regionContact.phone && (
                  <div className="idc-detail-row">
                    <div className="idc-detail-icon" style={{ background: "#fef3c7" }}>
                      <Phone size={14} style={{ color: "#d97706" }} />
                    </div>
                    <div className="idc-detail-content">
                      <p className="idc-detail-label" style={{ color: "#d97706" }}>Phone</p>
                      <p className="idc-detail-value">{regionContact.phone}</p>
                    </div>
                  </div>
                )}
                {regionContact.email && (
                  <div className="idc-detail-row">
                    <div className="idc-detail-icon" style={{ background: "#fef3c7" }}>
                      <Mail size={14} style={{ color: "#d97706" }} />
                    </div>
                    <div className="idc-detail-content">
                      <p className="idc-detail-label" style={{ color: "#d97706" }}>Email</p>
                      <p className="idc-detail-value">{regionContact.email}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        {/* Issue / Valid footer */}
        <div className="idc-front-footer">
          <div className="idc-front-footer-item">
            <CalendarDays size={14} className="idc-front-footer-icon" />
            <div>
              <p className="idc-front-footer-label">
                {isVisitor ? "Valid From" : "Issue Date"}
              </p>
              <p className="idc-front-footer-val" style={{ color: SLATE_900 }}>
                {isVisitor && profile?.validFrom
                  ? formatDate(profile.validFrom)
                  : issueDateStr}
              </p>
            </div>
          </div>
          <div className="idc-front-footer-item">
            <CalendarDays size={14} className="idc-front-footer-icon" />
            <div>
              <p className="idc-front-footer-label">
                {isVisitor
                  ? "Valid Until"
                  : profile?.employmentEndDate
                    ? "Employment Period"
                    : "Valid Till"}
              </p>
              <p
                className="idc-front-footer-val"
                style={{ color: PRIMARY.hex, fontWeight: 700 }}
              >
                {isVisitor && profile?.validUntil
                  ? formatDate(profile.validUntil)
                  : profile?.employmentEndDate
                    ? `${formatDate(profile.companyJoined)} — ${formatDate(profile.employmentEndDate)}`
                    : "Active Employee"}
              </p>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="idc-signature-area">
          {displaySignature ? (
            <>
              <p className="idc-signature-script">{displaySignature.name}</p>
              <p className="idc-signature-label">{displaySignature.role}</p>
              <p className="text-xs text-slate-400 mt-1">
                Signed on{" "}
                {new Date(displaySignature.signedAt).toLocaleDateString(
                  "en-IN",
                  {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </p>
            </>
          ) : (
            <>
              <p className="idc-signature-script">Authorised</p>
              <p className="idc-signature-label">Authorised Signature</p>
            </>
          )}
        </div>

        {/* Blue bar */}
        <div className="idc-blue-bar" />
      </div>
    </div>
  );

  const renderBackCardContent = () => (
    <div className="idc-card border-2 border-gray-300 border-dashed">
      <div>
        <div className="pt-4"></div>
        {isVisitor ? (
          <>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <Briefcase size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Purpose of Visit</p>
                <p className="idc-back-info-value">
                  {profile?.purpose ? String(profile.purpose) : "—"}
                </p>
              </div>
            </div>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <User size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Host</p>
                <p className="idc-back-info-value">
                  {profile?.hostName ? String(profile.hostName) : "—"}
                </p>
              </div>
            </div>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <Building2 size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Company</p>
                <p className="idc-back-info-value">
                  {profile?.visitorCompany
                    ? String(profile.visitorCompany)
                    : "—"}
                </p>
              </div>
            </div>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <MapPin size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Visiting Office</p>
                <p className="idc-back-info-value">
                  {profile?.region
                    ? String(profile.region)
                    : profile?.visitAddress
                      ? String(profile.visitAddress)
                      : "—"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <PhoneCall size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Emergency Contact</p>
                <p className="idc-back-info-value">{emergencyContact}</p>
              </div>
            </div>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <Droplets size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Blood Group</p>
                <p className="idc-back-info-value">{bloodGroup}</p>
              </div>
            </div>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <CalendarDays size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Joining Date</p>
                <p className="idc-back-info-value">{joiningDate}</p>
              </div>
            </div>
            <div className="idc-back-info-row">
              <div className="idc-back-icon-circle">
                <MapPin size={16} />
              </div>
              <div>
                <p className="idc-back-info-label">Region Address</p>
                <p className="idc-back-info-value">{regionAddrText || "—"}</p>
              </div>
            </div>
            {(regionContact.name || regionContact.phone || regionContact.email) && !isVisitor && (
              <>
                <div className="idc-back-info-row" style={{ borderTop: "1px dashed " + SLATE_200, paddingTop: 12, marginTop: 4 }}>
                  <div className="idc-back-icon-circle" style={{ background: "#fef3c7" }}>
                    <Users size={16} style={{ color: "#d97706" }} />
                  </div>
                  <div>
                    <p className="idc-back-info-label" style={{ color: "#d97706" }}>Region Office Contact</p>
                    <p className="idc-back-info-value">{regionContact.name}</p>
                  </div>
                </div>
                {regionContact.phone && (
                  <div className="idc-back-info-row">
                    <div className="idc-back-icon-circle" style={{ background: "#fef3c7" }}>
                      <Phone size={16} style={{ color: "#d97706" }} />
                    </div>
                    <div>
                      <p className="idc-back-info-label" style={{ color: "#d97706" }}>Phone</p>
                      <p className="idc-back-info-value">{regionContact.phone}</p>
                    </div>
                  </div>
                )}
                {regionContact.email && (
                  <div className="idc-back-info-row">
                    <div className="idc-back-icon-circle" style={{ background: "#fef3c7" }}>
                      <Mail size={16} style={{ color: "#d97706" }} />
                    </div>
                    <div>
                      <p className="idc-back-info-label" style={{ color: "#d97706" }}>Email</p>
                      <p className="idc-back-info-value">{regionContact.email}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="idc-back-divider" />

        {/* QR Code */}
        <div className="idc-qr-section">
          <div className="idc-qr-frame">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" />
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SLATE_400,
                }}
              >
                QR
              </span>
            )}
          </div>
          <p className="idc-qr-label">Scan to Verify</p>
          <p className="idc-qr-id">ID: {uniqueId}</p>
        </div>
      </div>

      <div>
        <div className="idc-back-divider" />

        {!isVisitor ? (
          <>
            <div className="idc-return-section">
              <p className="idc-return-text">If found please return to</p>
              <p className="idc-return-company">{companyName}</p>
              {(companyAddr || addrLine1) && (
                <>
                  <p className="idc-return-addr">
                    {addrLine1}
                    {addrLine2 ? (
                      <>
                        <br />
                        {renderMultiline(addrLine2)}
                      </>
                    ) : null}
                  </p>
                  {(regionContact.name || regionContact.phone) && (
                    <p className="idc-return-addr" style={{ marginTop: 8, fontSize: "10px", color: "#d97706" }}>
                      {regionContact.name}
                      {regionContact.phone && <span> | </span>}
                      {regionContact.phone}
                    </p>
                  )}
                  <p className="idc-return-link">{supportEmail}</p>
                </>
              )}
            </div>
            <div className="idc-blue-bar" />
          </>
        ) : (
          <div className="idc-blue-bar" />
        )}
      </div>
    </div>
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{`
        .idc-modal-overlay { position:fixed;inset:0;z-index:50;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);padding:32px 16px;overflow-y:auto; }
        .idc-modal-box { width:100%;max-width:940px;margin:auto;animation:idc-fadeIn .25s ease-out; }
        @keyframes idc-fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

        /* ── Toolbar ── */
        .idc-toolbar { display:flex;align-items:center;justify-space-between;padding:16px 24px;background:#fff;border:1px solid ${SLATE_200};border-radius:16px 16px 0 0; }
        .idc-toolbar h3 { font-size:18px;font-weight:700;color:${SLATE_900};margin:0; }
        .idc-toolbar-actions { display:flex;align-items:center;gap:12px; }

        /* ── Toggle buttons ── */
        .idc-view-toggle { display:flex;align-items:center;background:${SLATE_50};padding:3px;border-radius:10px;border:1px solid ${SLATE_200}; }
        .idc-toggle-btn { display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:7px;border:none;background:transparent;color:${SLATE_500};font-size:12px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-toggle-btn.active { background:#fff;color:${SLATE_900};box-shadow:0 1px 3px rgba(0,0,0,.1); }

        .idc-btn-outline { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid ${SLATE_200};background:#fff;color:${SLATE_700};font-size:13px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-btn-outline:hover { background:${SLATE_50};border-color:${SLATE_400}; }
        .idc-btn-fill { display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:${PRIMARY.hex};color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-btn-fill:hover { background:${PRIMARY.dark}; }
        .idc-btn-close { display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:${SLATE_400};cursor:pointer;transition:all .15s; }
        .idc-btn-close:hover { background:${SLATE_50};color:${SLATE_700}; }

        /* ── Cards area ── */
        .idc-cards-area { display:flex;justify-content:center;gap:24px;padding:24px;background:${SLATE_50};border-left:1px solid ${SLATE_200};border-right:1px solid ${SLATE_200};min-height:560px; }
        @media(max-width:720px){ .idc-cards-area { flex-direction:column;align-items:center; } }

        .idc-card-wrapper { flex:1;max-width:420px;min-width:0;display:flex;flex-direction:column;align-items:center; }
        .idc-card-label { display:inline-block;padding:4px 16px;border-radius:6px;border:1px solid ${SLATE_200};background:#fff;font-size:12px;font-weight:600;color:${SLATE_700};letter-spacing:.5px;margin-bottom:8px; }

        /* ── Fixed dimensions for card face ── */
        .idc-card { width:100%;max-width:420px;height:540px;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08);display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box; }

        /* ── 3D Flip System ── */
        .idc-flip-scene { perspective: 1200px; width: 420px; max-width: 100%; height: 540px; margin: 0 auto; }
        .idc-flip-card-box { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .idc-flip-card-box.is-flipped { transform: rotateY(180deg); }
        .idc-flip-face { position: absolute; inset: 0; width: 100%; height: 100%; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 16px; }
        .idc-flip-face-back { transform: rotateY(180deg); }

        /* ── Front card styling ── */
        .idc-front-header { position:relative;padding:24px 20px 20px;text-align:center;background:linear-gradient(135deg,${PRIMARY.hex} 0%,${PRIMARY.dark} 100%);color:#fff;overflow:hidden; }
        .idc-front-header::before { content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.08); }
        .idc-front-header::after { content:'';position:absolute;bottom:-20px;left:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.05); }
        .idc-front-header img { position:relative;display:block;margin: 0 auto 8px;z-index:1;width:44px;height:44px;border-radius:12px;border:2px solid rgba(255,255,255,.3);object-fit:cover;margin-bottom:6px; }
        .idc-front-company-name { position:relative;z-index:1;font-size:18px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 4px; }
        .idc-region-tag { position:relative;z-index:1;display:inline-block;padding:2px 10px;border-radius:20px;background:rgba(255,255,255,.2);font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff;margin-bottom:4px;border:1px solid rgba(255,255,255,.3); }

        .idc-eid-title { display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 20px; }
        .idc-eid-line { flex:0 0 32px;height:2px;border-radius:1px;background:${PRIMARY.hex}; }
        .idc-eid-text { font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${SLATE_900}; }

        .idc-front-body { display:flex;gap:14px;padding:0 20px 10px; }
        .idc-avatar-frame { flex-shrink:0;width:110px;height:130px;border-radius:12px;border:2px solid ${SLATE_200};overflow:hidden;background:${SLATE_50}; }
        .idc-avatar-frame img { width:100%;height:100%;object-fit:cover; }
        .idc-avatar-initials { width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg,${PRIMARY.hex},${PRIMARY.dark});font-size:30px;font-weight:700;color:#fff; }

        .idc-detail-rows { flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding-top:2px; }
        .idc-detail-row { display:flex;align-items:flex-start;gap:8px; }
        .idc-detail-icon { flex-shrink:0;width:24px;height:24px;border-radius:6px;background:${PRIMARY.light};display:grid;place-items:center;color:${PRIMARY.hex}; }
        .idc-detail-content { min-width:0; }
        .idc-detail-label { font-size:9.5px;font-weight:600;color:${SLATE_500};letter-spacing:.3px;margin:0;line-height:1.2; }
        .idc-detail-value { font-size:11.5px;font-weight:700;color:${SLATE_900};margin:0;word-break:break-all;line-height:1.3; }
        .idc-detail-value.blue { color:${PRIMARY.hex}; }

        .idc-front-footer { display:flex;border-top:1px solid ${SLATE_200};margin:0 20px; }
        .idc-front-footer-item { flex:1;display:flex;align-items:center;gap:8px;padding:10px 0; }
        .idc-front-footer-item + .idc-front-footer-item { border-left:1px solid ${SLATE_200};padding-left:14px; }
        .idc-front-footer-icon { color:${PRIMARY.hex};flex-shrink:0; }
        .idc-front-footer-label { font-size:9.5px;font-weight:600;color:${SLATE_500};margin:0; }
        .idc-front-footer-val { font-size:11.5px;font-weight:700;margin:0; }

        .idc-signature-area { padding:8px 20px 12px;text-align:center; }
        .idc-signature-script { font-family:'Segoe Script','Dancing Script',cursive;font-size:18px;color:${SLATE_700};margin:0 0 1px; }
        .idc-signature-label { font-size:9.5px;font-weight:600;color:${SLATE_500};letter-spacing:.5px; }

        .idc-blue-bar { height:10px;background:linear-gradient(90deg,${PRIMARY.hex},${PRIMARY.dark});border-radius:0 0 16px 16px; }

        /* --- center line --- */
        .idc-divider {display:flex; justify-content:center; align-items:center; padding:0 12px;}
        .idc-divider-line {width:0; height:100%; min-height:520px; border-left:2px dashed #cbd5e1;}

        /* ── Back card styling ── */
        .idc-back-info-row { display:flex;align-items:flex-start;gap:12px;padding:12px 20px; }
        .idc-back-icon-circle { flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${PRIMARY.light};display:grid;place-items:center;color:${PRIMARY.hex}; }
        .idc-back-info-label { font-size:11.5px;font-weight:600;color:${SLATE_700};margin:0; }
        .idc-back-info-value { font-size:11.5px;font-weight:400;color:${SLATE_500};margin:1px 0 0; }
        .idc-back-divider { height:1px;background:${SLATE_200};margin:0 20px; }

        .idc-qr-section { display:flex;flex-direction:column;align-items:center;padding:14px 20px 12px; }
        .idc-qr-frame { width:100px;height:100px;border:2px dashed ${PRIMARY.hex};border-radius:12px;padding:6px;display:grid;place-items:center; }
        .idc-qr-frame img { width:100%;height:100%; }
        .idc-qr-label { font-size:11px;font-weight:700;color:${PRIMARY.hex};letter-spacing:.5px;margin:8px 0 1px;text-transform:uppercase; }
        .idc-qr-id { font-size:10px;color:${SLATE_500};margin:0; }

        .idc-return-section { text-align:center;padding:6px 20px 14px; }
        .idc-return-text { font-size:10.5px;color:${SLATE_500};margin:0 0 4px; }
        .idc-return-company { font-size:13px;font-weight:700;color:${SLATE_900};margin:0 0 2px; }
        .idc-return-addr { font-size:10.5px;color:${SLATE_700};margin:0;line-height:1.4; }
        .idc-return-link { font-size:10.5px;color:${PRIMARY.hex};margin:2px 0 0;font-weight:500; }

        /* ── Bottom action bar ── */
        .idc-actions-bar { display:flex;align-items:center;justify-content:center;gap:12px;padding:20px 24px;background:#fff;border:1px solid ${SLATE_200};border-top:none;border-radius:0 0 16px 16px; }
        .idc-action-btn { display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-action-outline { border:1.5px solid ${SLATE_200};background:#fff;color:${SLATE_700}; }
        .idc-action-outline:hover { background:${SLATE_50};border-color:${SLATE_400}; }
        .idc-action-primary { border:none;background:${PRIMARY.hex};color:#fff; }
        .idc-action-primary:hover { background:${PRIMARY.dark}; }

        /* ── Cut line ── */
        .cut-line { margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:8px;padding:4px 0 0;}
        .cut-line span { font-size:10px;color:${SLATE_400};letter-spacing:.5px; }
        .cut-line-dash { flex:1;border-top:2px dashed ${SLATE_500}; }
      `}</style>

      {/* Off-screen canvas export container (always side-by-side) */}
      <div
        ref={exportRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "900px",
          backgroundColor: "#f1f5f9",
          padding: "24px",
          display: "flex",
          gap: "24px",
          justifyContent: "center",
          alignItems: "flex-start",
          zIndex: -1,
        }}
      >
        <div className="idc-card-wrapper" style={{ flex: "0 0 420px" }}>
          <span className="idc-card-label">FRONT</span>
          <div className="cut-line" style={{ width: "100%" }}>
            <span className="cut-line-dash" />
            <span>✂ CUT HERE ✂</span>
            <span className="cut-line-dash" />
          </div>
          {renderFrontCardContent()}
        </div>
        <div className="idc-divider">
          <div className="idc-divider-line"></div>
        </div>
        <div className="idc-card-wrapper" style={{ flex: "0 0 420px" }}>
          <span className="idc-card-label">BACK</span>
          <div className="cut-line" style={{ width: "100%" }}>
            <span className="cut-line-dash" />
            <span>✂ CUT HERE ✂</span>
            <span className="cut-line-dash" />
          </div>
          {renderBackCardContent()}
        </div>
      </div>

      <div
        className="idc-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="idc-modal-box">
          {/* ── Toolbar ── */}
          <div className="idc-toolbar">
            <h3>ID Card</h3>
            <div className="idc-toolbar-actions">
              {/* Layout view mode toggle */}
              <div className="idc-view-toggle">
                <button
                  className={`idc-toggle-btn ${viewMode === "side-by-side" ? "active" : ""
                    }`}
                  onClick={() => setViewMode("side-by-side")}
                  title="Side by Side Layout"
                >
                  <Columns size={14} /> Side-by-Side
                </button>
                <button
                  className={`idc-toggle-btn ${viewMode === "flip" ? "active" : ""
                    }`}
                  onClick={() => setViewMode("flip")}
                  title="3D Flip Card Layout"
                >
                  <RotateCw size={14} /> 3D Flip View
                </button>
              </div>

              {viewMode === "side-by-side" && (
                <button
                  className="idc-btn-outline"
                  onClick={() => {
                    setViewMode("flip");
                    setIsFlipped((prev) => !prev);
                  }}
                  title="Rotate to 3D Flip Card"
                >
                  <RotateCw size={14} /> Rotate / Flip
                </button>
              )}

              <button
                className="idc-btn-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Cards View ── */}
          <div className="idc-cards-area">
            {viewMode === "side-by-side" ? (
              <>
                {/* ═══ FRONT ═══ */}
                <div className="idc-card-wrapper">
                  <span className="idc-card-label">FRONT</span>
                  <div className="cut-line" style={{ width: "100%" }}>
                    <span className="cut-line-dash" />
                    <span>✂ CUT HERE ✂</span>
                    <span className="cut-line-dash" />
                  </div>
                  {renderFrontCardContent()}
                </div>

                <div className="idc-divider">
                  <div className="idc-divider-line"></div>
                </div>

                {/* ═══ BACK ═══ */}
                <div className="idc-card-wrapper">
                  <span className="idc-card-label">BACK</span>
                  <div className="cut-line" style={{ width: "100%" }}>
                    <span className="cut-line-dash" />
                    <span>✂ CUT HERE ✂</span>
                    <span className="cut-line-dash" />
                  </div>
                  {renderBackCardContent()}
                </div>
              </>
            ) : (
              /* ═══ 3D FLIP VIEW ═══ */
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="flex items-center gap-3">
                  <button
                    className="idc-btn-fill"
                    onClick={() => setIsFlipped((prev) => !prev)}
                  >
                    <RotateCw
                      size={15}
                      className={`transition-transform duration-300 ${isFlipped ? "rotate-180" : ""
                        }`}
                    />
                    Rotate Card ({isFlipped ? "Back Side" : "Front Side"})
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    (Click card to flip)
                  </span>
                </div>

                <div className="idc-flip-scene">
                  <div
                    className={`idc-flip-card-box ${isFlipped ? "is-flipped" : ""
                      }`}
                    onClick={() => setIsFlipped((prev) => !prev)}
                  >
                    <div className="idc-flip-face">
                      {renderFrontCardContent()}
                    </div>
                    <div className="idc-flip-face idc-flip-face-back">
                      {renderBackCardContent()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom actions ── */}
          <div className="idc-actions-bar">
            {isHrPreview ? (
              localSigned ? (
                <>
                  <button
                    className="idc-action-btn idc-action-primary"
                    disabled={signing}
                    onClick={handleApprove}
                  >
                    {signing ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="idc-action-btn idc-action-outline"
                    onClick={onClose}
                  >
                    <X size={18} /> Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="idc-action-btn idc-action-primary"
                    onClick={handleESign}
                  >
                    E-Sign
                  </button>
                  <button
                    className="idc-action-btn idc-action-outline"
                    onClick={onClose}
                  >
                    <X size={18} /> Close
                  </button>
                </>
              )
            ) : (
              <>
                <button
                  className="idc-action-btn idc-action-outline"
                  onClick={downloadPDF}
                >
                  <FileDown size={16} /> Download PDF
                </button>
                <button
                  className="idc-action-btn idc-action-outline"
                  onClick={downloadPNG}
                >
                  <ImageDown size={16} /> Download PNG
                </button>
                <button
                  className="idc-action-btn idc-action-primary"
                  onClick={printCard}
                >
                  <Printer size={16} /> Print ID Card
                </button>
                <button
                  className="idc-action-btn idc-action-outline"
                  onClick={onClose}
                >
                  <X size={18} /> Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
