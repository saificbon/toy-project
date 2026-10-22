"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon, PowerIcon, StopIcon } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createIdleState,
  endGame,
  pauseGame,
  resumeGame,
  startGame,
  submitInput,
  tick,
  type FallingPhrase,
  type GameKind,
} from "./engine";
import { GAME_KINDS, phrasesFor } from "./phrases";

/** 한 프레임이 이보다 길면(탭 전환 등) 낙하가 튀지 않도록 잘라 낸다. */
const MAX_FRAME_SECONDS = 0.1;
const BURST_PARTICLES = 8;

type Burst = Pick<FallingPhrase, "id" | "text" | "x" | "y">;

function positionOf({ x, y }: Pick<FallingPhrase, "x" | "y">) {
  // 자기 너비·높이만큼 되돌려, 어느 위치에서도 게임 영역 안에 온전히 보이게 한다.
  return {
    left: `${x * 100}%`,
    top: `${Math.min(y, 1) * 100}%`,
    transform: `translate(${-x * 100}%, ${-Math.min(y, 1) * 100}%)`,
  };
}

export function TypingGame() {
  const [game, setGame] = useState(() => createIdleState("word-learning"));
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [input, setInput] = useState("");
  const [exited, setExited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { phase, kind } = game;
  const isPlaying = phase === "playing";
  const isRunning = isPlaying || phase === "paused";

  useEffect(() => {
    if (!isPlaying) return;

    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      last = now;
      setGame((current) =>
        tick(current, dt, { phrases: phrasesFor(current.kind), rng: Math.random }),
      );
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) inputRef.current?.focus();
  }, [isPlaying]);

  function start() {
    setBursts([]);
    setInput("");
    setGame(startGame(kind, { phrases: phrasesFor(kind), rng: Math.random }));
  }

  function togglePause() {
    setGame((current) => (current.phase === "paused" ? resumeGame(current) : pauseGame(current)));
  }

  function exitApp() {
    setGame((current) => endGame(current));
    setExited(true);
    // 스크립트로 연 탭이 아니면 브라우저가 막으므로, 막혀도 안내 화면이 남는다.
    window.close();
  }

  function submit(value: string) {
    const { state, removed } = submitInput(game, value);
    setGame(state);
    if (removed) setBursts((current) => [...current, removed]);
    setInput("");
  }

  return (
    <main className="flex min-h-dvh flex-col md:h-dvh md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b p-4 md:w-72 md:border-r md:border-b-0 md:p-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          우리말 타자 연습
        </h1>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">
            게임 종류
          </p>
          <ToggleGroup
            aria-label="게임 종류"
            variant="outline"
            orientation="vertical"
            className="w-full"
            value={[kind]}
            disabled={isRunning || exited}
            onValueChange={(next) => {
              if (next[0]) setGame(createIdleState(next[0] as GameKind));
            }}
          >
            {GAME_KINDS.map(({ kind: value, label }) => (
              <ToggleGroupItem key={value} value={value} className="w-full justify-start aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={start} disabled={isRunning || exited}>
            <PlayIcon data-icon="inline-start" />
            게임 시작
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={togglePause}
            disabled={!isRunning || exited}
          >
            {phase === "paused" ? (
              <PlayIcon data-icon="inline-start" />
            ) : (
              <PauseIcon data-icon="inline-start" />
            )}
            {phase === "paused" ? "재개" : "일시정지"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setGame((current) => endGame(current))}
            disabled={!isRunning || exited}
          >
            <StopIcon data-icon="inline-start" />
            게임 종료
          </Button>
          <Button size="lg" variant="destructive" onClick={exitApp} disabled={exited}>
            <PowerIcon data-icon="inline-start" />
            앱 종료
          </Button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-6">
        {exited ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 border bg-muted/30 p-6 text-center">
            <p className="font-heading text-lg font-semibold">앱이 종료되었습니다</p>
            <p className="text-sm text-muted-foreground">
              다시 하려면 페이지를 새로고침하세요.
            </p>
          </div>
        ) : (
          <>
            <div role="status" aria-label="게임 현황" className="flex flex-wrap gap-2">
              <Badge variant="outline" className="h-7 px-3 text-sm">
                총 개수 <strong data-testid="total">{game.total}</strong>
              </Badge>
              <Badge variant="secondary" className="h-7 px-3 text-sm">
                맞은 개수 <strong data-testid="hit">{game.hit}</strong>
              </Badge>
              <Badge variant="destructive" className="h-7 px-3 text-sm">
                놓친 개수 <strong data-testid="missed">{game.missed}</strong>
              </Badge>
            </div>

            <div
              data-testid="play-area"
              className="relative min-h-[60dvh] flex-1 overflow-hidden border bg-muted/30 md:min-h-0"
            >
              {game.items.map((item) => (
                <span
                  key={item.id}
                  data-testid="falling-phrase"
                  className="absolute border bg-card px-3 py-1 text-base font-medium whitespace-nowrap text-card-foreground shadow-sm"
                  style={positionOf(item)}
                >
                  {item.text}
                </span>
              ))}

              {bursts.map((burst) => (
                <span
                  key={burst.id}
                  data-testid="burst"
                  aria-hidden
                  className="typing-burst pointer-events-none absolute"
                  style={positionOf(burst)}
                  onAnimationEnd={(event) => {
                    if (event.target !== event.currentTarget) return;
                    setBursts((current) => current.filter((b) => b.id !== burst.id));
                  }}
                >
                  <span className="typing-burst-text border bg-card px-3 py-1 text-base font-medium whitespace-nowrap text-card-foreground">
                    {burst.text}
                  </span>
                  {Array.from({ length: BURST_PARTICLES }, (_, i) => (
                    <i
                      key={i}
                      className="typing-burst-particle"
                      style={{ "--angle": `${(360 / BURST_PARTICLES) * i}deg` } as React.CSSProperties}
                    />
                  ))}
                </span>
              ))}

              {phase !== "playing" && (
                <div
                  data-testid="overlay"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 p-6 text-center"
                >
                  {phase === "idle" && (
                    <>
                      <p className="font-heading text-lg font-semibold">준비되었습니다</p>
                      <p className="text-sm text-muted-foreground">
                        게임 종류를 고르고 게임 시작을 누르세요.
                      </p>
                    </>
                  )}
                  {phase === "paused" && (
                    <p className="font-heading text-lg font-semibold">일시정지</p>
                  )}
                  {phase === "ended" && (
                    <>
                      <p className="font-heading text-lg font-semibold">게임이 끝났습니다</p>
                      <p className="text-sm text-muted-foreground">
                        총 {game.total}개 중 {game.hit}개를 맞혔고 {game.missed}개를 놓쳤습니다.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <Input
              ref={inputRef}
              aria-label="타이핑 입력"
              placeholder="떨어지는 글자를 똑같이 입력하고 Enter를 누르세요"
              autoComplete="off"
              value={input}
              disabled={!isPlaying}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                // 한글 조합 중에도 입력창에는 마지막 글자까지 담겨 있으므로 그 값으로 판정한다.
                submit(event.currentTarget.value);
              }}
            />
          </>
        )}
      </section>
    </main>
  );
}
