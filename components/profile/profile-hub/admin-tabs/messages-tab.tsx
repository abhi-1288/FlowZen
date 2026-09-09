import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Search, Send, Users, Check, Info, X, Calendar, Clock, Video, MapPin, Reply, MoreVertical, Copy, Forward, Trash2, SmilePlus, SquareCheck, Paperclip, Download } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, formatRoleWithCustom, SectionHeader } from "../shared";

export function MessagesTab({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"normal" | "bulk" | "meeting" | "group">("normal");
  
  // Normal Chat State
  const [selectedMember, setSelectedMember] = useState<AnyRecord | null>(null);
  const [conversation, setConversation] = useState<AnyRecord[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  
  // Bulk Message State
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [sendingBulk, setSendingBulk] = useState(false);

  // Schedule Meeting State
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [meetingType, setMeetingType] = useState<"online" | "offline">("online");
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [sendingMeeting, setSendingMeeting] = useState(false);

  // Group Chat State
  const [groups, setGroups] = useState<AnyRecord[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AnyRecord | null>(null);
  const [groupConversation, setGroupConversation] = useState<AnyRecord[]>([]);
  const [loadingGroupChat, setLoadingGroupChat] = useState(false);
  const [groupMessage, setGroupMessage] = useState("");
  const [sendingGroupMessage, setSendingGroupMessage] = useState(false);
  
  // Search State
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Reaction & Reply State
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<AnyRecord | null>(null);

  // Message Info Modal State
  const [messageInfoMsg, setMessageInfoMsg] = useState<AnyRecord | null>(null);
  const [messageInfoTab, setMessageInfoTab] = useState<"reactions" | "seen">("reactions");

  // Context Menu State
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [contextMenuMsg, setContextMenuMsg] = useState<AnyRecord | null>(null);

  // Forward Modal State
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<AnyRecord | null>(null);
  const [forwardSource, setForwardSource] = useState<AnyRecord[]>([]);

  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Record<string, AnyRecord>>({});

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { type: "single"; messageId: string }
    | { type: "bulk"; messageIds: string[] }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const REACTION_EMOJIS = ["👍", "👎", "❤️", "🔥", "😂", "😮", "😢", "😡", "🎉", "💯", "👀", "💪", "🙏", "✅", "❌", "⭐", "💡", "👏", "🤔", "😎", "🚀", "✨", "💬", "📌", "🎯", "⏰", "🏆", "💰", "📎", "🥳"];

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File Upload State
  type AttachmentData = { provider: string; fileId: string; name: string; url: string; size: number; mimeType: string };
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    uploading: boolean;
    progress: number;
    error: string | null;
    result: AttachmentData | null;
  } | null>(null);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getAttachmentKind(mimeType: string): "image" | "video" | "file" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    return "file";
  }

  async function uploadAttachment(file: File): Promise<AttachmentData | null> {
    try {
      setPendingUpload({ file, uploading: true, progress: 0, error: null, result: null });

      const authRes = await apiFetch<{ provider: string; publicKey?: string; urlEndpoint?: string; token?: string; expire?: number; signature?: string }>(
        "/api/messages/attachment-auth"
      );

      if (authRes.provider === "imagekit") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("publicKey", authRes.publicKey!);
        formData.append("token", authRes.token!);
        formData.append("expire", String(authRes.expire!));
        formData.append("signature", authRes.signature!);
        formData.append("useUniqueFileName", "true");

        const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.message || "Upload failed");
        }

        const result: AttachmentData = {
          provider: "imagekit",
          fileId: uploadData.fileId,
          name: file.name,
          url: uploadData.url,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        };
        setPendingUpload((prev) => prev ? { ...prev, uploading: false, progress: 100, result } : null);
        return result;
      }

      // Local dev upload
      const formData = new FormData();
      formData.append("file", file);
      const localRes = await fetch("/api/messages/attachment-upload", {
        method: "POST",
        body: formData,
      });
      const localData = await localRes.json();
      if (!localRes.ok) {
        throw new Error(localData.error || "Upload failed");
      }

      const result: AttachmentData = {
        provider: "local",
        fileId: localData.fileId,
        name: localData.name,
        url: localData.url,
        size: localData.size,
        mimeType: localData.mimeType,
      };
      setPendingUpload((prev) => prev ? { ...prev, uploading: false, progress: 100, result } : null);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setPendingUpload((prev) => prev ? { ...prev, uploading: false, error: msg } : null);
      return null;
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      showToast("File must be 200MB or smaller.", "error");
      return;
    }
    uploadAttachment(file);
    e.target.value = "";
  }

  function clearPendingUpload() {
    setPendingUpload(null);
  }

  function formatLastOnline(date: Date | string | null | undefined): string {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    });
  }

  // Fetch company members
  async function fetchMembers() {
    try {
      const result = await apiFetch<{ members: AnyRecord[] }>("/api/messages");
      setMembers(result.members ?? []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  // Listen to realtime refresh event
  useEffect(() => {
    function onRefresh() {
      fetchMembers();
      if (selectedMember) {
        const memberId = String(selectedMember.id ?? selectedMember._id ?? "");
        fetchConversation(memberId, false);
      }
      if (selectedGroup) {
        fetchGroupConversation(String(selectedGroup.id ?? selectedGroup._id ?? ""), false);
      }
    }
    window.addEventListener("messages:refresh", onRefresh);
    return () => window.removeEventListener("messages:refresh", onRefresh);
  }, [selectedMember, selectedGroup]);

  // Fetch conversation with selected user
  async function fetchConversation(recipientId: string, showLoading = true) {
    if (!recipientId) return;
    if (showLoading) setLoadingChat(true);
    try {
      const result = await apiFetch<{ messages: AnyRecord[] }>(`/api/messages/conversation?recipientId=${recipientId}`);
      setConversation(result.messages ?? []);
      
      // If we mark messages as read, reload members count in background to update badges
      if (showLoading) {
        fetchMembers();
      }
    } catch {
      setConversation([]);
    } finally {
      if (showLoading) setLoadingChat(false);
    }
  }

  // Effect to load conversation when selected member changes
  useEffect(() => {
    if (selectedMember) {
      const memberId = String(selectedMember.id ?? selectedMember._id ?? "");
      fetchConversation(memberId, true);
    } else {
      setConversation([]);
    }
    setReplyingTo(null);
  }, [selectedMember]);

  // Scroll to bottom on conversation update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

  // Scroll to bottom on group conversation update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [groupConversation]);

  // Fetch groups when switching to group mode
  useEffect(() => {
    if (mode === "group") {
      fetchGroups();
    }
  }, [mode]);

  async function fetchGroups() {
    try {
      setLoadingGroups(true);
      const result = await apiFetch<{ groups: AnyRecord[] }>("/api/messages/groups");
      setGroups(result.groups ?? []);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }

  async function fetchGroupConversation(teamId: string, showLoading = true) {
    if (!teamId) return;
    if (showLoading) setLoadingGroupChat(true);
    try {
      const result = await apiFetch<{ messages: AnyRecord[] }>(
        `/api/messages/group-conversation?teamId=${teamId}`
      );
      setGroupConversation(result.messages ?? []);
    } catch {
      setGroupConversation([]);
    } finally {
      if (showLoading) setLoadingGroupChat(false);
    }
  }

  useEffect(() => {
    if (selectedGroup) {
      const teamId = String(selectedGroup.id ?? selectedGroup._id ?? "");
      fetchGroupConversation(teamId, true);
    } else {
      setGroupConversation([]);
    }
    setReplyingTo(null);
  }, [selectedGroup]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPickerFor) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-emoji-picker]")) {
        setShowEmojiPickerFor(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPickerFor]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenuMsgId) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        setContextMenuMsgId(null);
        setContextMenuMsg(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenuMsgId(null);
        setContextMenuMsg(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenuMsgId]);

  // Exit selection mode on Escape or back button / phone slide-back
  useEffect(() => {
    if (!selectionMode) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        exitSelectionMode();
      }
    }
    function handlePopState(e: PopStateEvent) {
      const state = e.state as AnyRecord | null;
      if (state && state.flowzenCancelSelection) {
        exitSelectionMode();
      }
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [selectionMode]);

  async function handleSendGroupMessage() {
    const teamId = String(selectedGroup?.id ?? selectedGroup?._id ?? "");
    const text = groupMessage.trim();
    const attachment = pendingUpload?.result ?? null;
    if (!teamId || (!text && !attachment)) return;
    try {
      setSendingGroupMessage(true);
      const body: AnyRecord = { groupId: teamId, message: text };
      if (attachment) body.attachment = attachment;
      if (replyingTo) body.replyTo = String((replyingTo as any).id ?? (replyingTo as any)._id ?? "");
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setGroupMessage("");
      setReplyingTo(null);
      setPendingUpload(null);
      await fetchGroupConversation(teamId, false);
      fetchGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send message.", "error");
    } finally {
      setSendingGroupMessage(false);
    }
  }

  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return members;
    return members.filter((m) => {
      const name = String(m.name ?? "").toLowerCase();
      const email = String(m.email ?? "").toLowerCase();
      const role = String(m.role ?? "").toLowerCase();
      const code = String(m.companyIdentityCode ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || role.includes(query) || code.includes(query);
    });
  }, [members, searchQuery]);

  function toggleBulkSelected(memberId: string) {
    setBulkSelected((current) => ({ ...current, [memberId]: !current[memberId] }));
  }

  const selectedBulkIds = useMemo(() => {
    return Object.keys(bulkSelected).filter((id) => bulkSelected[id]);
  }, [bulkSelected]);

  async function handleSendChat() {
    const recipientId = String(selectedMember?.id ?? selectedMember?._id ?? "");
    const text = chatMessage.trim();
    const attachment = pendingUpload?.result ?? null;
    if (!recipientId || (!text && !attachment)) return;
    try {
      setSendingChat(true);
      const body: AnyRecord = { recipientId, message: text };
      if (attachment) body.attachment = attachment;
      if (replyingTo) body.replyTo = String((replyingTo as any).id ?? (replyingTo as any)._id ?? "");
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setChatMessage("");
      setReplyingTo(null);
      setPendingUpload(null);
      // Fetch immediate history update
      await fetchConversation(recipientId, false);
      // Refresh member list to show latest message preview
      fetchMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send message.", "error");
    } finally {
      setSendingChat(false);
    }
  }

  async function handleScheduleMeeting() {
    if (!meetingTitle.trim()) {
      showToast("Meeting title is required.", "error");
      return;
    }
    if (!meetingDate) {
      showToast("Meeting date is required.", "error");
      return;
    }
    if (selectedBulkIds.length === 0) {
      showToast("Select at least one participant.", "error");
      return;
    }
    if (meetingType === "online" && !meetingLink.trim()) {
      showToast("Meeting link is required for online meetings.", "error");
      return;
    }
    if (meetingType === "offline" && !meetingLocation.trim()) {
      showToast("Location is required for offline meetings.", "error");
      return;
    }
    try {
      setSendingMeeting(true);
      await apiFetch("/api/company/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: meetingTitle.trim(),
          date: meetingDate,
          time: meetingTime,
          durationMinutes: meetingDuration,
          meetingType,
          meetingLink: meetingLink.trim(),
          location: meetingLocation.trim(),
          description: meetingDescription.trim(),
          participantIds: selectedBulkIds,
        }),
      });
      showToast(`Meeting scheduled with ${selectedBulkIds.length} participant(s).`);
      setMeetingTitle("");
      setMeetingDescription("");
      setMeetingLink("");
      setMeetingLocation("");
      setBulkSelected({});
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setMeetingDate(d.toISOString().slice(0, 10));
      setMeetingTime("10:00");
      setMeetingDuration(30);
      setMeetingType("online");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not schedule meeting.", "error");
    } finally {
      setSendingMeeting(false);
    }
  }

  async function handleSendBulk() {
    const text = bulkMessage.trim();
    if (!text) {
      showToast("Write a message first.", "error");
      return;
    }
    if (selectedBulkIds.length === 0) {
      showToast("Select at least one user.", "error");
      return;
    }
    try {
      setSendingBulk(true);
      await Promise.all(
        selectedBulkIds.map((recipientId) =>
          apiFetch("/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipientId, message: text }),
          })
        )
      );
      setBulkMessage("");
      setBulkSelected({});
      showToast(`Bulk message sent to ${selectedBulkIds.length} user(s).`);
      fetchMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send bulk message.", "error");
    } finally {
      setSendingBulk(false);
    }
  }

  const getMessageDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  async function handleReact(messageId: string, emoji: string) {
    try {
      const result = await apiFetch<{ ok: boolean; reactions: AnyRecord[] }>("/api/messages/react", {
        method: "POST",
        body: JSON.stringify({ messageId, emoji }),
      });
      if (result.ok) {
        setConversation((prev) =>
          prev.map((m) => String((m as any).id ?? (m as any)._id) === messageId ? { ...m, reactions: result.reactions } : m)
        );
        setGroupConversation((prev) =>
          prev.map((m) => String((m as any).id ?? (m as any)._id) === messageId ? { ...m, reactions: result.reactions } : m)
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not react.", "error");
    }
    setShowEmojiPickerFor(null);
  }

  function handleReply(msg: AnyRecord) {
    setReplyingTo(msg);
    setShowEmojiPickerFor(null);
  }

  function cancelReply() {
    setReplyingTo(null);
  }

  // Context Menu Handlers
  function openContextMenu(e: React.MouseEvent, msgId: string, msg: AnyRecord) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuMsgId(msgId);
    setContextMenuMsg(msg);
    setShowEmojiPickerFor(null);
  }

  function closeContextMenu() {
    setContextMenuMsgId(null);
    setContextMenuMsg(null);
  }

  function handleCopyMessage(msg: AnyRecord) {
    const text = String((msg as any).message ?? "");
    navigator.clipboard.writeText(text).then(() => {
      showToast("Message copied", "success");
    }).catch(() => {
      showToast("Could not copy", "error");
    });
    closeContextMenu();
  }

  function handleDeleteMessage(msgId: string) {
    setDeleteConfirm({ type: "single", messageId: msgId });
    closeContextMenu();
  }

  async function performDelete() {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    try {
      if (deleteConfirm.type === "single") {
        const result = await apiFetch<{ ok: boolean }>("/api/messages/delete", {
          method: "DELETE",
          body: JSON.stringify({ messageId: deleteConfirm.messageId }),
        });
        if (result.ok) {
          setConversation((prev) => prev.filter((m) => String((m as any).id ?? (m as any)._id) !== deleteConfirm.messageId));
          setGroupConversation((prev) => prev.filter((m) => String((m as any).id ?? (m as any)._id) !== deleteConfirm.messageId));
          showToast("Message deleted", "success");
        }
      } else {
        const ids = deleteConfirm.messageIds;
        await Promise.all(ids.map((id) => apiFetch<{ ok: boolean }>("/api/messages/delete", {
          method: "DELETE",
          body: JSON.stringify({ messageId: id }),
        })));
        const idSet = new Set(ids);
        setConversation((prev) => prev.filter((m) => !idSet.has(String((m as any).id ?? (m as any)._id))));
        setGroupConversation((prev) => prev.filter((m) => !idSet.has(String((m as any).id ?? (m as any)._id))));
        showToast("Messages deleted", "success");
        exitSelectionMode();
      }
      setDeleteConfirm(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete message.", "error");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  function handleForwardMessage() {
    if (!contextMenuMsg) return;
    setForwardSource([contextMenuMsg]);
    setShowForwardModal(true);
    closeContextMenu();
  }

  async function handleSendForward(target?: AnyRecord) {
    const recipient = target ?? forwardTarget;
    if (!recipient || forwardSource.length === 0) return;
    try {
      for (const m of forwardSource) {
        await apiFetch<{ ok: boolean }>("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            recipientId: String(recipient._id ?? recipient.id),
            message: String((m as any).message ?? ""),
          }),
        });
      }
      showToast(forwardSource.length > 1 ? "Messages forwarded" : "Message forwarded", "success");
      setShowForwardModal(false);
      setForwardTarget(null);
      setForwardSource([]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not forward message.", "error");
    }
  }

  // Selection Mode Handlers
  function enterSelectionMode(msgId: string, msg: AnyRecord) {
    setSelectedMessages({ [msgId]: msg });
    setSelectionMode(true);
    window.history.pushState({ flowzenCancelSelection: true }, "");
    closeContextMenu();
  }

  function toggleSelectMessage(msgId: string, msg: AnyRecord) {
    setSelectedMessages((prev) => {
      const next = { ...prev };
      if (next[msgId]) delete next[msgId];
      else next[msgId] = msg;
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedMessages({});
  }

  function getMessageSenderName(m: AnyRecord): string {
    const senderObj = (m as any).sender;
    if (typeof senderObj === "object" && senderObj !== null) return String((senderObj as any).name ?? "Member");
    const senderId = String(senderObj ?? "");
    if (senderId === currentUserId) return String(session?.user?.name ?? "You");
    const mem = members.find((mm) => String(mm.id ?? mm._id) === senderId);
    return String(mem?.name ?? "Member");
  }

  async function handleCopySelected() {
    const ids = Object.keys(selectedMessages);
    if (ids.length === 0) return;
    let text: string;
    if (ids.length === 1) {
      text = String((selectedMessages[ids[0]] as any).message ?? "");
    } else {
      text = ids.map((id) => {
        const m = selectedMessages[id];
        const time = new Date((m as any).createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `${getMessageSenderName(m)}: ${time} = ${String((m as any).message ?? "")}`;
      }).join("\n");
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Messages copied", "success");
    } catch {
      showToast("Could not copy", "error");
    }
  }

  async function handleDeleteSelected() {
    const ids = Object.keys(selectedMessages);
    if (ids.length === 0) return;
    setDeleteConfirm({ type: "bulk", messageIds: ids });
  }

  function handleForwardSelected() {
    const msgs = Object.values(selectedMessages);
    if (msgs.length === 0) return;
    setForwardSource(msgs);
    setShowForwardModal(true);
    exitSelectionMode();
  }

  return (
    <section className="rounded-xl neu-card p-5">
      <SectionHeader title="Messages" description="Real-time company chat and announcements." accent="sky" />

      {/* Main chat window split grid */}
      <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--c-border-light)] lg:grid-cols-12" style={{ height: "650px" }}>
        
        {/* Left Side Pane (Members / Channels) */}
        <div className="flex flex-col min-h-0 overflow-hidden border-r border-[var(--c-border-light)] bg-[var(--c-bg-muted)] lg:col-span-3">
          
          {/* Header Action Mode Switchers */}
          <div className="border-b border-[var(--c-border-light)] bg-[var(--c-bg-card)] p-4">
            <div className="flex rounded-lg bg-[var(--c-bg-muted)] p-1">
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${ mode === "normal" ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-800" }`}
                onClick={() => {
                  setMode("normal");
                  setSelectedMember(null);
                  setSelectedGroup(null);
                }}
              >
                Messages
              </button>
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${ mode === "bulk" ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-800" }`}
                onClick={() => {
                  setMode("bulk");
                  setSelectedMember(null);
                  setSelectedGroup(null);
                }}
              >
                Bulk Message
              </button>
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${ mode === "meeting" ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-800" }`}
                onClick={() => {
                  setMode("meeting");
                  setSelectedMember(null);
                  setSelectedGroup(null);
                }}
              >
                Schedule Meeting
              </button>
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${ mode === "group" ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-800" }`}
                onClick={() => {
                  setMode("group");
                  setSelectedMember(null);
                  setSelectedGroup(null);
                }}
              >
                Groups
              </button>
            </div>

            {/* Search Input Box */}
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={mode === "group" ? "Search groups..." : "Search members..."}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearchQuery(searchInput);
                  }}
                  className="neu-inset w-full rounded-md pl-8 pr-3 py-1.5 text-[11px] transition"
                />
              </div>
              <button
                onClick={() => setSearchQuery(searchInput)}
                className="neu-btn neu-btn-primary rounded-md px-3 py-1.5 text-[11px] font-medium"
              >
                Go
              </button>
            </div>
          </div>

          {/* Members / Groups Scroll List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {mode === "group" ? (
              loadingGroups ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading groups...</div>
              ) : groups.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No groups found.</div>
              ) : (
                groups
                  .filter((g) => {
                    const query = searchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return String(g.name ?? "").toLowerCase().includes(query);
                  })
                  .map((group) => {
                    const groupId = String(group.id ?? group._id ?? "");
                    const isSelected = selectedGroup?.id === groupId || selectedGroup?._id === groupId;
                    const unread = Number(group.unreadCount ?? 0);
                    return (
                      <button
                        key={groupId}
                        onClick={() => setSelectedGroup(group)}
                        className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${ isSelected ? "neu-tab-pressed" : "hover:bg-[var(--c-bg-muted)] text-slate-700" }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                          <Users size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {String(group.name)}
                            </p>
                            {unread > 0 && (
                              <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                                {unread}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-slate-400">
                            {Number(group.memberCount ?? 0)} member{Number(group.memberCount ?? 0) !== 1 ? "s" : ""}
                          </p>
                          {Boolean(group.lastMessage) && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">
                              {(group.lastMessage as AnyRecord).attachment && !(group.lastMessage as AnyRecord).message ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Paperclip size={10} className="inline" /> Attachment
                                </span>
                              ) : (
                                <>
                                  {String((group.lastMessage as AnyRecord).message ?? "")}
                                  {(group.lastMessage as AnyRecord).attachment && <Paperclip size={9} className="ml-0.5 inline" />}
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })
              )
            ) : loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No members found.</div>
            ) : (
              filteredMembers.map((member) => {
                const memberId = String(member.id ?? member._id ?? "");
                const name = String(member.name ?? "Member");
                const role = formatRoleWithCustom(String(member.role ?? "employee"), (member as any).customRole, Boolean((member as any).isSeniorSecurity));
                const isSelected = mode === "normal" ? selectedMember?.id === memberId || selectedMember?._id === memberId : !!bulkSelected[memberId];
                
                // unread message badge count
                const unread = Number(member.unreadCount ?? 0);
                
                return (
                  <button
                    key={memberId}
                    onClick={() => {
                      if (mode === "bulk" || mode === "meeting") {
                        toggleBulkSelected(memberId);
                      } else {
                        setSelectedMember(member);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${ isSelected ? mode === "bulk" || mode === "meeting" ? "bg-[var(--c-bg-muted)] text-slate-900" : "neu-tab-pressed" : "hover:bg-[var(--c-bg-muted)] text-slate-700" }`}
                  >
                    {/* Avatar Initials / Image */}
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--c-bg-hover)] font-semibold text-slate-700 text-xs">
                      {member.avatarUrl ? (
                        <img
                          src={String(member.avatarUrl)}
                          alt={name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(name)
                      )}
                      
                      {/* Online indicator */}
                      {(member as any).isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></span>
                      )}

                      {/* Bulk/Meeting mode selection indicator */}
                      {(mode === "bulk" || mode === "meeting") && isSelected && (
                        <span className="neu-btn neu-btn-success absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`truncate text-xs font-semibold ${isSelected && (mode === "bulk" || mode === "meeting") ? "text-slate-900" : "text-slate-900"}`}>
                          {name}
                        </p>
                        {/* Unread badge count next to username */}
                        {unread > 0 && mode === "normal" && (
                          <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className={`truncate text-[10px] ${isSelected && (mode === "bulk" || mode === "meeting") ? "text-slate-500" : "text-slate-400"}`}>
                        {role}
                      </p>
                      {/* Last message preview */}
                      {mode === "normal" && !!(member.lastMessage as any) && (
                          <p className={`mt-0.5 truncate text-[10px] ${isSelected ? "text-slate-600" : "text-slate-400"}`}>
                            {(member.lastMessage as any).sender === currentUserId ? (
                              <>
                                {(member.lastMessage as any).readAt ? (
                                  <span className="text-emerald-500 mr-0.5">✓✓</span>
                                ) : (member.lastMessage as any).receivedAt ? (
                                  <span className="text-slate-400 mr-0.5">✓✓</span>
                                ) : (
                                  <span className="text-slate-400 mr-0.5">✓</span>
                                )}
                                You:{" "}
                              </>
                            ) : ""}
                            {(member.lastMessage as any).attachment && !(member.lastMessage as any).message ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Paperclip size={10} className="inline" /> Attachment
                              </span>
                            ) : (
                              (member.lastMessage as any).message
                            )}
                            {(member.lastMessage as any).attachment && (member.lastMessage as any).message && (
                              <Paperclip size={9} className="ml-0.5 inline" />
                            )}
                          </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side Chat Conversation Area */}
        <div className="flex flex-col min-h-0 overflow-hidden bg-[var(--c-bg-card)] lg:col-span-9">
          {mode === "meeting" ? (
            /* Schedule Meeting panel */
            <div className="flex flex-col h-full overflow-y-auto p-6">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={16} className="text-slate-500" />
                Schedule Meeting
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Select participants on the left and fill in the meeting details below.
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border border-[var(--c-border-light)] rounded-lg p-2 bg-[var(--c-bg-muted)]">
                {selectedBulkIds.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">No participants selected. Click users on the sidebar to add them.</span>
                ) : (
                  selectedBulkIds.map((id) => {
                    const memberObj = members.find((m) => String(m.id ?? m._id) === id);
                    if (!memberObj) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded bg-[var(--c-bg-hover)] px-2 py-1 text-[10px] font-medium text-slate-700">
                        {String(memberObj.name)}
                        <button onClick={() => toggleBulkSelected(id)} className="hover:text-red-500 font-bold ml-1 text-slate-400">&times;</button>
                      </span>
                    );
                  })
                )}
              </div>

              <div className="mt-4 space-y-4 flex-1">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Title</label>
                  <input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                    placeholder="Meeting title"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Meeting Type</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="meetingType"
                        checked={meetingType === "online"}
                        onChange={() => setMeetingType("online")}
                        className="text-slate-900"
                      />
                      <Video size={14} className="text-slate-500" />
                      <span className="text-sm text-slate-700">Online</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="meetingType"
                        checked={meetingType === "offline"}
                        onChange={() => setMeetingType("offline")}
                        className="text-slate-900"
                      />
                      <MapPin size={14} className="text-slate-500" />
                      <span className="text-sm text-slate-700">Offline</span>
                    </label>
                  </div>
                </div>

                {meetingType === "online" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Meeting Link</label>
                    <input
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                      placeholder="https://meet.google.com/... or Zoom/Teams link"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Location</label>
                    <input
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                      placeholder="Room 301, Conference Hall, etc."
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                      <Calendar size={12} /> Date
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                      <Clock size={12} /> Time
                    </label>
                    <input
                      type="time"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Duration</label>
                  <select
                    value={meetingDuration}
                    onChange={(e) => setMeetingDuration(Number(e.target.value))}
                    className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes (optional)</label>
                  <textarea
                    value={meetingDescription}
                    onChange={(e) => setMeetingDescription(e.target.value)}
                    rows={2}
                    className="neu-inset w-full resize-none rounded-md px-3 py-1.5 text-xs"
                    placeholder="Any additional details..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end border-t border-[var(--c-border-light)] pt-4">
                <ActionButton
                  variant="primary"
                  disabled={sendingMeeting || selectedBulkIds.length === 0 || !meetingTitle.trim() || !meetingDate || (meetingType === "online" && !meetingLink.trim()) || (meetingType === "offline" && !meetingLocation.trim())}
                  onClick={handleScheduleMeeting}
                >
                  {sendingMeeting ? "Scheduling..." : `Schedule with ${selectedBulkIds.length} participant(s)`}
                </ActionButton>
              </div>
            </div>
          ) : mode === "bulk" ? (
            /* Bulk message writing panel */
            <div className="flex flex-col h-full p-6">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users size={16} className="text-slate-500" />
                  Bulk Announcement
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Select users on the left pane and write a message below. It will send individual messages to each user.
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-[var(--c-border-light)] rounded-lg p-2 bg-[var(--c-bg-muted)]">
                  {selectedBulkIds.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No users selected. Click users on the sidebar to add them.</span>
                  ) : (
                    selectedBulkIds.map((id) => {
                      const memberObj = members.find((m) => String(m.id ?? m._id) === id);
                      if (!memberObj) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded bg-[var(--c-bg-hover)] px-2 py-1 text-[10px] font-medium text-slate-700">
                          {String(memberObj.name)}
                          <button onClick={() => toggleBulkSelected(id)} className="hover:text-red-500 font-bold ml-1 text-slate-400">×</button>
                        </span>
                      );
                    })
                  )}
                </div>

                <textarea
                  placeholder="Type here your bulk messages..."
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  className="neu-inset mt-4 h-48 w-full rounded-xl p-3 text-[11px] resize-none"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <ActionButton
                  variant="primary"
                  disabled={sendingBulk || selectedBulkIds.length === 0 || !bulkMessage.trim()}
                  onClick={handleSendBulk}
                >
                  {sendingBulk ? "Sending..." : `Send to ${selectedBulkIds.length} users`}
                </ActionButton>
              </div>
            </div>
          ) : selectedGroup ? (
            /* Active Group Conversation View */
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Active Group Header */}
              <div className="flex items-center gap-3 border-b border-[var(--c-border-light)] px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <Users size={16} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-slate-900">{String(selectedGroup.name)}</h4>
                  <p className="text-[10px] text-slate-400">
                    {Number(selectedGroup.memberCount ?? 0)} member{(Number(selectedGroup.memberCount ?? 0)) !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700 transition-colors"
                  title="Group info"
                >
                  <Info size={15} />
                </button>
              </div>

              {/* Selection toolbar */}
              {selectionMode && (
                <div className="flex items-center gap-2 border-b border-[var(--c-border-light)] bg-sky-50/60 px-4 py-2">
                  <span className="text-[11px] font-semibold text-sky-700">
                    {Object.keys(selectedMessages).length} selected
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={handleCopySelected}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors"
                    >
                      <Copy size={12} /> Copy
                    </button>
                    <button
                      onClick={handleForwardSelected}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors"
                    >
                      <Forward size={12} /> Forward
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                    <button
                      onClick={exitSelectionMode}
                      className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700 transition-colors"
                      title="Cancel selection"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Group Chat Message History */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--c-bg-muted)]/50 scrollbar-thin"
              >
                {loadingGroupChat ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading conversation...</div>
                ) : groupConversation.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic">No messages yet. Say hello to the team!</div>
                ) : (
                  (() => {
                    let lastDateStr = "";
                    return groupConversation.map((msg, index) => {
                      const msgCreatedAt = (msg as any).createdAt as string;
                      const msgDateStr = new Date(msgCreatedAt).toDateString();
                      const showDateHeader = msgDateStr !== lastDateStr;
                      lastDateStr = msgDateStr;

                      const senderObj = (msg as any).sender;
                      const senderId = typeof senderObj === "object" && senderObj !== null ? String(senderObj._id ?? senderObj.id ?? "") : String(senderObj ?? "");
                      const senderName = typeof senderObj === "object" && senderObj !== null ? String(senderObj.name ?? "Member") : "Member";
                      const senderAvatar = typeof senderObj === "object" && senderObj !== null ? (senderObj as any).avatarUrl : null;
                      const isMe = senderId === currentUserId;
                      const time = new Date(msgCreatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                      const msgId = String((msg as any).id ?? (msg as any)._id ?? index);
                      const replyToData = (msg as any).replyTo;
                      const reactions: AnyRecord[] = (msg as any).reactions ?? [];

                      return (
                        <div key={msgId} className="flex flex-col space-y-1">
                          {showDateHeader && (
                            <div className="my-4 flex items-center justify-center">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-[var(--c-bg-hover)]/60 px-3 py-1 rounded-full">
                                {getMessageDateLabel(msgCreatedAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`group/msg flex ${isMe ? "justify-end" : "justify-start"} ${selectionMode ? "cursor-pointer" : ""}`}
                            onMouseEnter={() => setHoveredMessageId(msgId)}
                            onMouseLeave={() => { setHoveredMessageId((prev) => prev === msgId ? null : prev); }}
                            onClick={() => { if (selectionMode) toggleSelectMessage(msgId, msg); }}
                          >
                            <div className="relative max-w-[70%]">
                              {/* Selection checkbox */}
                              {selectionMode && (
                                <span className={`absolute -top-2.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${isMe ? "-right-2" : "-left-2"} ${selectedMessages[msgId] ? "bg-sky-500 border-sky-500 text-white" : "bg-[var(--c-bg-card)] border-slate-300 text-transparent"}`}>
                                  <Check size={11} />
                                </span>
                              )}
                              {/* Context menu trigger (chevron appears on hover) */}
                              {!selectionMode && (
                                <button
                                  onClick={(e) => openContextMenu(e, msgId, msg)}
                                  className={`absolute -top-3 ${isMe ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} hidden group-hover/msg:flex h-6 w-6 items-center justify-center rounded-full bg-[var(--c-bg-card)] border border-[var(--c-border-light)] text-slate-400 hover:text-slate-700 hover:bg-[var(--c-bg-muted)] shadow-sm transition-colors z-10`}
                                  title="More actions"
                                >
                                  <MoreVertical size={12} />
                                </button>
                              )}

                              {/* Context menu dropdown */}
                              {contextMenuMsgId === msgId && (
                                <div
                                  data-context-menu
                                  className={`absolute top-6 z-50 w-[220px] rounded-xl bg-[var(--c-bg-card)] border border-[var(--c-border-light)] py-1.5 shadow-xl ${isMe ? "right-0" : "left-0"}`}
                                >
                                  {/* Quick reactions */}
                                  <div className="flex items-center justify-between gap-0.5 px-2 pb-1.5 pt-1">
                                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((e) => (
                                      <button
                                        key={e}
                                        onClick={() => handleReact(msgId, e)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-[var(--c-bg-muted)]"
                                      >
                                        {e}
                                      </button>
                                    ))}
                                    <div className="relative">
                                      <button
                                        onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msgId ? null : msgId)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-[var(--c-bg-muted)]"
                                        title="More reactions"
                                      >
                                        <SmilePlus size={15} />
                                      </button>
                                      {showEmojiPickerFor === msgId && (
                                        <div className={`absolute ${isMe ? "right-0" : "left-0"} top-9 z-50 w-[220px] rounded-xl neu-card p-2`} data-emoji-picker>
                                          <div className="grid grid-cols-10 gap-0.5">
                                            {REACTION_EMOJIS.map((e) => (
                                              <button
                                                key={e}
                                                onClick={() => handleReact(msgId, e)}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-[var(--c-bg-muted)] transition-colors"
                                              >
                                                {e}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="border-t border-[var(--c-border-light)]" />
                                  <button
                                    onClick={() => { setMessageInfoMsg(msg); setMessageInfoTab("reactions"); closeContextMenu(); }}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Info size={12} className="text-slate-400" /> Message info
                                  </button>
                                  <button
                                    onClick={() => { handleReply(msg); closeContextMenu(); }}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Reply size={12} className="text-slate-400" /> Reply
                                  </button>
                                  <button
                                    onClick={() => handleCopyMessage(msg)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Copy size={12} className="text-slate-400" /> Copy
                                  </button>
                                  <button
                                    onClick={() => handleForwardMessage()}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Forward size={12} className="text-slate-400" /> Forward
                                  </button>
                                  <div className="my-1 border-t border-[var(--c-border-light)]" />
                                  <button
                                    onClick={() => enterSelectionMode(msgId, msg)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <SquareCheck size={12} className="text-slate-400" /> Select
                                  </button>
                                  {isMe && (
                                    <>
                                      <div className="my-1 border-t border-[var(--c-border-light)]" />
                                      <button
                                        onClick={() => handleDeleteMessage(msgId)}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                                      >
                                        <Trash2 size={12} /> Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}

                              <div className={`rounded-xl px-4 py-2.5 text-[11px] ${ isMe ? "neu-tab-pressed rounded-tr-none" : "bg-[var(--c-bg-elevated)] border-[var(--c-border-light)] text-slate-800 rounded-tl-none" } ${selectionMode && selectedMessages[msgId] ? "ring-2 ring-sky-400" : ""}`}>
                                {!isMe && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--c-bg-hover)] text-[7px] font-bold text-slate-600 overflow-hidden">
                                      {senderAvatar ? (
                                        <img src={String(senderAvatar)} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        getInitials(senderName)
                                      )}
                                    </div>
                                    <span className="text-[9px] font-semibold text-sky-600">{senderName}</span>
                                  </div>
                                )}

                                {/* Quoted reply preview */}
                                {replyToData && (
                                  <div className={`mb-2 rounded-lg px-2.5 py-1.5 text-[9px] ${isMe ? "bg-white/10 text-white/60" : "bg-[var(--c-bg-muted)] text-slate-500"}`}>
                                    <p className="font-semibold truncate opacity-70">{String(replyToData.sender?.name ?? "Unknown")}</p>
                                    <p className="truncate opacity-60">{String(replyToData.message ?? "")}</p>
                                  </div>
                                )}

                                <p className="leading-relaxed break-words whitespace-pre-wrap">{String((msg as any).message ?? "")}</p>

                                {/* Attachment rendering */}
                                {(msg as any).attachment && (() => {
                                  const att = (msg as any).attachment as any;
                                  if (att.isExpired) {
                                    return (
                                      <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] ${isMe ? "bg-white/10 text-white/50" : "bg-[var(--c-bg-muted)] text-slate-400"}`}>
                                        <Paperclip size={12} />
                                        <span className="italic">Attachment expired</span>
                                      </div>
                                    );
                                  }
                                  if (att.kind === "image") {
                                    return (
                                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-lg overflow-hidden">
                                        <img src={att.url} alt={att.name} className="max-h-48 rounded-lg object-cover" loading="lazy" />
                                      </a>
                                    );
                                  }
                                  if (att.kind === "video") {
                                    return (
                                      <div className="mt-2">
                                        <video controls className="max-h-48 w-full rounded-lg" preload="metadata">
                                          <source src={att.url} type={att.mimeType} />
                                        </video>
                                      </div>
                                    );
                                  }
                                  return (
                                    <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer" className={`mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isMe ? "bg-white/10 hover:bg-white/15" : "bg-[var(--c-bg-muted)] hover:bg-[var(--c-bg-hover)]"}`}>
                                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isMe ? "bg-white/10" : "bg-[var(--c-bg-card)]"}`}>
                                        <Download size={16} className={isMe ? "text-white/70" : "text-slate-500"} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className={`truncate text-[10px] font-medium ${isMe ? "text-white" : "text-slate-800"}`}>{att.name}</p>
                                        <p className={`text-[9px] ${isMe ? "text-white/50" : "text-slate-400"}`}>{formatFileSize(att.size)}</p>
                                      </div>
                                    </a>
                                  );
                                })()}

                                {/* Reaction chips */}
                                {reactions.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {(() => {
                                      const grouped: Record<string, { count: string[]; names: string[]; hasMe: boolean }> = {};
                                      for (const r of reactions) {
                                        const em = String(r.emoji);
                                        if (!grouped[em]) grouped[em] = { count: [], names: [], hasMe: false };
                                        grouped[em].count.push(String(r.user));
                                        const userObj = r.user as AnyRecord;
                                        const reactorName = String(r.userName ?? userObj?.name ?? "");
                                        if (reactorName) grouped[em].names.push(reactorName);
                                        if (String(userObj?._id ?? userObj?.id ?? r.user) === currentUserId) grouped[em].hasMe = true;
                                      }
                                      return Object.entries(grouped).map(([em, data]) => (
                                        <button
                                          key={em}
                                          onClick={() => handleReact(msgId, em)}
                                          title={`Reacted by ${data.names.length > 0 ? data.names.join(", ") : `${data.count.length} user(s)`}`}
                                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${ data.hasMe ? isMe ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700" : isMe ? "bg-white/10 text-white/70" : "bg-[var(--c-bg-muted)] text-slate-600" } hover:opacity-80`}
                                        >
                                          {em} {data.count.length}
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                )}

                                <p className={`mt-1.5 text-right text-[8px] font-medium leading-none ${isMe ? "text-white/60" : "text-slate-400"}`}>
                                  {time}
                                  {isMe && (() => {
                                    const readBy: AnyRecord[] = (msg as any).groupReadBy ?? [];
                                    if (readBy.length === 0) return <span className="ml-1 text-white/50 text-[9px]">✓</span>;
                                    const readNames = readBy.map((r: AnyRecord) => String((r as any).user?.name ?? "")).filter(Boolean);
                                    return (
                                      <span
                                        className="ml-1 text-emerald-400 text-[9px] cursor-default"
                                        title={`Read by ${readNames.length > 0 ? readNames.join(", ") : `${readBy.length} member(s)`}`}
                                      >
                                        ✓✓ {readBy.length}
                                      </span>
                                    );
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Group Chat Send Input */}
              <div className="border-t border-[var(--c-border-light)] p-4">
                {pendingUpload && (
                  <div className="mb-2 rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-muted)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Paperclip size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate text-[10px] text-slate-600">{pendingUpload.file.name}</span>
                      <span className="shrink-0 text-[9px] text-slate-400">{formatFileSize(pendingUpload.file.size)}</span>
                      <button onClick={clearPendingUpload} className="shrink-0 ml-auto text-slate-400 hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    {pendingUpload.uploading && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: "50%" }} />
                      </div>
                    )}
                    {pendingUpload.error && (
                      <p className="mt-1 text-[9px] text-red-500">{pendingUpload.error}</p>
                    )}
                  </div>
                )}
                {replyingTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-[10px]">
                    <Reply size={12} className="text-sky-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sky-700">Replying to {String((replyingTo as any).sender?.name ?? (replyingTo as any).senderName ?? "someone")}</p>
                      <p className="truncate text-sky-500">{String((replyingTo as any).message ?? "")}</p>
                    </div>
                    <button onClick={cancelReply} className="shrink-0 text-sky-400 hover:text-sky-700 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendGroupMessage();
                  }}
                  className="flex gap-2"
                >
                  <input ref={fileInputRef} type="file" accept="*/*" onChange={handleFileSelect} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!!pendingUpload}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors disabled:opacity-40"
                    title="Attach file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message to the group..."
                    value={groupMessage}
                    onChange={(e) => setGroupMessage(e.target.value)}
                    className="neu-inset flex-1 rounded-xl px-4 py-2 text-[11px]"
                  />
                  <button
                    type="submit"
                    disabled={sendingGroupMessage || (!groupMessage.trim() && !pendingUpload?.result)}
                    className="neu-btn neu-btn-primary flex h-9 w-9 items-center justify-center rounded-xl"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          ) : selectedMember ? (
            /* Active Conversation View */
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Active User Header */}
              <div className="flex items-center gap-3 border-b border-[var(--c-border-light)] px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-bg-hover)] font-semibold text-slate-700 text-xs">
                  {selectedMember.avatarUrl ? (
                    <img
                      src={String(selectedMember.avatarUrl)}
                      alt={String(selectedMember.name)}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(String(selectedMember.name ?? "Member"))
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-slate-900 capitalize">{String(selectedMember.name)}</h4>
                  <p className="text-[10px] text-slate-400">
                    {formatRoleWithCustom(String(selectedMember.role), (selectedMember as any).customRole, Boolean((selectedMember as any).isSeniorSecurity))} • {String(selectedMember.email)}
                  </p>
                  {(selectedMember as any).isOnline ? (
                    <p className="text-[10px] font-medium text-emerald-600 mt-0.5">Online</p>
                  ) : (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      Last online: {formatLastOnline((selectedMember as any).lastOnline)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700 transition-colors"
                  title="User info"
                >
                  <Info size={15} />
                </button>
              </div>

              {/* Selection toolbar */}
              {selectionMode && (
                <div className="flex items-center gap-2 border-b border-[var(--c-border-light)] bg-sky-50/60 px-4 py-2">
                  <span className="text-[11px] font-semibold text-sky-700">
                    {Object.keys(selectedMessages).length} selected
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={handleCopySelected}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors"
                    >
                      <Copy size={12} /> Copy
                    </button>
                    <button
                      onClick={handleForwardSelected}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors"
                    >
                      <Forward size={12} /> Forward
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                    <button
                      onClick={exitSelectionMode}
                      className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700 transition-colors"
                      title="Cancel selection"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Message History Scroll */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--c-bg-muted)]/50 scrollbar-thin"
              >
                {loadingChat ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading conversation history...</div>
                ) : conversation.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic">No messages yet. Say hello!</div>
                ) : (
                  (() => {
                    let lastDateStr = "";
                    return conversation.map((msg, index) => {
                      const msgCreatedAt = (msg as any).createdAt as string;
                      const msgDateStr = new Date(msgCreatedAt).toDateString();
                      const showDateHeader = msgDateStr !== lastDateStr;
                      lastDateStr = msgDateStr;

                      const isMe = String((msg as any).sender) === currentUserId;
                      const time = new Date(msgCreatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      const msgId = String((msg as any).id ?? (msg as any)._id ?? index);
                      const replyToData = (msg as any).replyTo;
                      const reactions: AnyRecord[] = (msg as any).reactions ?? [];

                      return (
                        <div key={msgId} className="flex flex-col space-y-1">
                          {showDateHeader && (
                            <div className="my-4 flex items-center justify-center">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-[var(--c-bg-hover)]/60 px-3 py-1 rounded-full">
                                {getMessageDateLabel(msgCreatedAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`group/msg flex ${isMe ? "justify-end" : "justify-start"} ${selectionMode ? "cursor-pointer" : ""}`}
                            onMouseEnter={() => setHoveredMessageId(msgId)}
                            onMouseLeave={() => { setHoveredMessageId((prev) => prev === msgId ? null : prev); }}
                            onClick={() => { if (selectionMode) toggleSelectMessage(msgId, msg); }}
                          >
                            <div className="relative max-w-[70%]">
                              {/* Selection checkbox */}
                              {selectionMode && (
                                <span className={`absolute -top-2.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${isMe ? "-right-2" : "-left-2"} ${selectedMessages[msgId] ? "bg-sky-500 border-sky-500 text-white" : "bg-[var(--c-bg-card)] border-slate-300 text-transparent"}`}>
                                  <Check size={11} />
                                </span>
                              )}
                              {/* Context menu trigger (chevron appears on hover) */}
                              {!selectionMode && (
                                <button
                                  onClick={(e) => openContextMenu(e, msgId, msg)}
                                  className={`absolute -top-3 ${isMe ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} hidden group-hover/msg:flex h-6 w-6 items-center justify-center rounded-full bg-[var(--c-bg-card)] border border-[var(--c-border-light)] text-slate-400 hover:text-slate-700 hover:bg-[var(--c-bg-muted)] shadow-sm transition-colors z-10`}
                                  title="More actions"
                                >
                                  <MoreVertical size={12} />
                                </button>
                              )}

                              {/* Context menu dropdown */}
                              {contextMenuMsgId === msgId && (
                                <div
                                  data-context-menu
                                  className={`absolute top-6 z-50 w-[220px] rounded-xl bg-[var(--c-bg-card)] border border-[var(--c-border-light)] py-1.5 shadow-xl ${isMe ? "right-0" : "left-0"}`}
                                >
                                  {/* Quick reactions */}
                                  <div className="flex items-center justify-between gap-0.5 px-2 pb-1.5 pt-1">
                                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((e) => (
                                      <button
                                        key={e}
                                        onClick={() => handleReact(msgId, e)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-[var(--c-bg-muted)]"
                                      >
                                        {e}
                                      </button>
                                    ))}
                                    <div className="relative">
                                      <button
                                        onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msgId ? null : msgId)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-[var(--c-bg-muted)]"
                                        title="More reactions"
                                      >
                                        <SmilePlus size={15} />
                                      </button>
                                      {showEmojiPickerFor === msgId && (
                                        <div className={`absolute ${isMe ? "right-0" : "left-0"} top-9 z-50 w-[220px] rounded-xl neu-card p-2`} data-emoji-picker>
                                          <div className="grid grid-cols-10 gap-0.5">
                                            {REACTION_EMOJIS.map((e) => (
                                              <button
                                                key={e}
                                                onClick={() => handleReact(msgId, e)}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-[var(--c-bg-muted)] transition-colors"
                                              >
                                                {e}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="border-t border-[var(--c-border-light)]" />
                                  <button
                                    onClick={() => { setMessageInfoMsg(msg); setMessageInfoTab("reactions"); closeContextMenu(); }}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Info size={12} className="text-slate-400" /> Message info
                                  </button>
                                  <button
                                    onClick={() => { handleReply(msg); closeContextMenu(); }}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Reply size={12} className="text-slate-400" /> Reply
                                  </button>
                                  <button
                                    onClick={() => handleCopyMessage(msg)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Copy size={12} className="text-slate-400" /> Copy
                                  </button>
                                  <button
                                    onClick={() => handleForwardMessage()}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <Forward size={12} className="text-slate-400" /> Forward
                                  </button>
                                  <div className="my-1 border-t border-[var(--c-border-light)]" />
                                  <button
                                    onClick={() => enterSelectionMode(msgId, msg)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--c-bg-muted)] transition-colors"
                                  >
                                    <SquareCheck size={12} className="text-slate-400" /> Select
                                  </button>
                                  {isMe && (
                                    <>
                                      <div className="my-1 border-t border-[var(--c-border-light)]" />
                                      <button
                                        onClick={() => handleDeleteMessage(msgId)}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                                      >
                                        <Trash2 size={12} /> Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}

                              <div
                                className={`rounded-xl px-4 py-2.5 text-[11px] ${ isMe ? "neu-tab-pressed rounded-tr-none" : "bg-[var(--c-bg-elevated)] border-[var(--c-border-light)] text-slate-800 rounded-tl-none" } ${selectionMode && selectedMessages[msgId] ? "ring-2 ring-sky-400" : ""}`}
                              >
                                {/* Quoted reply preview */}
                                {replyToData && (
                                  <div className={`mb-2 rounded-lg px-2.5 py-1.5 text-[9px] ${isMe ? "bg-white/10 text-white/60" : "bg-[var(--c-bg-muted)] text-slate-500"}`}>
                                    <p className="font-semibold truncate opacity-70">{String(replyToData.sender?.name ?? "Unknown")}</p>
                                    <p className="truncate opacity-60">{String(replyToData.message ?? "")}</p>
                                  </div>
                                )}

                                <p className="leading-relaxed break-words whitespace-pre-wrap">{String((msg as any).message ?? "")}</p>

                                {/* Attachment rendering */}
                                {(msg as any).attachment && (() => {
                                  const att = (msg as any).attachment as any;
                                  if (att.isExpired) {
                                    return (
                                      <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] ${isMe ? "bg-white/10 text-white/50" : "bg-[var(--c-bg-muted)] text-slate-400"}`}>
                                        <Paperclip size={12} />
                                        <span className="italic">Attachment expired</span>
                                      </div>
                                    );
                                  }
                                  if (att.kind === "image") {
                                    return (
                                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-lg overflow-hidden">
                                        <img src={att.url} alt={att.name} className="max-h-48 rounded-lg object-cover" loading="lazy" />
                                      </a>
                                    );
                                  }
                                  if (att.kind === "video") {
                                    return (
                                      <div className="mt-2">
                                        <video controls className="max-h-48 w-full rounded-lg" preload="metadata">
                                          <source src={att.url} type={att.mimeType} />
                                        </video>
                                      </div>
                                    );
                                  }
                                  return (
                                    <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer" className={`mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isMe ? "bg-white/10 hover:bg-white/15" : "bg-[var(--c-bg-muted)] hover:bg-[var(--c-bg-hover)]"}`}>
                                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isMe ? "bg-white/10" : "bg-[var(--c-bg-card)]"}`}>
                                        <Download size={16} className={isMe ? "text-white/70" : "text-slate-500"} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className={`truncate text-[10px] font-medium ${isMe ? "text-white" : "text-slate-800"}`}>{att.name}</p>
                                        <p className={`text-[9px] ${isMe ? "text-white/50" : "text-slate-400"}`}>{formatFileSize(att.size)}</p>
                                      </div>
                                    </a>
                                  );
                                })()}

                                {/* Reaction chips */}
                                {reactions.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {(() => {
                                      const grouped: Record<string, { count: string[]; names: string[]; hasMe: boolean }> = {};
                                      for (const r of reactions) {
                                        const em = String(r.emoji);
                                        if (!grouped[em]) grouped[em] = { count: [], names: [], hasMe: false };
                                        grouped[em].count.push(String(r.user));
                                        const userObj = r.user as AnyRecord;
                                        const reactorName = String(r.userName ?? userObj?.name ?? "");
                                        if (reactorName) grouped[em].names.push(reactorName);
                                        if (String(userObj?._id ?? userObj?.id ?? r.user) === currentUserId) grouped[em].hasMe = true;
                                      }
                                      return Object.entries(grouped).map(([em, data]) => (
                                        <button
                                          key={em}
                                          onClick={() => handleReact(msgId, em)}
                                          title={`Reacted by ${data.names.length > 0 ? data.names.join(", ") : `${data.count.length} user(s)`}`}
                                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${ data.hasMe ? isMe ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700" : isMe ? "bg-white/10 text-white/70" : "bg-[var(--c-bg-muted)] text-slate-600" } hover:opacity-80`}
                                        >
                                          {em} {data.count.length}
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                )}

                                <p className={`mt-1.5 text-right text-[8px] font-medium leading-none ${isMe ? "text-white/60" : "text-slate-400"}`}>
                                  {time}
                                  {isMe ? (() => {
                                    const readAt = (msg as any).readAt;
                                    const receivedAt = (msg as any).receivedAt;
                                    if (readAt) {
                                      return <span className="ml-1 text-emerald-400 text-[9px]">✓✓</span>;
                                    }
                                    if (receivedAt) {
                                      return <span className="ml-1 text-white/50 text-[9px]">✓✓</span>;
                                    }
                                    return <span className="ml-1 text-white/50 text-[9px]">✓</span>;
                                  })() : null}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Send Input Box */}
              <div className="border-t border-[var(--c-border-light)] p-4">
                {pendingUpload && (
                  <div className="mb-2 rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-muted)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Paperclip size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate text-[10px] text-slate-600">{pendingUpload.file.name}</span>
                      <span className="shrink-0 text-[9px] text-slate-400">{formatFileSize(pendingUpload.file.size)}</span>
                      <button onClick={clearPendingUpload} className="shrink-0 ml-auto text-slate-400 hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    {pendingUpload.uploading && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: "50%" }} />
                      </div>
                    )}
                    {pendingUpload.error && (
                      <p className="mt-1 text-[9px] text-red-500">{pendingUpload.error}</p>
                    )}
                  </div>
                )}
                {replyingTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-[10px]">
                    <Reply size={12} className="text-sky-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sky-700">Replying to {String((replyingTo as any).senderName ?? (replyingTo as any).sender?.name ?? "someone")}</p>
                      <p className="truncate text-sky-500">{String((replyingTo as any).message ?? "")}</p>
                    </div>
                    <button onClick={cancelReply} className="shrink-0 text-sky-400 hover:text-sky-700 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex gap-2"
                >
                  <input ref={fileInputRef} type="file" accept="*/*" onChange={handleFileSelect} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!!pendingUpload}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors disabled:opacity-40"
                    title="Attach file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Type here your messages..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="neu-inset flex-1 rounded-xl px-4 py-2 text-[11px]"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || (!chatMessage.trim() && !pendingUpload?.result)}
                    className="neu-btn neu-btn-primary flex h-9 w-9 items-center justify-center rounded-xl"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>

            </div>
          ) : (
            /* Blank state */
            <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-[var(--c-bg-muted)]/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--c-bg-muted)] text-slate-400 shadow-inner">
                <Send size={24} />
              </div>
              <h4 className="mt-4 text-xs font-bold text-slate-800">Your Chat Board</h4>
              <p className="mt-1 text-xs text-slate-400 max-w-xs">
                Select a teammate on the left to start a conversation, use Groups for team chat, or Bulk Message to announce something.
              </p>
            </div>
          )}

          {/* User Info Modal */}
          {showInfoModal && selectedMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay" onClick={() => setShowInfoModal(false)}>
              <div
                className="relative w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700"
                >
                  <X size={15} />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--c-bg-hover)] font-semibold text-slate-700 text-lg">
                    {(selectedMember as any).avatarUrl ? (
                      <img
                        src={String((selectedMember as any).avatarUrl)}
                        alt={String((selectedMember as any).name)}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      getInitials(String((selectedMember as any).name ?? "Member"))
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900 capitalize">
                    {String((selectedMember as any).name)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {formatRoleWithCustom(String((selectedMember as any).role), (selectedMember as any).customRole, Boolean((selectedMember as any).isSeniorSecurity))}
                  </p>
                  {(selectedMember as any).isOnline ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
                    </span>
                  ) : (
                    <span className="mt-1 text-[10px] text-amber-600">
                      Last online: {formatLastOnline((selectedMember as any).lastOnline)}
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-3 border-t border-[var(--c-border-light)] pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email</span>
                    <span className="font-medium text-slate-800">{String((selectedMember as any).email)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone</span>
                    <span className="font-medium text-slate-800">
                      {(selectedMember as any).phone || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date of Birth</span>
                    <span className="font-medium text-slate-800">
                      {(selectedMember as any).dob
                        ? new Date((selectedMember as any).dob).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Employee ID</span>
                    <span className="font-medium text-slate-800">
                      {(selectedMember as any).companyIdentityCode || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Team</span>
                    <span className="font-medium text-slate-800">
                      {((selectedMember as any).team as any)?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Joined</span>
                    <span className="font-medium text-slate-800">
                      {(selectedMember as any).companyJoined
                        ? new Date((selectedMember as any).companyJoined).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group Info Modal */}
          {showInfoModal && selectedGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay" onClick={() => setShowInfoModal(false)}>
              <div
                className="relative w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700"
                >
                  <X size={15} />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <Users size={24} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">
                    {String(selectedGroup.name)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {Number(selectedGroup.memberCount ?? 0)} member{(Number(selectedGroup.memberCount ?? 0)) !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="mt-5 border-t border-[var(--c-border-light)] pt-4">
                  <p className="text-[10px] font-semibold uppercase text-slate-400 mb-3">Members</p>
                  <div className="space-y-2">
                    {((selectedGroup.members as AnyRecord[]) ?? []).map((member: AnyRecord) => (
                      <div key={String(member.id ?? "")} className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--c-bg-muted)]">
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--c-bg-hover)] text-[10px] font-semibold text-slate-700 overflow-hidden">
                          {member.avatarUrl ? (
                            <img src={String(member.avatarUrl)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            getInitials(String(member.name ?? ""))
                          )}
                          {Boolean(member.isOnline) && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-slate-900">
                            {String(member.name ?? "")}
                            {Boolean(member.isManager) && (
                              <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">Manager</span>
                            )}
                          </p>
                          <p className="truncate text-[9px] text-slate-400">
                            {formatRoleWithCustom(String(member.role ?? "employee"), (member as any).customRole, false)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message Info Modal */}
          {messageInfoMsg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay" onClick={() => setMessageInfoMsg(null)}>
              <div
                className="relative w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setMessageInfoMsg(null)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700"
                >
                  <X size={15} />
                </button>

                <h3 className="text-xs font-bold text-slate-900 mb-4">Message Info</h3>

                {/* Tab Buttons */}
                {(() => {
                  const infoSender = String((messageInfoMsg as any).sender?._id ?? (messageInfoMsg as any).sender ?? "");
                  const isOwnMessage = infoSender === currentUserId;
                  return (
                    <div className="flex gap-1 mb-4 bg-[var(--c-bg-muted)] rounded-lg p-0.5">
                      <button
                        onClick={() => setMessageInfoTab("reactions")}
                        className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${ messageInfoTab === "reactions" || !isOwnMessage ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-700" }`}
                      >
                        Reactions {((messageInfoMsg as any).reactions ?? []).length > 0 && `(${(messageInfoMsg as any).reactions.length})`}
                      </button>
                      {isOwnMessage && (
                        <button
                          onClick={() => setMessageInfoTab("seen")}
                          className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${ messageInfoTab === "seen" ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-700" }`}
                        >
                          Seen {((messageInfoMsg as any).groupReadBy ?? []).length > 0 && `(${(messageInfoMsg as any).groupReadBy.length})`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Reactions Tab */}
                {messageInfoTab === "reactions" && (() => {
                  const reactions: AnyRecord[] = (messageInfoMsg as any).reactions ?? [];
                  if (reactions.length === 0) {
                    return <p className="text-[11px] text-slate-400 text-center py-6 italic">No reactions yet</p>;
                  }
                  const grouped: Record<string, { emoji: string; users: { id: string; name: string }[] }> = {};
                  for (const r of reactions) {
                    const em = String(r.emoji);
                    if (!grouped[em]) grouped[em] = { emoji: em, users: [] };
                    const userObj = r.user as AnyRecord;
                    grouped[em].users.push({
                      id: String(userObj?.id ?? r.user ?? ""),
                      name: String(r.userName ?? userObj?.name ?? "Unknown"),
                    });
                  }
                  return (
                    <div className="space-y-2">
                      {Object.values(grouped).map((group) => (
                        <div key={group.emoji} className="rounded-lg border border-[var(--c-border-light)] p-2.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-base">{group.emoji}</span>
                            <span className="text-[10px] font-semibold text-slate-500">{group.users.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {group.users.map((u) => (
                              <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--c-bg-muted)] px-2 py-0.5 text-[9px] font-medium text-slate-700">
                                {u.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Seen Tab */}
                {messageInfoTab === "seen" && String((messageInfoMsg as any).sender?._id ?? (messageInfoMsg as any).sender ?? "") === currentUserId && (() => {
                  const readBy: AnyRecord[] = (messageInfoMsg as any).groupReadBy ?? [];
                  const members: AnyRecord[] = ((selectedGroup as any)?.members ?? []) as AnyRecord[];
                  const readUserIds = new Set(readBy.map((r: AnyRecord) => {
                    const u = r.user as AnyRecord;
                    return String(u?._id ?? u?.id ?? u ?? "");
                  }));
                  const readUsers = readBy.map((r: AnyRecord) => {
                    const u = r.user as AnyRecord;
                    return {
                      id: String(u?._id ?? u?.id ?? u ?? ""),
                      name: String(u?.name ?? "Unknown"),
                      readAt: (r as any).readAt ?? null,
                      read: true,
                    };
                  }).filter((u: AnyRecord) => u.id !== currentUserId).sort((a: AnyRecord, b: AnyRecord) => {
                    if (!a.readAt) return 1;
                    if (!b.readAt) return -1;
                    return new Date(String(a.readAt)).getTime() - new Date(String(b.readAt)).getTime();
                  });
                  const unreadUsers = members
                    .filter((m: AnyRecord) => String(m.id ?? m._id ?? "") !== currentUserId && !readUserIds.has(String(m.id ?? m._id ?? "")))
                    .map((m: AnyRecord) => ({
                      id: String(m.id ?? m._id ?? ""),
                      name: String(m.name ?? "Unknown"),
                      readAt: null,
                      read: false,
                    }));
                  const allUsers = [...readUsers, ...unreadUsers];

                  return (
                    <div className="space-y-1">
                      {allUsers.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-6 italic">No members</p>
                      ) : (
                        allUsers.map((u) => (
                          <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--c-bg-muted)]">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--c-bg-hover)] text-[9px] font-bold text-slate-600 overflow-hidden">
                              {getInitials(u.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-[11px] font-medium text-slate-900">{u.name}</p>
                            </div>
                            {u.read ? (
                              <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-semibold text-emerald-700">
                                Seen{u.readAt ? ` ${new Date(u.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                              </span>
                            ) : (
                              <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--c-bg-muted)] px-2 py-0.5 text-[8px] font-semibold text-slate-500">
                                Not seen yet
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay" onClick={() => { if (!deleting) setDeleteConfirm(null); }}>
              <div
                className="relative w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700 disabled:opacity-50"
                >
                  <X size={15} />
                </button>

                <h3 className="text-xs font-bold text-slate-900 mb-1">
                  {deleteConfirm.type === "single" ? "Delete message?" : `Delete ${deleteConfirm.messageIds.length} messages?`}
                </h3>
                <p className="text-[10px] text-slate-400 mb-4">
                  This will permanently delete
                  {deleteConfirm.type === "single" ? " this message" : ` these ${deleteConfirm.messageIds.length} messages`} for everyone.
                </p>

                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <p className="text-[10px] font-medium text-rose-700">
                    This action cannot be undone.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="rounded-full px-4 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-[var(--c-bg-muted)] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performDelete}
                    disabled={deleting}
                    className="neu-btn neu-btn-danger rounded-full px-4 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Forward Modal */}
          {showForwardModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay" onClick={() => setShowForwardModal(false)}>
              <div
                className="relative w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowForwardModal(false)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-700"
                >
                  <X size={15} />
                </button>

                <h3 className="text-xs font-bold text-slate-900 mb-1">Forward Message</h3>
                {forwardSource.length > 1 ? (
                  <p className="mb-4 text-[10px] text-slate-400">
                    {forwardSource.length} messages selected
                  </p>
                ) : (
                  <p className="truncate text-[10px] text-slate-400 mb-4">
                    {String((forwardSource as any)[0]?.message ?? "")}
                  </p>
                )}

                <div className="max-h-[45vh] overflow-y-auto space-y-1 pr-1">
                  {members
                    .filter((m) => String(m.id ?? m._id ?? "") !== currentUserId)
                    .map((member) => (
                      <button
                        key={String(member.id ?? member._id)}
                        onClick={() => {
                          setShowForwardModal(false);
                          handleSendForward(member);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${ forwardTarget && String(forwardTarget.id ?? forwardTarget._id) === String(member.id ?? member._id) ? "bg-sky-50" : "hover:bg-[var(--c-bg-muted)]" }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-bg-hover)] text-[10px] font-bold text-slate-600 overflow-hidden">
                          {(member as any).avatarUrl ? (
                            <img src={String((member as any).avatarUrl)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            getInitials(String((member as any).name ?? "Member"))
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-slate-800 capitalize">{String((member as any).name)}</p>
                          <p className="truncate text-[9px] text-slate-400">{formatRoleWithCustom(String((member as any).role ?? "employee"), (member as any).customRole, false)}</p>
                        </div>
                      </button>
                    ))}
                  {members.length === 0 && (
                    <p className="py-8 text-center text-[11px] text-slate-400 italic">No members available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
