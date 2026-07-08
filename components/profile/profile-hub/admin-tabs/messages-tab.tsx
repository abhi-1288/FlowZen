import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Search, Send, Users, Check, Info, X, Calendar, Clock, Video, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, formatRole, SectionHeader } from "../shared";

export function MessagesTab({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"normal" | "bulk" | "meeting">("normal");
  
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
  
  // Search State
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

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
    }
    window.addEventListener("messages:refresh", onRefresh);
    return () => window.removeEventListener("messages:refresh", onRefresh);
  }, [selectedMember]);

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
  }, [selectedMember]);

  // Scroll to bottom on conversation update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

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
    if (!recipientId || !text) return;
    try {
      setSendingChat(true);
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId, message: text }),
      });
      setChatMessage("");
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
      <SectionHeader title="Messages" description="Real-time company chat and announcements." accent="sky" />

      {/* Main chat window split grid */}
      <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 lg:grid-cols-12" style={{ height: "650px" }}>
        
        {/* Left Side Pane (Members / Channels) */}
        <div className="flex flex-col border-r border-slate-200 bg-slate-50 lg:col-span-4">
          
          {/* Header Action Mode Switchers */}
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${
                  mode === "normal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => {
                  setMode("normal");
                  setSelectedMember(null);
                }}
              >
                Messages
              </button>
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${
                  mode === "bulk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => {
                  setMode("bulk");
                  setSelectedMember(null);
                }}
              >
                Bulk Message
              </button>
              <button
                className={`flex-1 rounded-md py-2 text-center text-xs font-semibold transition-all ${
                  mode === "meeting" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => {
                  setMode("meeting");
                  setSelectedMember(null);
                }}
              >
                Schedule Meeting
              </button>
            </div>

            {/* Search Input Box */}
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearchQuery(searchInput);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>
              <button
                onClick={() => setSearchQuery(searchInput)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Go
              </button>
            </div>
          </div>

          {/* Members Scroll List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No members found.</div>
            ) : (
              filteredMembers.map((member) => {
                const memberId = String(member.id ?? member._id ?? "");
                const name = String(member.name ?? "Member");
                const role = formatRole(String(member.role ?? "employee"), Boolean((member as any).isSeniorSecurity));
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
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${
                      isSelected
                        ? mode === "bulk" || mode === "meeting"
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-950 shadow-sm ring-1 ring-slate-100"
                        : "hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    {/* Avatar Initials / Image */}
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 text-xs">
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
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`truncate text-xs font-semibold ${isSelected && (mode === "bulk" || mode === "meeting") ? "text-white" : "text-slate-900"}`}>
                          {name}
                        </p>
                        {/* Unread badge count next to username */}
                        {unread > 0 && mode === "normal" && (
                          <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className={`truncate text-[10px] ${isSelected && (mode === "bulk" || mode === "meeting") ? "text-slate-300" : "text-slate-400"}`}>
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
                            {(member.lastMessage as any).message}
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
        <div className="flex flex-col bg-white lg:col-span-8">
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

              <div className="mt-4 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50">
                {selectedBulkIds.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">No participants selected. Click users on the sidebar to add them.</span>
                ) : (
                  selectedBulkIds.map((id) => {
                    const memberObj = members.find((m) => String(m.id ?? m._id) === id);
                    if (!memberObj) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700">
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
                      placeholder="https://meet.google.com/... or Zoom/Teams link"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Location</label>
                    <input
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Duration</label>
                  <select
                    value={meetingDuration}
                    onChange={(e) => setMeetingDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
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
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
                    placeholder="Any additional details..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
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

                <div className="mt-4 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50">
                  {selectedBulkIds.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No users selected. Click users on the sidebar to add them.</span>
                  ) : (
                    selectedBulkIds.map((id) => {
                      const memberObj = members.find((m) => String(m.id ?? m._id) === id);
                      if (!memberObj) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700">
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
                  className="mt-4 h-48 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-slate-400 resize-none"
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
          ) : selectedMember ? (
            /* Active Conversation View */
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Active User Header */}
              <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 text-xs">
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
                    {formatRole(String(selectedMember.role), Boolean((selectedMember as any).isSeniorSecurity))} • {String(selectedMember.email)}
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
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  title="User info"
                >
                  <Info size={15} />
                </button>
              </div>

              {/* Chat Message History Scroll */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scrollbar-thin"
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

                      return (
                        <div key={String((msg as any)._id ?? index)} className="flex flex-col space-y-1">
                          {/* Date Header Separator */}
                          {showDateHeader && (
                            <div className="my-4 flex items-center justify-center">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-200/60 px-3 py-1 rounded-full">
                                {getMessageDateLabel(msgCreatedAt)}
                              </span>
                            </div>
                          )}

                          {/* Message Bubble Container */}
                          <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-xs ${
                                isMe
                                  ? "bg-slate-950 text-white rounded-tr-none"
                                  : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                              }`}
                            >
                              <p className="leading-relaxed break-words whitespace-pre-wrap">{String((msg as any).message ?? "")}</p>
                              {/* Message time tag inside the bubble */}
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
                      );
                    });
                  })()
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Send Input Box */}
              <div className="border-t border-slate-200 p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Type here your messages..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs outline-none focus:border-slate-400 focus:ring-0"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !chatMessage.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>

            </div>
          ) : (
            /* Blank state */
            <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-slate-50/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-inner">
                <Send size={24} />
              </div>
              <h4 className="mt-4 text-xs font-bold text-slate-800">Your Chat Board</h4>
              <p className="mt-1 text-xs text-slate-400 max-w-xs">
                Select a teammate on the left to start a conversation, or use Bulk Message to announce something.
              </p>
            </div>
          )}

          {/* User Info Modal */}
          {showInfoModal && selectedMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowInfoModal(false)}>
              <div
                className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={15} />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 text-lg">
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
                    {formatRole(String((selectedMember as any).role), Boolean((selectedMember as any).isSeniorSecurity))}
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

                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs">
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
        </div>

      </div>
    </section>
  );
}
