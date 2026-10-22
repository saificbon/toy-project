export type GameKind = "word-learning" | "our-words";
export type Phase = "idle" | "playing" | "paused" | "ended";

export interface FallingPhrase {
  id: number;
  text: string;
  /** 게임 영역 안의 가로 위치. 0이면 왼쪽 끝, 1이면 오른쪽 끝에 붙는다. */
  x: number;
  /** 낙하 진행도. 0이면 맨 위, 1이면 바닥에 닿은 것이다. */
  y: number;
}

export interface GameState {
  phase: Phase;
  kind: GameKind;
  items: FallingPhrase[];
  total: number;
  hit: number;
  missed: number;
  elapsed: number;
  spawnTimer: number;
  nextId: number;
}

export interface GameContext {
  phrases: readonly string[];
  rng: () => number;
}

/** 총 개수가 이 값에 이르기 전에는 놓쳐도 판이 끝나지 않는다. */
export const MIN_TOTAL_FOR_GAME_OVER = 20;
/** 놓친 개수가 총 개수의 이 비율 이상이면 판이 끝난다. */
export const MISS_LIMIT_RATIO = 0.1;

/** 낙하 문구가 긴 게임 종류는 읽고 칠 시간이 더 필요해 낙하를 늦춘다. */
const SPEED_SCALE: Record<GameKind, number> = {
  "word-learning": 1,
  "our-words": 0.3,
};

export function difficultyAt(elapsed: number, kind: GameKind = "word-learning") {
  return {
    /** 초당 낙하 진행도. 단어는 처음에 위에서 바닥까지 10초, 우리말은 약 14초가 걸린다. */
    speed: Math.min(0.1 + elapsed * 0.0015, 0.3) * SPEED_SCALE[kind],
    maxConcurrent: Math.min(2 + Math.floor(elapsed / 15), 8),
    spawnInterval: Math.max(1.2, 3 - elapsed * 0.015),
  };
}

export function createIdleState(kind: GameKind): GameState {
  return {
    phase: "idle",
    kind,
    items: [],
    total: 0,
    hit: 0,
    missed: 0,
    elapsed: 0,
    spawnTimer: 0,
    nextId: 1,
  };
}

export function startGame(kind: GameKind, context: GameContext): GameState {
  return spawn({ ...createIdleState(kind), phase: "playing" }, context);
}

export function tick(state: GameState, dt: number, context: GameContext): GameState {
  if (state.phase !== "playing") return state;

  const { speed } = difficultyAt(state.elapsed, state.kind);
  const moved = state.items.map((item) => ({ ...item, y: item.y + speed * dt }));
  const falling = moved.filter((item) => item.y < 1);

  let next: GameState = {
    ...state,
    elapsed: state.elapsed + dt,
    items: falling,
    missed: state.missed + (moved.length - falling.length),
    spawnTimer: state.spawnTimer - dt,
  };

  const { maxConcurrent } = difficultyAt(next.elapsed);
  if (next.spawnTimer <= 0 && next.items.length < maxConcurrent) {
    next = spawn(next, context);
  }

  return isOverMissLimit(next) ? { ...next, phase: "ended" } : next;
}

export function submitInput(
  state: GameState,
  input: string,
): { state: GameState; removed: FallingPhrase | null } {
  if (state.phase !== "playing") return { state, removed: null };

  const target = state.items
    .filter((item) => item.text === input)
    .sort((a, b) => b.y - a.y)[0];
  if (!target) return { state, removed: null };

  return {
    state: {
      ...state,
      items: state.items.filter((item) => item.id !== target.id),
      hit: state.hit + 1,
    },
    removed: target,
  };
}

export function pauseGame(state: GameState): GameState {
  return state.phase === "playing" ? { ...state, phase: "paused" } : state;
}

export function resumeGame(state: GameState): GameState {
  return state.phase === "paused" ? { ...state, phase: "playing" } : state;
}

export function endGame(state: GameState): GameState {
  return state.phase === "playing" || state.phase === "paused"
    ? { ...state, phase: "ended" }
    : state;
}

function isOverMissLimit(state: GameState) {
  return (
    state.total >= MIN_TOTAL_FOR_GAME_OVER &&
    state.missed >= state.total * MISS_LIMIT_RATIO
  );
}

function spawn(state: GameState, { phrases, rng }: GameContext): GameState {
  const onScreen = new Set(state.items.map((item) => item.text));
  const candidates = phrases.filter((phrase) => !onScreen.has(phrase));
  if (candidates.length === 0) return state;

  const text = candidates[Math.min(Math.floor(rng() * candidates.length), candidates.length - 1)];
  const interval = difficultyAt(state.elapsed).spawnInterval;

  return {
    ...state,
    items: [...state.items, { id: state.nextId, text, x: rng(), y: 0 }],
    total: state.total + 1,
    spawnTimer: interval,
    nextId: state.nextId + 1,
  };
}
