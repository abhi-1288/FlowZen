"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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

/* ─── inline styles (not Tailwind) for the card internals so they render
       identically in print / canvas capture ─── */

const BLUE = "#2563eb";
const BLUE_DARK = "#1d4ed8";
const BLUE_LIGHT = "#eff6ff";
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
}: {
  open: boolean;
  onClose: () => void;
  profile: AnyRecord | null;
  company: AnyRecord | null;
  avatarUrl: string;
  displayName: string;
  displayRole: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const uniqueId = profile?.companyIdentityCode
    ? String(profile.companyIdentityCode)
    : "—";
  const qrValue =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${uniqueId}`
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

  /* ── download helpers ── */

  const captureCard = useCallback(async () => {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(cardRef.current, {
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

  /* ── data computations (moved before early-return so callbacks can use them) ── */

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const phone = profile?.phone ? String(profile.phone) : "—";
  const email = profile?.email ? String(profile.email) : "—";
  const companyName = company?.name ? String(company.name) : "—";
  const companyAddr = company?.address ? String(company.address) : "";
  const companyIcon = company?.icon ? String(company.icon) : "/Logos/logo.jpg";
  const joiningDate = formatDate(profile?.companyJoined);
  const issueDate = formatDate(new Date().toISOString());
  const domain = deriveCompanyDomain(companyName);
  const supportEmail = `support@${domain}.com`;
  const website = `www.${domain}.com`;
  const bloodGroup = profile?.bloodGroup ? String(profile.bloodGroup) : "—";
  const emergencyContact = profile?.emergencyContact
    ? String(profile.emergencyContact)
    : "—";

  const addrParts = companyAddr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const addrLine1 = addrParts.slice(0, 2).join(", ");
  const addrLine2 = addrParts.slice(2).join(", ");


  if (!open) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <>
      <style>{`
        .idc-modal-overlay { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);padding:16px;overflow-y:auto; }
        .idc-modal-box { width:100%;max-width:940px;animation:idc-fadeIn .25s ease-out; }
        @keyframes idc-fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

        /* ── Toolbar ── */
        .idc-toolbar { display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:#fff;border:1px solid ${SLATE_200};border-radius:16px 16px 0 0; }
        .idc-toolbar h3 { font-size:18px;font-weight:700;color:${SLATE_900};margin:0; }
        .idc-toolbar-actions { display:flex;align-items:center;gap:8px; }
        .idc-btn-outline { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid ${SLATE_200};background:#fff;color:${SLATE_700};font-size:13px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-btn-outline:hover { background:${SLATE_50};border-color:${SLATE_400}; }
        .idc-btn-fill { display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;border:none;background:${BLUE};color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-btn-fill:hover { background:${BLUE_DARK}; }
        .idc-btn-close { display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:${SLATE_400};cursor:pointer;transition:all .15s; }
        .idc-btn-close:hover { background:${SLATE_50};color:${SLATE_700}; }

        /* ── Cards area ── */
        .idc-cards-area { display:flex;gap:24px;padding:24px;background:${SLATE_50};border-left:1px solid ${SLATE_200};border-right:1px solid ${SLATE_200}; }
        @media(max-width:720px){ .idc-cards-area { flex-direction:column;align-items:center; } }

        .idc-card-wrapper { flex:1;min-width:0;display:flex;flex-direction:column;align-items:center; }
        .idc-card-label { display:inline-block;padding:4px 16px;border-radius:6px;border:1px solid ${SLATE_200};background:#fff;font-size:12px;font-weight:600;color:${SLATE_700};letter-spacing:.5px;margin-bottom:8px; }

        /* ── Single card face ── */
        .idc-card { width:100%;max-width:420px;min-height:480px;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08); }

        /* ── Front card ── */
        .idc-front-header { position:relative;padding:28px 24px 24px;text-align:center;background:linear-gradient(135deg,${BLUE} 0%,${BLUE_DARK} 100%);color:#fff;overflow:hidden; }
        .idc-front-header::before { content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.08); }
        .idc-front-header::after { content:'';position:absolute;bottom:-20px;left:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.05); }
        .idc-front-header img { position:relative;z-index:1;width:48px;height:48px;border-radius:12px;border:2px solid rgba(255,255,255,.3);object-fit:cover;margin-bottom:8px; }
        .idc-front-company-name { position:relative;z-index:1;font-size:20px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px; }
        .idc-front-company-addr { position:relative;z-index:1;font-size:11px;color:rgba(255,255,255,.85);margin:0;line-height:1.4; }

        .idc-eid-title { display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 24px; }
        .idc-eid-line { flex:0 0 32px;height:2px;border-radius:1px;background:${BLUE}; }
        .idc-eid-text { font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${SLATE_900}; }

        .idc-front-body { display:flex;gap:16px;padding:0 24px 16px; }
        .idc-avatar-frame { flex-shrink:0;width:120px;height:140px;border-radius:12px;border:2px solid ${SLATE_200};overflow:hidden;background:${SLATE_50}; }
        .idc-avatar-frame img { width:100%;height:100%;object-fit:cover; }
        .idc-avatar-initials { width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg,${BLUE},${BLUE_DARK});font-size:32px;font-weight:700;color:#fff; }

        .idc-detail-rows { flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;padding-top:4px; }
        .idc-detail-row { display:flex;align-items:flex-start;gap:10px; }
        .idc-detail-icon { flex-shrink:0;width:28px;height:28px;border-radius:8px;background:${BLUE_LIGHT};display:grid;place-items:center;color:${BLUE}; }
        .idc-detail-content { min-width:0; }
        .idc-detail-label { font-size:10px;font-weight:600;color:${SLATE_500};letter-spacing:.3px;margin:0;line-height:1.2; }
        .idc-detail-value { font-size:12px;font-weight:700;color:${SLATE_900};margin:0;word-break:break-all;line-height:1.4; }
        .idc-detail-value.blue { color:${BLUE}; }

        .idc-front-footer { display:flex;border-top:1px solid ${SLATE_200};margin:0 24px; }
        .idc-front-footer-item { flex:1;display:flex;align-items:center;gap:8px;padding:12px 0; }
        .idc-front-footer-item + .idc-front-footer-item { border-left:1px solid ${SLATE_200};padding-left:16px; }
        .idc-front-footer-icon { color:${BLUE};flex-shrink:0; }
        .idc-front-footer-label { font-size:10px;font-weight:600;color:${SLATE_500};margin:0; }
        .idc-front-footer-val { font-size:12px;font-weight:700;margin:0; }

        .idc-signature-area { padding:12px 24px 16px;text-align:center; }
        .idc-signature-script { font-family:'Segoe Script','Dancing Script',cursive;font-size:20px;color:${SLATE_700};margin:0 0 2px; }
        .idc-signature-label { font-size:10px;font-weight:600;color:${SLATE_500};letter-spacing:.5px; }

        .idc-blue-bar { height:10px;background:linear-gradient(90deg,${BLUE},${BLUE_DARK});border-radius:0 0 16px 16px; }

        /* ---  center line --- */
        .idc-divider {display:flex; justify-content:center; align-items:center; padding:0 20px;}
        .idc-divider-line {width:0; height:100%; min-height:520px; border-left:2px dashed #cbd5e1;}

        /* ── Back card ── */
        .idc-back-info-row { display:flex;align-items:flex-start;gap:14px;padding:16px 24px; }
        .idc-back-icon-circle { flex-shrink:0;width:36px;height:36px;border-radius:50%;background:${BLUE_LIGHT};display:grid;place-items:center;color:${BLUE}; }
        .idc-back-info-label { font-size:12px;font-weight:600;color:${SLATE_700};margin:0; }
        .idc-back-info-value { font-size:12px;font-weight:400;color:${SLATE_500};margin:2px 0 0; }
        .idc-back-divider { height:1px;background:${SLATE_200};margin:0 24px; }

        .idc-qr-section { display:flex;flex-direction:column;align-items:center;padding:20px 24px 16px; }
        .idc-qr-frame { width:120px;height:120px;border:2px dashed ${BLUE};border-radius:12px;padding:8px;display:grid;place-items:center; }
        .idc-qr-frame img { width:100%;height:100%; }
        .idc-qr-label { font-size:12px;font-weight:700;color:${BLUE};letter-spacing:.5px;margin:10px 0 2px;text-transform:uppercase; }
        .idc-qr-id { font-size:11px;color:${SLATE_500};margin:0; }

        .idc-return-section { text-align:center;padding:8px 24px 20px; }
        .idc-return-text { font-size:11px;color:${SLATE_500};margin:0 0 6px; }
        .idc-return-company { font-size:14px;font-weight:700;color:${SLATE_900};margin:0 0 4px; }
        .idc-return-addr { font-size:11px;color:${SLATE_700};margin:0;line-height:1.5; }
        .idc-return-link { font-size:11px;color:${BLUE};margin:2px 0 0;font-weight:500; }

        /* ── Bottom action bar ── */
        .idc-actions-bar { display:flex;align-items:center;justify-content:center;gap:12px;padding:20px 24px;background:#fff;border:1px solid ${SLATE_200};border-top:none;border-radius:0 0 16px 16px; }
        .idc-action-btn { display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s; }
        .idc-action-outline { border:1.5px solid ${SLATE_200};background:#fff;color:${SLATE_700}; }
        .idc-action-outline:hover { background:${SLATE_50};border-color:${SLATE_400}; }
        .idc-action-primary { border:none;background:${BLUE};color:#fff; }
        .idc-action-primary:hover { background:${BLUE_DARK}; }

        /* ── Print styles ── */
        @media print {
          body > *:not(.idc-modal-overlay) { display:none !important; }
          .idc-modal-overlay { position:fixed !important;inset:0 !important;background:white !important;backdrop-filter:none !important;padding:0 !important;align-items:flex-start !important;justify-content:center !important;padding-top:20px !important; }
          .idc-toolbar, .idc-actions-bar, .idc-card-label { display:none !important; }
          .idc-modal-box { max-width:none !important;animation:none !important; }
          .idc-cards-area { background:#fff !important;border:none !important;padding:0 20px !important; }
          .idc-card { box-shadow:none !important; }
          @page { margin:10mm; }

          body{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
          img,svg{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
        }
      `}</style>

      <div
        className="idc-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="idc-modal-box ">
          {/* ── Toolbar ── */}
          <div className="idc-toolbar py-10">
            <h3>ID Card</h3>
            <div className="idc-toolbar-actions">
              <button
                className="idc-btn-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Cards ── */}
          <div className="idc-cards-area overflow-y-auto" ref={cardRef}>
            {/* ═══ FRONT ═══ */}
            <div className="idc-card-wrapper">
              <span className="idc-card-label">FRONT</span>
              <div className="idc-card">
                {/* Blue header */}
                <div className="idc-front-header">
                  <img src={companyIcon} alt={companyName} />
                  <p className="idc-front-company-name">{companyName}</p>
                  {addrLine1 && (
                    <p className="idc-front-company-addr">
                      {addrLine1}
                      {addrLine2 ? <br /> : null}
                      {addrLine2 || null}
                    </p>
                  )}
                </div>

                {/* Employee ID Card title */}
                <div className="idc-eid-title">
                  <span className="idc-eid-line" />
                  <span className="idc-eid-text">Employee ID Card</span>
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
                    {/* Employee ID */}
                    <div className="idc-detail-row">
                      <div className="idc-detail-icon">
                        <IdCard size={14} />
                      </div>
                      <div className="idc-detail-content">
                        <p className="idc-detail-label">Employee ID</p>
                        <p className="idc-detail-value blue">{uniqueId}</p>
                      </div>
                    </div>
                    {/* Name */}
                    <div className="idc-detail-row">
                      <div className="idc-detail-icon">
                        <User size={14} />
                      </div>
                      <div className="idc-detail-content">
                        <p className="idc-detail-label">Name</p>
                        <p className="idc-detail-value">{displayName}</p>
                      </div>
                    </div>
                    {/* Designation */}
                    <div className="idc-detail-row">
                      <div className="idc-detail-icon">
                        <Briefcase size={14} />
                      </div>
                      <div className="idc-detail-content">
                        <p className="idc-detail-label">Designation</p>
                        <p className="idc-detail-value">{displayRole}</p>
                      </div>
                    </div>
                    {/* Phone */}
                    <div className="idc-detail-row">
                      <div className="idc-detail-icon">
                        <Phone size={14} />
                      </div>
                      <div className="idc-detail-content">
                        <p className="idc-detail-label">Phone</p>
                        <p className="idc-detail-value">{phone}</p>
                      </div>
                    </div>
                    {/* Email */}
                    <div className="idc-detail-row">
                      <div className="idc-detail-icon">
                        <Mail size={14} />
                      </div>
                      <div className="idc-detail-content">
                        <p className="idc-detail-label">Email</p>
                        <p className="idc-detail-value">{email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Issue / Valid footer */}
                <div className="idc-front-footer">
                  <div className="idc-front-footer-item">
                    <CalendarDays size={14} className="idc-front-footer-icon" />
                    <div>
                      <p className="idc-front-footer-label">Issue Date</p>
                      <p
                        className="idc-front-footer-val"
                        style={{ color: SLATE_900 }}
                      >
                        {issueDate}
                      </p>
                    </div>
                  </div>
                  <div className="idc-front-footer-item">
                    <CalendarDays size={14} className="idc-front-footer-icon" />
                    <div>
                      <p className="idc-front-footer-label">Valid Till</p>
                      <p
                        className="idc-front-footer-val"
                        style={{ color: BLUE, fontWeight: 700 }}
                      >
                        Active Employee
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div className="idc-signature-area">
                  <p className="idc-signature-script">Authorised</p>
                  <p className="idc-signature-label">Authorised Signature</p>
                </div>

                {/* Blue bar */}
                <div className="idc-blue-bar" />
              </div>
            </div>

            <div className="idc-divider">
              <div className="idc-divider-line"></div>
            </div>

            {/* ═══ BACK ═══ */}
            <div className="idc-card-wrapper">
              <span className="idc-card-label">BACK</span>
              <div className="idc-card">
                {/* Emergency Contact */}
                <div className="idc-back-info-row">
                  <div className="idc-back-icon-circle">
                    <PhoneCall size={16} />
                  </div>
                  <div>
                    <p className="idc-back-info-label">Emergency Contact</p>
                    <p className="idc-back-info-value">{emergencyContact}</p>
                  </div>
                </div>

                {/* Blood Group */}
                <div className="idc-back-info-row">
                  <div className="idc-back-icon-circle">
                    <Droplets size={16} />
                  </div>
                  <div>
                    <p className="idc-back-info-label">Blood Group</p>
                    <p className="idc-back-info-value">{bloodGroup}</p>
                  </div>
                </div>

                {/* Joining Date */}
                <div className="idc-back-info-row">
                  <div className="idc-back-icon-circle">
                    <CalendarDays size={16} />
                  </div>
                  <div>
                    <p className="idc-back-info-label">Joining Date</p>
                    <p className="idc-back-info-value">{joiningDate}</p>
                  </div>
                </div>

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

                <div className="idc-back-divider" />

                {/* Return info */}
                <div className="idc-return-section">
                  <p className="idc-return-text">If found please return to</p>
                  <p className="idc-return-company">{companyName}</p>
                  {companyAddr && (
                    <p className="idc-return-addr">
                      {addrLine1}
                      {addrLine2 ? <br /> : null}
                      {addrLine2 || null}
                    </p>
                  )}
                  <p className="idc-return-link">{supportEmail}</p>
                  <p className="idc-return-link">{website}</p>
                </div>

                {/* Blue bar */}
                <div className="idc-blue-bar" />
              </div>
            </div>
          </div>

          {/* ── Bottom actions ── */}
          <div className="idc-actions-bar">
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
              onClick={() => window.print()}
            >
              <Printer size={16} /> Print ID Card
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
