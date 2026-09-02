"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bolt,
  Brain,
  Crown,
  Gamepad2,
  Hash,
  Keyboard,
  Play,
  RefreshCw,
  Swords,
  Trophy,
  UserMinus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AvatarBadge, EmptyState, SectionHeader } from "./shared";

type GameInfo = { id: string; name: string; description: string; short: string; unit: string; lowerIsBetter: boolean };
type Member = { id: string; name: string; avatarUrl: string; role: string };
type LeaderboardRow = { user: Member; bestScore?: number; plays?: number; total?: number; games?: number };
type Challenge = {
  id: string;
  game: string;
  gameName: string;
  score: number;
  message: string;
  status: string;
  read: boolean;
  createdAt: string;
  from: Member;
  to: Member;
};

type GamesData = {
  catalog: GameInfo[];
  myScores: { game: string; bestScore: number; plays: number; bestAt: string | null }[];
  myOverall: number;
  myRankOverall: number | null;
  overall: LeaderboardRow[];
  perGame: Record<string, LeaderboardRow[]>;
  myPerGameRank: Record<string, number | null>;
  members: Member[];
};

const GAME_ICONS: Record<string, React.ReactNode> = {
  reaction: <Bolt size={20} />,
  memory: <Brain size={20} />,
  pattern: <Crown size={20} />,
  typing: <Keyboard size={20} />,
  number: <Hash size={20} />,
};

const WORK_WORDS = [
  "flow", "task", "board", "team", "focus", "build", "ship", "plan", "code", "data",
  "review", "launch", "grow", "drive", "shine", "track", "smart", "clear", "quick", "great",
  "teamwork", "product", "feature", "sprint", "design", "deploy", "measure", "improve", "iterate", "deliver",
  "quality", "impact", "insight", "momentum", "results", "together", "simplify", "optimize", "streamline", "collaborate",
];

type GameProps = { onComplete: (score: number) => void; onClose: () => void };

function formatScore(v: number | undefined | null) {
  return v == null ? "–" : Math.round(Number(v)).toLocaleString("en-IN");
}

export function GamesTab() {
  const [view, setView] = useState<"play" | "leaderboard" | "challenges">("play");
  const [data, setData] = useState<GamesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<{ incoming: Challenge[]; sent: Challenge[] }>({
    incoming: [],
    sent: [],
  });
  const [challengeTarget, setChallengeTarget] = useState<{
    game: string;
    score: number;
    memberId: string;
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function load() {
    try {
      const [g, c] = await Promise.all([
        apiFetch<GamesData>("/api/games"),
        apiFetch<{ incoming: Challenge[]; sent: Challenge[] }>("/api/games/challenges").catch(() => ({
          incoming: [],
          sent: [],
        })),
      ]);
      setData(g);
      setChallenges(c);
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : "Failed to load games.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function notify(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function submitScore(gameId: string, score: number) {
    if (score <= 0) return;
    try {
      const res = await apiFetch<{ ok: boolean; bestScore: number; isNewBest: boolean }>("/api/games/score", {
        method: "POST",
        body: JSON.stringify({ game: gameId, score }),
      });
      notify(res.isNewBest ? `New best: ${formatScore(res.bestScore)} 🎉` : `Score recorded (best ${formatScore(res.bestScore)})`);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to save score.", "error");
    }
  }

  async function sendChallenge() {
    if (!challengeTarget) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/games/challenge", {
        method: "POST",
        body: JSON.stringify({
          game: challengeTarget.game,
          to: challengeTarget.memberId,
          score: challengeTarget.score,
          message: challengeTarget.message,
        }),
      });
      notify(`Challenge sent to ${data?.members.find((m) => m.id === challengeTarget.memberId)?.name ?? "member"}.`);
      setChallengeTarget(null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to send challenge.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function respondChallenge(id: string, action: "accepted" | "declined" | "poke-back") {
    try {
      await apiFetch(`/api/games/challenge/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      notify(action === "accepted" ? "Challenge accepted." : action === "declined" ? "Challenge declined." : "Poke back sent.");
      const c = await apiFetch<{ incoming: Challenge[]; sent: Challenge[] }>("/api/games/challenges");
      setChallenges(c);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Action failed.", "error");
    }
  }

  const catalog = data?.catalog ?? [];
  const myBestByGame = new Map((data?.myScores ?? []).map((s) => [s.game, s.bestScore]));
  const rankByGame = data?.myPerGameRank ?? {};

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Games" description="Quick skill games, friendly competition, and a company leaderboard." accent="indigo" />
        <div className="animate-pulse grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="neu-card rounded-2xl p-5">
              <div className="h-5 w-32 rounded-md bg-slate-100 dark:bg-zinc-700" />
              <div className="mt-4 h-3.5 rounded-md bg-slate-50 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Games"
        description="Quick skill games, friendly competition, and a company leaderboard."
        accent="indigo"
        action={
          <div className="flex gap-1 rounded-full bg-[var(--c-bg-muted)] p-1">
            {(
              [
                ["play", "Play"],
                ["leaderboard", "Leaderboard"],
                ["challenges", "Challenges"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${view === key ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"}`}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {toast ? (
        <div className={`rounded-lg px-3 py-2 text-xs font-medium ${toast.type === "error" ? "bg-rose-50 text-rose-700 dark:bg-rose-950" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950"}`}>
          {toast.text}
        </div>
      ) : null}

      {view === "play" ? (
        <PlayView
          catalog={catalog}
          myBestByGame={myBestByGame}
          rankByGame={rankByGame}
          myOverall={data?.myOverall ?? 0}
          myRankOverall={data?.myRankOverall ?? null}
          onPlay={(id) => setActiveGame(id)}
          onChallenge={(game, score) => {
            if (!data) return;
            setChallengeTarget({ game, score, memberId: data.members[0]?.id ?? "", message: "" });
          }}
          hasMembers={(data?.members.length ?? 0) > 0}
        />
      ) : null}

      {view === "leaderboard" ? (
        <LeaderboardView data={data} />
      ) : null}

      {view === "challenges" ? (
        <ChallengesView challenges={challenges} onRespond={respondChallenge} />
      ) : null}

      {activeGame ? (
        <GameModal
          gameId={activeGame}
          catalog={catalog}
          onClose={() => setActiveGame(null)}
          onComplete={(score) => void submitScore(activeGame, score)}
        />
      ) : null}

      {challengeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-3">
          <div className="w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Challenge a teammate</h3>
            <p className="mb-4 text-xs text-slate-500">
              {catalog.find((g) => g.id === challengeTarget.game)?.name} · your best {formatScore(challengeTarget.score)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Choose teammate</label>
                <select
                  className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                  value={challengeTarget.memberId}
                  onChange={(e) => setChallengeTarget({ ...challengeTarget, memberId: e.target.value })}
                >
                  {(data?.members ?? []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Message (optional)</label>
                <input
                  className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                  placeholder="Beat my score!"
                  value={challengeTarget.message}
                  onChange={(e) => setChallengeTarget({ ...challengeTarget, message: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-[var(--c-bg-muted)]"
                onClick={() => setChallengeTarget(null)}
              >
                Cancel
              </button>
              <ActionButton variant="primary" className="px-4" disabled={submitting || !challengeTarget.memberId}
                onClick={() => void sendChallenge()}>
                {submitting ? "Sending..." : "Send Challenge"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayView({
  catalog,
  myBestByGame,
  rankByGame,
  myOverall,
  myRankOverall,
  onPlay,
  onChallenge,
  hasMembers,
}: {
  catalog: GameInfo[];
  myBestByGame: Map<string, number>;
  rankByGame: Record<string, number | null>;
  myOverall: number;
  myRankOverall: number | null;
  onPlay: (id: string) => void;
  onChallenge: (game: string, score: number) => void;
  hasMembers: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="neu-card rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Overall Score</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{formatScore(myOverall)}</p>
        </div>
        <div className="neu-card rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Overall Rank</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{myRankOverall ? `#${myRankOverall}` : "–"}</p>
        </div>
        <div className="neu-card rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Games Played</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{myBestByGame.size}</p>
        </div>
        <div className="neu-card rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Teammates</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{hasMembers ? "Pick a rival" : "Just you!"}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((game) => {
          const best = myBestByGame.get(game.id);
          const rank = rankByGame[game.id];
          return (
            <div key={game.id} className="neu-card neu-card-hover rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                  {GAME_ICONS[game.id] ?? <Gamepad2 size={20} />}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{game.name}</h4>
                  <p className="text-xs text-slate-400">
                    Best {formatScore(best)} · Rank {rank ? `#${rank}` : "–"}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-xs text-slate-500">{game.description}</p>
              <div className="mt-4 flex gap-2">
                <ActionButton variant="primary" className="flex-1" onClick={() => onPlay(game.id)}>
                  <Play size={14} /> Play
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  className="px-3"
                  disabled={!hasMembers}
                  title={hasMembers ? `Challenge a teammate on ${game.name}` : "No teammates to challenge"}
                  onClick={() => onChallenge(game.id, best ?? 0)}
                >
                  <Swords size={14} />
                </ActionButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardView({ data }: { data: GamesData | null }) {
  const [gameId, setGameId] = useState<string>("overall");
  if (!data) return <EmptyState message="No data yet." />;

  const overall = data.overall;
  const perGame = data.perGame[gameId] ?? [];
  const rows = gameId === "overall" ? overall : perGame;
  const unit = gameId === "overall" ? "pts" : (data.catalog.find((g) => g.id === gameId)?.unit ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-full bg-[var(--c-bg-muted)] p-1 w-fit">
        <button type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${gameId === "overall" ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"}`}
          onClick={() => setGameId("overall")}>
          Overall
        </button>
        {data.catalog.map((g) => (
          <button key={g.id} type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${gameId === g.id ? "neu-tab-pressed" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"}`}
            onClick={() => setGameId(g.id)}>
            {g.short}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No scores yet. Be the first to play!" icon={<Trophy size={28} />} />
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
            const value = gameId === "overall" ? row.total : row.bestScore;
            return (
              <div key={row.user.id} className="flex items-center gap-3 rounded-2xl neu-card px-4 py-3">
                <span className="w-10 text-center text-sm font-bold text-slate-700">{medal}</span>
                <AvatarBadge avatarUrl={row.user.avatarUrl} name={row.user.name} size="md" />
                <span className="flex-1 truncate text-sm font-medium text-slate-800">{row.user.name}</span>
                <span className="text-xs text-slate-400">{gameId === "overall" ? `${row.games ?? 0} games` : `${row.plays ?? 0} plays`}</span>
                <span className="text-sm font-bold text-indigo-600">{formatScore(value)} {unit}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChallengesView({ challenges, onRespond }: {
  challenges: { incoming: Challenge[]; sent: Challenge[] };
  onRespond: (id: string, action: "accepted" | "declined" | "poke-back") => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader title="Incoming" description="Challenges sent to you." accent="indigo" />
        <div className="mt-3 space-y-2">
          {challenges.incoming.length === 0 ? <EmptyState message="No incoming challenges." icon={<Swords size={24} />} /> : null}
          {challenges.incoming.filter((c) => c.status === "pending").map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl neu-card px-4 py-3">
              <AvatarBadge avatarUrl={c.from.avatarUrl} name={c.from.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  <strong>{c.from.name}</strong> challenged you on <strong>{c.gameName}</strong>
                </p>
                <p className="text-xs text-slate-400">Score to beat: {formatScore(c.score)}{c.message ? ` · “${c.message}”` : ""}</p>
              </div>
              <div className="flex gap-2">
                <ActionButton variant="approve" className="px-3" onClick={() => onRespond(c.id, "accepted")}>
                  Accept
                </ActionButton>
                <ActionButton variant="secondary" className="px-3" onClick={() => onRespond(c.id, "poke-back")}>
                  Poke back
                </ActionButton>
                <ActionButton variant="ghost" className="px-2" onClick={() => onRespond(c.id, "declined")}>
                  <UserMinus size={14} />
                </ActionButton>
              </div>
            </div>
          ))}
          {challenges.incoming.filter((c) => c.status !== "pending").length > 0 ? (
            <p className="px-1 pt-1 text-[11px] text-slate-400">
              {challenges.incoming.filter((c) => c.status !== "pending").length} resolved challenge(s).
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <SectionHeader title="Sent" description="Challenges you have thrown down." accent="indigo" />
        <div className="mt-3 space-y-2">
          {challenges.sent.length === 0 ? <EmptyState message="You have not sent any challenges." icon={<UsersIcon size={24} />} /> : null}
          {challenges.sent.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl neu-card px-4 py-3">
              <AvatarBadge avatarUrl={c.to.avatarUrl} name={c.to.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">You challenged <strong>{c.to.name}</strong> on <strong>{c.gameName}</strong></p>
                <p className="text-xs capitalize text-slate-400">Status: {c.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameModal({ gameId, catalog, onClose, onComplete }: {
  gameId: string;
  catalog: GameInfo[];
  onClose: () => void;
  onComplete: (score: number) => void;
}) {
  const game = catalog.find((g) => g.id === gameId);
  const scored = useRef(false);
  const [resetKey, setResetKey] = useState(0);

  function handleComplete(score: number) {
    if (scored.current) return;
    scored.current = true;
    onComplete(score);
  }

  function renderGame() {
    switch (gameId) {
      case "reaction":
        return <ReactionGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      case "memory":
        return <MemoryGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      case "pattern":
        return <PatternGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      case "typing":
        return <TypingGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      case "number":
        return <NumberGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      default:
        return <EmptyState message="Unknown game." />;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-3">
      <div className="w-full max-w-lg rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              {GAME_ICONS[gameId] ?? <Gamepad2 size={18} />}
            </span>
            <h3 className="text-sm font-semibold text-slate-800">{game?.name ?? "Game"}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button type="button"
              className="rounded-md p-1.5 text-slate-400 hover:bg-[var(--c-bg-muted)]"
              onClick={() => { scored.current = false; setResetKey((k) => k + 1); }}
              title="Restart">
              <RefreshCw size={16} />
            </button>
            <button type="button"
              className="rounded-md p-1.5 text-slate-400 hover:bg-[var(--c-bg-muted)]"
              onClick={onClose}
              title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        {renderGame()}
      </div>
    </div>
  );
}

// ── Reaction Time ──
function ReactionGame({ onComplete, onClose }: GameProps) {
  const [phase, setPhase] = useState<"idle" | "wait" | "go" | "done">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  function begin() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setTimes([]);
    setRound(1);
    doneRef.current = false;
    setPhase("wait");
    timerRef.current = window.setTimeout(() => {
      startRef.current = Date.now();
      setPhase("go");
    }, 1300 + Math.random() * 2400);
  }

  function handleClick() {
    if (phase === "idle" || phase === "done") {
      begin();
      return;
    }
    if (phase === "wait") {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      begin();
      return;
    }
    if (phase === "go" && startRef.current) {
      const ms = Date.now() - startRef.current;
      const nextTimes = [...times, ms];
      setTimes(nextTimes);
      if (round >= 3) {
        setPhase("done");
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete(Math.round(Math.min(...nextTimes)));
        }
      } else {
        setRound((r) => r + 1);
        setPhase("wait");
        timerRef.current = window.setTimeout(() => {
          startRef.current = Date.now();
          setPhase("go");
        }, 1300 + Math.random() * 2400);
      }
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Tap when the screen turns green. Best of {round} / 3 rounds. Faster is better.
      </p>
      <button
        type="button"
        onClick={handleClick}
        className={`flex h-40 w-full items-center justify-center rounded-xl text-lg font-bold transition ${
          phase === "go"
            ? "bg-emerald-500 text-white"
            : phase === "wait"
              ? "bg-rose-500 text-white"
              : "bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400"
        }`}
      >
        {phase === "go" ? "TAP NOW!" : phase === "wait" ? "Wait for green..." : phase === "done" ? "Tap to play again" : "Tap to start"}
      </button>
    </div>
  );
}

// ── Memory Match ──
function MemoryGame({ onComplete, onClose }: GameProps) {
  const symbols = ["🎯", "🚀", "⭐", "🎲", "🍕", "🎵"];
  const [cards, setCards] = useState<{ id: number; sym: string; flipped: boolean; matched: boolean }[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [first, setFirst] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  function shuffle() {
    const deck = [...symbols, ...symbols]
      .map((sym, i) => ({ id: i, sym, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5);
    setCards(deck);
    setMoves(0);
    setFirst(null);
    setLocked(false);
    setDone(false);
  }

  useEffect(() => { shuffle(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function flip(id: number) {
    if (locked || done) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    const next = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    setCards(next);
    if (first === null) {
      setFirst(id);
      return;
    }
    const a = next.find((c) => c.id === first);
    const b = next.find((c) => c.id === id);
    setMoves((m) => m + 1);
    setLocked(true);
    window.setTimeout(() => {
      if (a && b && a.sym === b.sym) {
        const updated = next.map((c) => (c.id === first || c.id === id ? { ...c, matched: true } : c));
        setCards(updated);
        if (updated.every((c) => c.matched)) {
          setDone(true);
          const score = Math.max(0, 1000 - (moves + 1 - 6) * 40);
          onComplete(score);
        }
      } else {
        setCards(next.map((c) => (c.id === first || c.id === id ? { ...c, flipped: false } : c)));
      }
      setFirst(null);
      setLocked(false);
    }, 650);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Match all 6 pairs. Fewer moves = higher score.</p>
        <span className="text-sm font-bold text-indigo-600">{moves} moves</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => flip(card.id)}
            className={`flex h-16 items-center justify-center rounded-lg text-2xl transition ${card.matched ? "bg-emerald-50 dark:bg-emerald-950" : card.flipped ? "bg-indigo-50 dark:bg-indigo-950" : "neu-inset bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700"}`}
          >
            {card.flipped || card.matched ? card.sym : ""}
          </button>
        ))}
      </div>
      {done ? (
        <p className="text-center text-xs font-medium text-emerald-600">All matched! Score saved.</p>
      ) : null}
    </div>
  );
}

// ── Pattern Sequence ──
const PATTERN_MAX = 30;
function PatternGame({ onComplete, onClose }: GameProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerTurn, setPlayerTurn] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<number[]>([]);
  const seqRef = useRef<number[]>([]);
  const doneRef = useRef(false);

  function playSequence(seq: number[]) {
    setPlayerTurn(false);
    setPlaying(true);
    seq.forEach((cell, i) => {
      window.setTimeout(() => {
        setActiveCell(cell);
        window.setTimeout(() => setActiveCell(null), 380);
        if (i === seq.length - 1) {
          window.setTimeout(() => {
            setPlaying(false);
            setPlayerTurn(true);
            inputRef.current = [];
          }, 440);
        }
      }, i * 650);
    });
  }

  useEffect(() => {
    seqRef.current = [Math.floor(Math.random() * 4)];
    setSequence([...seqRef.current]);
    playSequence(seqRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(rounds: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    setOver(true);
    onComplete(rounds * 100);
  }

  function tap(cell: number) {
    if (!playerTurn || playing || over) return;
    inputRef.current.push(cell);
    setActiveCell(cell);
    window.setTimeout(() => setActiveCell(null), 200);
    const i = inputRef.current.length - 1;
    if (cell !== seqRef.current[i]) {
      finish(seqRef.current.length);
      return;
    }
    if (inputRef.current.length === seqRef.current.length) {
      if (seqRef.current.length >= PATTERN_MAX) {
        finish(PATTERN_MAX);
        return;
      }
      const nextSeq = [...seqRef.current, Math.floor(Math.random() * 4)];
      seqRef.current = nextSeq;
      setSequence([...nextSeq]);
      playSequence(nextSeq);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Round {sequence.length} · {over ? <span className="text-rose-500">Game over</span> : playerTurn ? <span>Repeat the pattern</span> : <span>Watch the pattern</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((cell) => (
          <button
            key={cell}
            type="button"
            onClick={() => tap(cell)}
            className={`h-24 rounded-xl text-2xl transition ${activeCell === cell ? "bg-indigo-500 text-white" : "neu-inset bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700"}`}
          >
            {cell + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Typing Speed ──
function TypingGame({ onComplete, onClose }: GameProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [word, setWord] = useState("");
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const doneRef = useRef(false);

  function nextWord() {
    setWord(WORK_WORDS[Math.floor(Math.random() * WORK_WORDS.length)]);
    setInput("");
  }

  useEffect(() => {
    if (!started || finished) return;
    const t = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          if (!doneRef.current) {
            doneRef.current = true;
            setFinished(true);
            onComplete(correct);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!started) { setStarted(true); nextWord(); setWord(WORK_WORDS[Math.floor(Math.random() * WORK_WORDS.length)]); }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (input.trim() === word) setCorrect((c) => c + 1);
      nextWord();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Type the words. 30 seconds. Go fast!</p>
        <span className={`text-lg font-bold ${timeLeft <= 5 ? "text-rose-500" : "text-indigo-600"}`}>{timeLeft}s</span>
      </div>
      <div className="rounded-xl bg-slate-50 py-6 text-center text-2xl font-bold text-slate-800 dark:bg-zinc-700 dark:text-zinc-200">
        {word || "Press start and type!"}
      </div>
      <input
        autoFocus
        className="neu-inset w-full rounded-md px-3 py-2 text-sm"
        placeholder="Type here + space"
        disabled={finished}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p className="text-center text-sm font-medium text-slate-700">Correct words: {correct}</p>
    </div>
  );
}

// ── Number Guessing ──
function NumberGame({ onComplete, onClose }: GameProps) {
  const [target] = useState(() => Math.floor(Math.random() * 100) + 1);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("");
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = Number(guess);
    if (!g) return;
    const a = attempts + 1;
    setAttempts(a);
    if (g === target) {
      if (doneRef.current) return;
      doneRef.current = true;
      setDone(true);
      const score = Math.max(0, 1000 - (a - 1) * 60);
      setHint(`Got it in ${a} guesses!`);
      onComplete(score);
    } else {
      setHint(g < target ? "Too low 📉" : "Too high 📈");
      setGuess("");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Guess the number between 1 and 100. Fewer guesses = more points.</p>
      <div className="rounded-xl bg-slate-50 py-8 text-center dark:bg-zinc-700">
        <p className="text-3xl font-bold text-slate-800">{done ? target : "?"}</p>
        {hint ? <p className="mt-2 text-sm font-medium text-indigo-600">{hint}</p> : null}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="number"
          min={1}
          max={100}
          className="neu-inset w-full rounded-md px-3 py-2 text-sm"
          placeholder="Your guess"
          disabled={done}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
        />
        <ActionButton type="submit" variant="primary" className="px-4" disabled={done}>Guess</ActionButton>
      </form>
      <p className="text-center text-xs text-slate-400">Attempts: {attempts}</p>
    </div>
  );
}
