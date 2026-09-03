"use client";

import { useState } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { CURRENCY_SYMBOLS, type ATSOffer } from "@/lib/recruitment-types";
import { useShallow } from "zustand/react/shallow";

function OfferForm({ offer }: { offer: ATSOffer }) {
  const { setModal, updateOffer, signOffer, saving } = useRecruitmentStore(
    useShallow((s) => ({
      setModal: s.setModal,
      updateOffer: s.updateOffer,
      signOffer: s.signOffer,
      saving: s.saving,
    })),
  );

  const [offeredCTC, setOfferedCTC] = useState(
    offer.offeredCTC != null ? String(offer.offeredCTC) : "",
  );
  const [department, setDepartment] = useState(offer.department || "");
  const [pfAmount, setPfAmount] = useState(
    offer.pfAmount != null ? String(offer.pfAmount) : "",
  );
  const [esicAmount, setEsicAmount] = useState(
    offer.esicAmount != null ? String(offer.esicAmount) : "",
  );
  const [joiningDate, setJoiningDate] = useState(
    offer.joiningDate ? offer.joiningDate.split("T")[0] : "",
  );
  const [designation, setDesignation] = useState(offer.designation || "");
  const [officeLocation, setOfficeLocation] = useState(offer.officeLocation || "");
  const [perks, setPerks] = useState(offer.perks || "");
  const [signAndSend, setSignAndSend] = useState(false);
  const [signOnly, setSignOnly] = useState(false);

  const currencySymbol =
    CURRENCY_SYMBOLS[String(offer.currency || "INR").toUpperCase()] || "₹";
  const salaryLabel =
    offer.salaryType === "per-month"
      ? "per month"
      : offer.salaryType === "per-day"
        ? "per day"
        : offer.salaryType === "per-hour"
          ? "per hour"
          : "per annum";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    const shouldSignAndSend = signAndSend;
    const shouldSignOnly = signOnly;
    setSignAndSend(false);
    setSignOnly(false);

    await updateOffer(offer.id, {
      offeredCTC: Number(offeredCTC || 0),
      department,
      pfAmount: Number(pfAmount || 0),
      esicAmount: Number(esicAmount || 0),
      joiningDate: joiningDate || null,
      designation,
      officeLocation,
      perks,
      status: offer.status === "accepted" ? offer.status : undefined,
    });

    if (shouldSignAndSend) {
      await signOffer(offer.id);
      await updateOffer(offer.id, { status: "sent" });
    } else if (shouldSignOnly) {
      await signOffer(offer.id);
    }

    setModal(null);
  }

  return (
    <form className="p-5" onSubmit={handleSubmit}>
      {offer.isSigned && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          This offer is signed. Changing any detail below will clear the
          signature and it must be signed again before re-sending.
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Offered CTC * ({salaryLabel})
          </span>
          <input
            type="number"
            required
            min="0"
            value={offeredCTC}
            onChange={(e) => setOfferedCTC(e.target.value)}
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-400">
            {currencySymbol}
            {Number(offeredCTC || 0).toLocaleString("en-IN")}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            PF Amount (per year)
          </span>
          <input
            type="number"
            min="0"
            value={pfAmount}
            onChange={(e) => setPfAmount(e.target.value)}
            placeholder="0"
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            ESIC Amount (per year)
          </span>
          <input
            type="number"
            min="0"
            value={esicAmount}
            onChange={(e) => setEsicAmount(e.target.value)}
            placeholder="0"
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Joining Date
          </span>
          <input
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Designation *
          </span>
          <input
            required
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Department
          </span>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Office Location
          </span>
          <input
            value={officeLocation}
            onChange={(e) => setOfficeLocation(e.target.value)}
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block col-span-full">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Travel &amp; Food Accommodation
          </span>
          <textarea
            rows={2}
            value={perks}
            onChange={(e) => setPerks(e.target.value)}
            placeholder="e.g. Company provides travel allowance and complimentary meals."
            className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {offer.status !== "accepted" && offer.status !== "rejected" && !offer.isSigned && (
          <button
            type="submit"
            disabled={saving}
            onClick={() => setSignAndSend(true)}
            className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium"
          >
            {saving ? "Processing..." : "Sign & Send"}
          </button>
        )}
        {offer.status === "sent" && !offer.isSigned && (
          <button
            type="submit"
            disabled={saving}
            onClick={() => setSignOnly(true)}
            className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium"
          >
            {saving ? "Signing..." : "Sign Only"}
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

export default function EditOfferModal() {
  const { modal, setModal, offers } = useRecruitmentStore(
    useShallow((s) => ({
      modal: s.modal,
      setModal: s.setModal,
      offers: s.offers,
    })),
  );

  const offerId = modal?.type === "edit-offer" ? modal.offerId : null;
  const offer = offerId ? offers.find((o) => o.id === offerId) : null;

  if (modal?.type !== "edit-offer") return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto neu-overlay">
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg rounded-lg neu-card">
          <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
            <h2 className="text-base font-semibold">Edit Offer</h2>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
              onClick={() => setModal(null)}
              type="button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          {offer ? (
            <OfferForm key={offer.id} offer={offer} />
          ) : (
            <div className="p-6">
              <p className="text-center text-sm text-slate-500">
                Offer not found.
              </p>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="neu-btn neu-btn-primary mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}