"use client";

import { useState } from "react";
import { DocumentLettersSection } from "./sections/document-letters-section";
import { DocumentLetterModal } from "./document-letter-modal";

export function DocumentLettersTab({
  showToast,
  refresh,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: (silent?: boolean) => Promise<void> | void;
}) {
  const [showDocLetterModal, setShowDocLetterModal] = useState(false);
  const [docLetterMode, setDocLetterMode] = useState<"request" | "send">("request");

  return (
    <div className="space-y-4">
      <DocumentLettersSection
        onRequestLetter={() => { setDocLetterMode("request"); setShowDocLetterModal(true); }}
        onSendResignation={() => { setDocLetterMode("send"); setShowDocLetterModal(true); }}
      />
      {showDocLetterModal ? (
        <DocumentLetterModal
          mode={docLetterMode}
          onClose={() => setShowDocLetterModal(false)}
          onSuccess={() => { setShowDocLetterModal(false); void refresh(true); }}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}
