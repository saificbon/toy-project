import { describe, expect, test } from "vitest";

import {
  createIdleState,
  difficultyAt,
  endGame,
  pauseGame,
  resumeGame,
  startGame,
  submitInput,
  tick,
  type GameState,
} from "@/features/typing-game/engine";

const POOL = ["가람 강", "가랑비 조금씩 내리는 비", "가온 가운데", "그린내 연인"];
const first = () => 0;

function ctx(phrases: readonly string[] = POOL, rng: () => number = first) {
  return { phrases, rng };
}

function playing(overrides: Partial<GameState> = {}): GameState {
  return { ...startGame("word-learning", ctx()), ...overrides };
}

describe("게임 시작", () => {
  test("시작하면 진행 상태가 되고 첫 낙하 문구가 맨 위에서 나타나며 총 개수가 1이다", () => {
    const state = startGame("word-learning", ctx());

    expect(state.phase).toBe("playing");
    expect(state.items).toHaveLength(1);
    expect(state.items[0].y).toBe(0);
    expect(POOL).toContain(state.items[0].text);
    expect(state).toMatchObject({ total: 1, hit: 0, missed: 0 });
  });

  test("낙하 문구의 가로 위치는 0~1 사이라 게임 영역 안에 머문다", () => {
    const state = startGame("word-learning", ctx(POOL, () => 0.999));

    expect(state.items[0].x).toBeGreaterThanOrEqual(0);
    expect(state.items[0].x).toBeLessThanOrEqual(1);
  });

  test("대기 상태는 아무 낙하 문구도 없다", () => {
    expect(createIdleState("our-words")).toMatchObject({
      phase: "idle",
      kind: "our-words",
      items: [],
      total: 0,
    });
  });
});

describe("낙하와 놓침", () => {
  test("시간이 흐르면 낙하 문구가 아래로 내려간다", () => {
    const state = tick(startGame("word-learning", ctx()), 1, ctx());

    expect(state.items[0].y).toBeCloseTo(difficultyAt(0).speed, 5);
  });

  test("바닥에 닿은 낙하 문구는 놓친 개수를 1 늘리고 사라진다", () => {
    const start = playing();
    const state = tick(start, 11, ctx(["가람 강"]));

    expect(state.missed).toBe(1);
    expect(state.items.find((i) => i.id === start.items[0].id)).toBeUndefined();
  });

  test("총 개수는 맞은 개수 + 놓친 개수 + 떨어지는 중인 개수와 항상 같다", () => {
    let state = startGame("our-words", ctx());
    for (let i = 0; i < 400; i++) {
      state = tick(state, 0.1, ctx(["가", "나", "다", "라", "마", "바"]));
      if (state.phase === "ended") break;
      if (i % 7 === 0 && state.items[0]) {
        state = submitInput(state, state.items[0].text).state;
      }
      expect(state.total).toBe(state.hit + state.missed + state.items.length);
    }
  });

  test("화면에 이미 있는 글자는 다시 고르지 않는다", () => {
    let state = startGame("word-learning", ctx());
    for (let i = 0; i < 30; i++) state = tick(state, 0.2, ctx());

    const texts = state.items.map((item) => item.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("난이도", () => {
  test("시간이 지날수록 동시 개수는 늘고 속도는 빨라지되 상한이 있다", () => {
    const early = difficultyAt(0);
    const later = difficultyAt(60);
    const forever = difficultyAt(100000);

    expect(later.maxConcurrent).toBeGreaterThan(early.maxConcurrent);
    expect(later.speed).toBeGreaterThan(early.speed);
    expect(forever.maxConcurrent).toBeLessThanOrEqual(8);
    expect(forever.speed).toBeLessThanOrEqual(0.3);
    expect(early.maxConcurrent).toBeLessThanOrEqual(2);
    expect(1 / early.speed).toBeGreaterThanOrEqual(9);
  });

  test("동시에 떨어지는 개수는 그 시점 난이도의 동시 개수를 넘지 않는다", () => {
    const phrases = Array.from({ length: 50 }, (_, i) => `낱말${i}`);
    let state = startGame("our-words", ctx(phrases));
    for (let i = 0; i < 1000 && state.phase === "playing"; i++) {
      state = tick(state, 0.1, ctx(phrases));
      expect(state.items.length).toBeLessThanOrEqual(
        difficultyAt(state.elapsed).maxConcurrent,
      );
    }
  });

  test("입력으로 쉴 틈 없이 없애면 동시 개수가 처음보다 늘어난 채 버틴다", () => {
    const phrases = Array.from({ length: 50 }, (_, i) => `낱말${i}`);
    let state = startGame("our-words", ctx(phrases));
    let peak = 0;
    for (let i = 0; i < 1200; i++) {
      state = tick(state, 0.1, ctx(phrases));
      peak = Math.max(peak, state.items.length);
      // 가장 아래 문구가 화면 끝에 가까울 때만 없애 동시 개수가 쌓이게 둔다.
      const lowest = [...state.items].sort((a, b) => b.y - a.y)[0];
      if (lowest && lowest.y > 0.85) {
        state = submitInput(state, lowest.text).state;
      }
    }
    expect(state.phase).toBe("playing");
    expect(peak).toBeGreaterThan(2);
  });
});

describe("입력", () => {
  test("똑같이 입력하면 그 문구가 사라지고 맞은 개수가 1 늘어난다", () => {
    const start = playing();
    const target = start.items[0];

    const { state, removed } = submitInput(start, target.text);

    expect(removed?.id).toBe(target.id);
    expect(state.items).toHaveLength(0);
    expect(state.hit).toBe(1);
  });

  test("일치하지 않는 입력은 아무 개수도 바꾸지 않는다", () => {
    const start = playing();

    const { state, removed } = submitInput(start, "없는 글자");

    expect(removed).toBeNull();
    expect(state).toEqual(start);
  });

  test("앞뒤 공백이나 한 글자 차이도 일치로 보지 않는다", () => {
    const start = playing();
    const text = start.items[0].text;

    expect(submitInput(start, ` ${text}`).removed).toBeNull();
    expect(submitInput(start, text.slice(0, -1)).removed).toBeNull();
  });

  test("같은 글자가 둘이면 가장 아래에 있는 것부터 없앤다", () => {
    const base = playing();
    const upper = { ...base.items[0], id: 90, y: 0.2 };
    const lower = { ...base.items[0], id: 91, y: 0.7 };
    const start = { ...base, items: [upper, lower], total: 2 };

    const { state, removed } = submitInput(start, upper.text);

    expect(removed?.id).toBe(91);
    expect(state.items.map((i) => i.id)).toEqual([90]);
  });

  test("진행 중이 아니면 입력을 받지 않는다", () => {
    const paused = pauseGame(playing());

    expect(submitInput(paused, paused.items[0].text).removed).toBeNull();
  });
});

describe("종료 규칙", () => {
  test("총 개수가 20개 미만이면 놓쳐도 끝나지 않는다", () => {
    const start = playing({ total: 10, missed: 5 });

    expect(tick(start, 0.01, ctx()).phase).toBe("playing");
  });

  test("총 개수가 20개이고 놓친 개수가 10% 이상이면 끝난다", () => {
    const start = playing({ total: 20, missed: 2, items: [] });

    expect(tick(start, 0.01, ctx(["가람 강"])).phase).toBe("ended");
  });

  test("총 개수가 20개이고 놓친 개수가 10% 미만이면 계속된다", () => {
    const start = playing({ total: 21, missed: 2, items: [] });

    // 21개의 10%는 2.1이므로 2개는 한도 아래다.
    expect(tick(start, 0.01, ctx(["가람 강"])).phase).toBe("playing");
  });

  test("놓친 낙하 문구 때문에 한도에 이르면 같은 순간에 끝난다", () => {
    const base = playing();
    const falling = { ...base.items[0], y: 0.999 };
    const start = { ...base, total: 20, missed: 1, items: [falling] };

    const state = tick(start, 1, ctx());

    expect(state.missed).toBe(2);
    expect(state.phase).toBe("ended");
  });

  test("끝난 판은 낙하 문구를 그 자리에 남기고 개수를 보존한다", () => {
    const start = playing({ total: 30, missed: 3 });

    const ended = endGame(start);

    expect(ended.phase).toBe("ended");
    expect(ended.items).toEqual(start.items);
    expect(ended).toMatchObject({ total: 30, missed: 3 });
    expect(tick(ended, 5, ctx())).toEqual(ended);
  });

  test("끝난 뒤 다시 시작하면 개수가 0으로 돌아간다", () => {
    const ended = endGame(playing({ total: 30, missed: 3, hit: 20 }));

    const next = startGame("our-words", ctx());

    expect(ended.total).toBe(30);
    expect(next).toMatchObject({ phase: "playing", hit: 0, missed: 0, total: 1, kind: "our-words" });
  });
});

describe("일시정지", () => {
  test("일시정지 중에는 낙하와 새 문구 등장이 멈춘다", () => {
    const paused = pauseGame(playing());

    expect(tick(paused, 30, ctx())).toEqual(paused);
  });

  test("재개하면 멈춘 자리에서 이어진다", () => {
    const moved = tick(playing(), 2, ctx());
    const resumed = resumeGame(pauseGame(moved));

    expect(resumed.phase).toBe("playing");
    expect(resumed.items).toEqual(moved.items);
  });

  test("진행 중이 아닐 때의 일시정지는 상태를 바꾸지 않는다", () => {
    const idle = createIdleState("word-learning");

    expect(pauseGame(idle)).toEqual(idle);
    expect(resumeGame(idle)).toEqual(idle);
  });
});
