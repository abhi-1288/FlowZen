"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bolt,
  Brain,
  Crown,
  Dices,
  Gamepad2,
  Hash,
  Keyboard,
  Play,
  Puzzle,
  RefreshCw,
  Swords,
  Trophy,
  UserMinus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { Chess } from "chess.js";
import { motion } from "framer-motion";
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
  word: <Puzzle size={20} />,
  "snakes-ladders": <Dices size={20} />,
  chess: <Crown size={20} />,
};

const WORK_WORDS = [
  "flow", "task", "board", "team", "focus", "build", "ship", "plan", "code", "data",
  "review", "launch", "grow", "drive", "shine", "track", "smart", "clear", "quick", "great",
  "teamwork", "product", "feature", "sprint", "design", "deploy", "measure", "improve", "iterate", "deliver",
  "quality", "impact", "insight", "momentum", "results", "together", "simplify", "optimize", "streamline", "collaborate",
];

type GameProps = { onComplete: (score: number) => void; onClose: () => void };

function formatScore(v: number | undefined | null) {
  return v == null ? "â€“" : Math.round(Number(v)).toLocaleString("en-IN");
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
    if (!Number.isFinite(score) || score < 0) return;
    try {
      const res = await apiFetch<{ ok: boolean; bestScore: number; isNewBest: boolean }>("/api/games/score", {
        method: "POST",
        body: JSON.stringify({ game: gameId, score }),
      });
      notify(res.isNewBest ? `New best: ${formatScore(res.bestScore)} ðŸŽ‰` : `Score recorded (best ${formatScore(res.bestScore)})`);
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
              {catalog.find((g) => g.id === challengeTarget.game)?.name} Â· your best {formatScore(challengeTarget.score)}
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
          <p className="mt-1 text-2xl font-bold text-slate-800">{myRankOverall ? `#${myRankOverall}` : "â€“"}</p>
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
                    Best {formatScore(best)} Â· Rank {rank ? `#${rank}` : "â€“"}
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
            const medal = index === 0 ? "ðŸ¥‡" : index === 1 ? "ðŸ¥ˆ" : index === 2 ? "ðŸ¥‰" : `#${index + 1}`;
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
                <p className="text-xs text-slate-400">Score to beat: {formatScore(c.score)}{c.message ? ` Â· â€œ${c.message}â€` : ""}</p>
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
      case "word":
        return <WordGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      case "snakes-ladders":
        return <SnakeLaddersGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
      case "chess":
        return <ChessGame key={`${gameId}-${resetKey}`} onComplete={handleComplete} onClose={onClose} />;
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

// â”€â”€ Reaction Time â”€â”€
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

// â”€â”€ Memory Match â”€â”€
function MemoryGame({ onComplete, onClose }: GameProps) {
  const symbols = ["ðŸŽ¯", "ðŸš€", "â­", "ðŸŽ²", "ðŸ•", "ðŸŽµ"];
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

// â”€â”€ Pattern Sequence â”€â”€
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
        Round {sequence.length} Â· {over ? <span className="text-rose-500">Game over</span> : playerTurn ? <span>Repeat the pattern</span> : <span>Watch the pattern</span>}
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

// â”€â”€ Typing Speed â”€â”€
function TypingGame({ onComplete, onClose }: GameProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [word, setWord] = useState("");
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const doneRef = useRef(false);
  const scoreRef = useRef(0);

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
              onComplete(scoreRef.current);
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
    if (!started) { setStarted(true); scoreRef.current = 0; setCorrect(0); setFinished(false); nextWord(); setWord(WORK_WORDS[Math.floor(Math.random() * WORK_WORDS.length)]); }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (input.trim() === word) {
        setCorrect((c) => {
          const next = c + 1;
          scoreRef.current = next;
          return next;
        });
      }
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

// â”€â”€ Number Guessing â”€â”€
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
      setHint(g < target ? "Too low ðŸ“‰" : "Too high ðŸ“ˆ");
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
// â”€â”€ Word Scramble â”€â”€
function scrambleWord(word: string) {
  const letters = word.split("");
  let scrambled = word;
  let guard = 0;
  while (scrambled === word && guard < 10 && word.length > 1) {
    for (let i = letters.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    scrambled = letters.join("");
    guard += 1;
  }
  return scrambled;
}

function WordGame({ onComplete, onClose }: GameProps) {
  const [timeLeft, setTimeLeft] = useState(60);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [word, setWord] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const doneRef = useRef(false);
  const scoreRef = useRef(0);

  function nextWord() {
    const pick = WORK_WORDS[Math.floor(Math.random() * WORK_WORDS.length)];
    setWord(pick);
    setScrambled(scrambleWord(pick));
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
            onComplete(scoreRef.current);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [started, finished, onComplete]);

  function handleStart() {
    setStarted(true);
    setFinished(false);
    setTimeLeft(60);
    scoreRef.current = 0;
    setScore(0);
    doneRef.current = false;
    nextWord();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!started || finished || !word) return;
    if (input.trim().toLowerCase() === word.toLowerCase()) {
      const next = score + 1;
      scoreRef.current = next;
      setScore(next);
    }
    nextWord();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Unscramble the word. 60 seconds. Go!</p>
        <span className={`text-lg font-bold ${timeLeft <= 5 ? "text-rose-500" : "text-indigo-600"}`}>{timeLeft}s</span>
      </div>
      {!started ? (
        <button
          type="button"
          className="flex h-24 w-full items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700 dark:bg-zinc-700 dark:text-zinc-200"
          onClick={handleStart}
        >
          Tap to start
        </button>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 py-6 text-center text-2xl font-bold tracking-[0.35em] text-slate-800 dark:bg-zinc-700 dark:text-zinc-200">
            {scrambled.toUpperCase()}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              autoFocus
              className="neu-inset w-full rounded-md px-3 py-2 text-sm"
              placeholder="Type the word"
              disabled={finished}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <ActionButton type="submit" variant="primary" className="px-4" disabled={finished}>
              Check
            </ActionButton>
          </form>
          <p className="text-center text-sm font-medium text-slate-700">Correct words: {score}</p>
          {finished ? <p className="text-center text-xs font-medium text-emerald-600">Time up! Score saved.</p> : null}
        </>
      )}
    </div>
  );
}// SnakeAndLaddersGame
const SNAKE_MAP: Record<number, number> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

const LADDER_MAP: Record<number, number> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

function tileCenter(n: number) {
  const rowBottom = Math.floor((n - 1) / 10);
  const col = rowBottom % 2 === 0 ? (n - 1) % 10 : 9 - ((n - 1) % 10);
  const displayRow = 9 - rowBottom;
  return { x: (col + 0.5) * 10, y: (displayRow + 0.5) * 10 };
}

function SnakeLaddersGame({ onComplete, onClose }: GameProps) {
  const [position, setPosition] = useState(1);
  const [turns, setTurns] = useState(0);
  const [lastRoll, setLastRoll] = useState(0);
  const [message, setMessage] = useState("Roll the dice to begin.");
  const [done, setDone] = useState(false);
  const [animating, setAnimating] = useState(false);
  const doneRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function roll() {
    if (done || animating) return;
    clearTimers();
    const dice = 1 + Math.floor(Math.random() * 6);
    setLastRoll(dice);
    setAnimating(true);

    let target = position + dice;
    if (target > 100) target = position;

    const steps: number[] = [];
    if (target !== position) {
      for (let tile = position + 1; tile <= target; tile += 1) steps.push(tile);
    }

    let destination = target;
    if (LADDER_MAP[target]) destination = LADDER_MAP[target];
    else if (SNAKE_MAP[target]) destination = SNAKE_MAP[target];

    const moveCount = turns + 1;
    const stepDelay = 260;
    steps.forEach((tile, index) => {
      const timer = window.setTimeout(() => setPosition(tile), stepDelay * (index + 1));
      timersRef.current.push(timer);
    });

    const jumpDelay = stepDelay * steps.length;
    if (destination !== target && target <= 100) {
      const jumpTimer = window.setTimeout(() => setPosition(destination), jumpDelay + 420);
      timersRef.current.push(jumpTimer);
    }

    const finalizeDelay = jumpDelay + (destination !== target ? 700 : 300);
    const finalizeTimer = window.setTimeout(() => {
      setTurns(moveCount);
      if (target === position) {
        setMessage(`Rolled ${dice} - need an exact roll.`);
      } else if (destination === LADDER_MAP[target]) {
        setMessage(`Rolled ${dice} - climbed a ladder to ${destination}!`);
      } else if (destination === SNAKE_MAP[target]) {
        setMessage(`Rolled ${dice} - slid down a snake to ${destination}!`);
      } else {
        setMessage(`Rolled ${dice} - moved to ${destination}.`);
      }

      if (destination >= 100 && !doneRef.current) {
        doneRef.current = true;
        setDone(true);
        const score = Math.max(100, 1000 - moveCount * 15);
        setMessage(`Reached tile 100 in ${moveCount} moves!`);
        onComplete(score);
      }
      setAnimating(false);
    }, finalizeDelay);
    timersRef.current.push(finalizeTimer);
  }

  function reset() {
    clearTimers();
    setPosition(1);
    setTurns(0);
    setLastRoll(0);
    setMessage("Roll the dice to begin.");
    setDone(false);
    setAnimating(false);
    doneRef.current = false;
  }

  const boardRows: number[][] = [];
  for (let actualRow = 9; actualRow >= 0; actualRow -= 1) {
    const row: number[] = [];
    for (let c = 0; c < 10; c += 1) {
      const col = actualRow % 2 === 0 ? c : 9 - c;
      row.push(actualRow * 10 + col + 1);
    }
    boardRows.push(row);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Single-player race to tile 100. Roll the dice, climb ladders, dodge snakes.
      </p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="neu-inset rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Tile</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{position}</p>
        </div>
        <div className="neu-inset rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Dice</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{lastRoll || "-"}</p>
        </div>
        <div className="neu-inset rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Moves</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{turns}</p>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-[var(--c-border-light)] bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-inner dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
        <div className="grid h-full w-full grid-cols-10 grid-rows-10">
          {boardRows.flat().map((tile) => {
            const hasSnake = SNAKE_MAP[tile];
            const hasLadder = LADDER_MAP[tile];
            return (
              <div
                key={tile}
                className={`relative flex items-center justify-center border border-[var(--c-border-light)] text-[10px] font-semibold ${
                  tile === 100
                    ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                    : tile === 1
                      ? "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                      : "bg-white/70 text-slate-700 dark:bg-zinc-900/70 dark:text-zinc-200"
                }`}
              >
                <span className="absolute left-1 top-0.5 text-[8px] text-slate-400 dark:text-zinc-500">{tile}</span>
                {hasSnake ? <span className="text-base leading-none" title={`Snake to ${hasSnake}`}>🐍</span> : null}
                {hasLadder ? <span className="text-base leading-none" title={`Ladder to ${hasLadder}`}>🪜</span> : null}
                {position === tile ? (
                  <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white shadow">
                    P
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {Object.entries(LADDER_MAP).map(([start, end]) => {
            const a = tileCenter(Number(start));
            const b = tileCenter(Number(end));
            return (
              <line
                key={`ladder-${start}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#16a34a"
                strokeWidth="1.6"
                strokeDasharray="3 1.5"
                strokeLinecap="round"
                opacity="0.9"
              />
            );
          })}
          {Object.entries(SNAKE_MAP).map(([start, end]) => {
            const a = tileCenter(Number(start));
            const b = tileCenter(Number(end));
            const cx = (a.x + b.x) / 2 + (a.y - b.y) * 0.18;
            const cy = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
            return (
              <path
                key={`snake-${start}`}
                d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                fill="none"
                stroke="#dc2626"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.85"
              />
            );
          })}
        </svg>
      </div>

      <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-200">{message}</p>
      <div className="flex gap-2">
        <ActionButton variant="primary" className="flex-1" disabled={done || animating} onClick={roll}>
          <Dices size={14} /> {animating ? "Moving..." : "Roll dice"}
        </ActionButton>
        <ActionButton variant="secondary" className="px-3" onClick={reset}>
          <RefreshCw size={14} />
        </ActionButton>
      </div>
      {done ? <p className="text-center text-xs font-medium text-emerald-600">You made it! Score saved.</p> : null}
    </div>
  );
}
function squareToCoords(square: string) {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - Number(square[1]);
  return { x: file * 12.5, y: rank * 12.5 };
}

function pieceSymbol(piece: { type: string; color: string }) {
  const white: Record<string, string> = { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" };
  const black: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
  return (piece.color === "w" ? white : black)[piece.type] ?? "";
}

function evaluateChess(chess: Chess) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  let score = 0;
  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = values[piece.type] ?? 0;
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || chess.isGameOver()) return evaluateChess(chess);
  const moves = chess.moves({ verbose: true }) as { from: string; to: string }[];
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    chess.move(move);
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
    chess.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function bestChessMove(chess: Chess, color: "w" | "b", depth: number) {
  const maximizing = color === "w";
  const moves = chess.moves({ verbose: true }) as { from: string; to: string }[];
  if (!moves.length) return null;
  let chosen = moves[0];
  let bestValue = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    chess.move(move);
    const value = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();
    if (maximizing ? value > bestValue : value < bestValue) {
      bestValue = value;
      chosen = move;
    }
  }
  return chosen;
}

function ChessGame({ onComplete, onClose }: GameProps) {
  const game = useRef(new Chess()).current;
  const [fen, setFen] = useState(game.fen());
  const [mode, setMode] = useState<"ai" | "local">("ai");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const aiColor: "w" | "b" = playerColor === "w" ? "b" : "w";
  const [selected, setSelected] = useState<string | null>(null);
  const [legal, setLegal] = useState<Set<string>>(new Set());
  const [animation, setAnimation] = useState<{ piece: string; from: { x: number; y: number }; to: { x: number; y: number }; toSquare: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Your move");
  const [done, setDone] = useState(false);
  const [depth, setDepth] = useState(3);
  const doneRef = useRef(false);
  const aiTimer = useRef<number | null>(null);
  const animTimer = useRef<number | null>(null);

  function reset() {
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    if (animTimer.current) window.clearTimeout(animTimer.current);
    game.reset();
    setFen(game.fen());
    setSelected(null);
    setLegal(new Set());
    setAnimation(null);
    setBusy(false);
    setMessage(mode === "ai" ? "Your move" : "White to move");
    setDone(false);
    doneRef.current = false;
  }

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, playerColor]);

  function finishIfOver() {
    if (doneRef.current || !game.isGameOver()) return;
    doneRef.current = true;
    setDone(true);
    if (game.isCheckmate()) {
      const loser = game.turn();
      const winner = loser === "w" ? "b" : "w";
      const text = `${winner === "w" ? "White" : "Black"} wins by checkmate`;
      setMessage(text);
      if (mode === "ai") {
        onComplete(winner === playerColor ? 100 : 0);
      } else {
        onComplete(0);
      }
    } else if (game.isStalemate()) {
      setMessage("Draw by stalemate");
      onComplete(mode === "ai" ? 50 : 0);
    } else {
      setMessage("Game over");
      onComplete(mode === "ai" ? 50 : 0);
    }
  }

  function finishAnimatedMove() {
    setAnimation(null);
    setBusy(false);
    setSelected(null);
    setLegal(new Set());
    setFen(game.fen());
    if (!game.isGameOver()) {
      setMessage(mode === "ai" && game.turn() === playerColor ? "Your move" : mode === "ai" ? "AI thinking..." : `${game.turn() === "w" ? "White" : "Black"} to move`);
    }
    finishIfOver();
  }

  function makeHumanMove(from: string, to: string) {
    if (done || busy || animation) return;
    if (mode === "ai" && game.turn() !== playerColor) return;
    const move = game.move({ from, to, promotion: "q" });
    if (!move) return;
    clearSelection();
    const piece = pieceSymbol({ type: move.piece, color: move.color });
    const fromCoords = squareToCoords(move.from);
    const toCoords = squareToCoords(move.to);
    setBusy(true);
    setAnimation({ piece, from: fromCoords, to: toCoords, toSquare: move.to });
    if (animTimer.current) window.clearTimeout(animTimer.current);
    animTimer.current = window.setTimeout(() => {
      finishAnimatedMove();
      if (mode === "ai" && !game.isGameOver() && game.turn() === aiColor) {
        triggerAI();
      }
    }, 360);
  }

  function clearSelection() {
    setSelected(null);
    setLegal(new Set());
  }

  function handleClick(square: string) {
    if (done || busy || animation) return;
    if (mode === "ai" && game.turn() !== playerColor) return;
    if (!selected) {
      const piece = game.get(square as never);
      if (!piece) return;
      if (mode === "ai" && piece.color !== playerColor) return;
      if (mode === "local" && piece.color !== game.turn()) return;
      setSelected(square);
      const targets = game.moves({ square: square as never, verbose: true }).map((m: { to: string }) => m.to);
      setLegal(new Set(targets));
      return;
    }
    if (square === selected) {
      clearSelection();
      return;
    }
    if (legal.has(square)) {
      makeHumanMove(selected, square);
      return;
    }
    const piece = game.get(square as never);
    if (piece && (mode === "local" ? piece.color === game.turn() : piece.color === playerColor)) {
      setSelected(square);
      const targets = game.moves({ square: square as never, verbose: true }).map((m: { to: string }) => m.to);
      setLegal(new Set(targets));
    } else {
      clearSelection();
    }
  }

  function triggerAI() {
    if (mode !== "ai" || done || game.isGameOver() || game.turn() !== aiColor) return;
    setBusy(true);
    setMessage("AI thinking...");
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    aiTimer.current = window.setTimeout(() => {
      const move = bestChessMove(game, aiColor, depth);
      if (!move) {
        setBusy(false);
        setMessage("No legal AI move.");
        return;
      }
      const applied = game.move(move);
      if (!applied) {
        setBusy(false);
        return;
      }
      const piece = pieceSymbol({ type: applied.piece, color: applied.color });
      setAnimation({ piece, from: squareToCoords(applied.from), to: squareToCoords(applied.to), toSquare: applied.to });
      if (animTimer.current) window.clearTimeout(animTimer.current);
      animTimer.current = window.setTimeout(() => {
        finishAnimatedMove();
      }, 360);
    }, 450);
  }

  useEffect(() => {
    return () => {
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
      if (animTimer.current) window.clearTimeout(animTimer.current);
    };
  }, []);

  const board = game.board();
  const turnText = game.turn() === "w" ? "White to move" : "Black to move";
  const inCheck = game.inCheck() ? " - Check!" : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "ai" ? "neu-tab-pressed" : "neu-tab-raised"}`}
            onClick={() => setMode("ai")}
            disabled={busy || !!animation}
          >
            vs AI
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "local" ? "neu-tab-pressed" : "neu-tab-raised"}`}
            onClick={() => setMode("local")}
            disabled={busy || !!animation}
          >
            Local 2-player
          </button>
        </div>
        {mode === "ai" ? (
          <div className="flex gap-2">
            <select
              className="neu-inset rounded-md px-2 py-1.5 text-xs"
              value={playerColor}
              onChange={(e) => setPlayerColor(e.target.value === "b" ? "b" : "w")}
              disabled={busy || !!animation}
            >
              <option value="w">Play White</option>
              <option value="b">Play Black</option>
            </select>
            <select
              className="neu-inset rounded-md px-2 py-1.5 text-xs"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value) || 3)}
              disabled={busy || !!animation}
            >
              <option value={2}>Easy</option>
              <option value={3}>Normal</option>
              <option value={4}>Hard</option>
            </select>
          </div>
        ) : null}
        <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={reset} disabled={busy || !!animation}>
          <RefreshCw size={14} /> New game
        </ActionButton>
      </div>

      <p className={`text-center text-sm font-medium ${done ? "text-emerald-600" : "text-slate-700 dark:text-slate-200"}`}>
        {done ? message : `${mode === "ai" && game.turn() !== playerColor ? "AI" : message === "Your move" ? turnText : turnText}${inCheck}`}
      </p>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-[var(--c-border-light)] shadow-inner">
        <div className="grid h-full w-full grid-cols-8 grid-rows-8">
          {board.flat().map((cell, index) => {
            const row = Math.floor(index / 8);
            const col = index % 8;
            const square = `${String.fromCharCode(97 + col)}${8 - row}`;
            const piece = cell;
            const isLight = (row + col) % 2 === 0;
            const selectedSquare = selected === square;
            const legalSquare = legal.has(square);
            const hidePiece = Boolean(animation && animation.toSquare === square);
            return (
              <button
                key={square}
                type="button"
                onClick={() => handleClick(square)}
                disabled={done || busy || !!animation}
                className={`relative flex items-center justify-center text-2xl transition-colors ${isLight ? "bg-amber-100 dark:bg-amber-950/60" : "bg-amber-800 text-white dark:bg-amber-900"}`}
              >
                {selectedSquare ? <span className="absolute inset-0 bg-blue-400/35" /> : null}
                {legalSquare ? <span className="absolute h-3 w-3 rounded-full bg-blue-500/70" /> : null}
                {!hidePiece && piece ? <span className="relative z-10 leading-none">{pieceSymbol(piece)}</span> : null}
                <span className="absolute bottom-0.5 right-1 text-[8px] text-slate-400/60">{square}</span>
              </button>
            );
          })}
        </div>

        {animation ? (
          <motion.span
            className="absolute z-20 flex h-[12.5%] w-[12.5%] items-center justify-center text-2xl"
            initial={{ left: `${animation.from.x}%`, top: `${animation.from.y}%` }}
            animate={{ left: `${animation.to.x}%`, top: `${animation.to.y}%` }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
          >
            {animation.piece}
          </motion.span>
        ) : null}
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-zinc-500">
        {mode === "ai"
          ? busy
            ? "AI is thinking or move is animating..."
            : `${turnText}${inCheck}. Click a piece, then a highlighted square.`
          : `${turnText}${inCheck}. Local match: white moves first.`}
      </p>
      {done ? <p className="text-center text-xs font-medium text-emerald-600">Game over. Score recorded.</p> : null}
    </div>
  );
}
