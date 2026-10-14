export const GAMES = [
  {
    id: "reaction",
    name: "Reaction Time",
    description: "Tap as fast as you can when the screen turns green. Lower time is better.",
    short: "React",
    unit: "ms",
    lowerIsBetter: true,
  },
  {
    id: "memory",
    name: "Memory Match",
    description: "Flip cards and match pairs. Finish with fewer moves for a higher score.",
    short: "Memory",
    unit: "score",
    lowerIsBetter: false,
  },
  {
    id: "pattern",
    name: "Pattern Sequence",
    description: "Watch the sequence light up, then repeat it. Longer sequence, more points.",
    short: "Pattern",
    unit: "score",
    lowerIsBetter: false,
  },
  {
    id: "typing",
    name: "Typing Speed",
    description: "Type as many words as you can in 30 seconds. Faster = higher score.",
    short: "Typing",
    unit: "wpm",
    lowerIsBetter: false,
  },
  {
    id: "number",
    name: "Guess the Number",
    description: "Guess the hidden number in the fewest tries. Fewer guesses, more points.",
    short: "Number",
    unit: "score",
    lowerIsBetter: false,
  },
  {
    id: "word",
    name: "Word Scramble",
    description: "Unscramble mixed-up work words before time runs out. More words = higher score.",
    short: "Word",
    unit: "words",
    lowerIsBetter: false,
  },
  {
    id: "snakes-ladders",
    name: "Snake & Ladders",
    description: "Roll the dice, climb ladders, dodge snakes. Reach tile 100 in fewer moves.",
    short: "Snakes",
    unit: "score",
    lowerIsBetter: false,
  },
  {
    id: "chess",
    name: "Chess",
    description: "Classic chess vs AI or local 2-player. Win or draw for points.",
    short: "Chess",
    unit: "score",
    lowerIsBetter: false,
  },
] as const;

export const GAME_IDS = GAMES.map((g) => g.id);
export const MAX_GAME_SCORE = 100000;
