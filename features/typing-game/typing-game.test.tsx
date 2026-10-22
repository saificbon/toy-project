import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { TypingGame } from "@/features/typing-game/typing-game";

const button = (name: string) => screen.getByRole("button", { name });
const count = (id: "total" | "hit" | "missed") => screen.getByTestId(id).textContent;

function start() {
  fireEvent.click(button("게임 시작"));
  return screen.getByTestId("falling-phrase");
}

function typeAndEnter(value: string) {
  const input = screen.getByLabelText("타이핑 입력");
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

test("처음에는 대기 상태라 시작만 누를 수 있다", () => {
  render(<TypingGame />);

  expect(button("게임 시작")).toBeEnabled();
  expect(button("일시정지")).toBeDisabled();
  expect(button("게임 종료")).toBeDisabled();
  expect(screen.getByLabelText("타이핑 입력")).toBeDisabled();
  expect(screen.getByRole("button", { name: "단어" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "우리말" })).toBeInTheDocument();
});

test("처음에는 우리말이 선택되어 있고, 시작하면 콜론 없이 단어와 뜻이 공백으로 이어진 한 줄이 떨어진다", () => {
  render(<TypingGame />);

  expect(screen.getByRole("button", { name: "우리말" })).toHaveAttribute("aria-pressed", "true");

  const phrase = start();

  expect(phrase.textContent).not.toContain(":");
  expect(phrase.textContent).toMatch(/\S+ \S+/);
  expect(count("total")).toBe("1");
});

test("단어으로 바꿔 시작하면 낱말 하나가 떨어진다", () => {
  render(<TypingGame />);
  fireEvent.click(screen.getByRole("button", { name: "단어" }));

  const phrase = start();

  expect(phrase.textContent).toMatch(/^\S+$/);
});

test("똑같이 입력하고 Enter를 누르면 사라지고 맞은 개수가 늘며 입력창이 비워진다", () => {
  render(<TypingGame />);
  const phrase = start();

  typeAndEnter(phrase.textContent!);

  expect(screen.queryByTestId("falling-phrase")).not.toBeInTheDocument();
  expect(screen.getByTestId("burst")).toBeInTheDocument();
  expect(count("hit")).toBe("1");
  expect(screen.getByLabelText("타이핑 입력")).toHaveValue("");
});

test("일치하지 않는 입력은 개수를 바꾸지 않고 입력창만 비운다", () => {
  render(<TypingGame />);
  start();

  typeAndEnter("전혀 다른 글자");

  expect(screen.getByTestId("falling-phrase")).toBeInTheDocument();
  expect(count("hit")).toBe("0");
  expect(screen.getByLabelText("타이핑 입력")).toHaveValue("");
});

test("진행 중에는 게임 종류와 시작을 바꿀 수 없다", () => {
  render(<TypingGame />);
  start();

  expect(button("게임 시작")).toBeDisabled();
  expect(screen.getByRole("button", { name: "단어" })).toBeDisabled();
  expect(button("일시정지")).toBeEnabled();
  expect(button("게임 종료")).toBeEnabled();
});

test("일시정지하면 입력이 막히고 버튼이 재개로 바뀌며, 재개하면 다시 입력할 수 있다", () => {
  render(<TypingGame />);
  start();

  fireEvent.click(button("일시정지"));

  expect(screen.getByLabelText("타이핑 입력")).toBeDisabled();
  expect(within(screen.getByTestId("overlay")).getByText("일시정지")).toBeInTheDocument();

  fireEvent.click(button("재개"));

  expect(screen.getByLabelText("타이핑 입력")).toBeEnabled();
  expect(screen.queryByTestId("overlay")).not.toBeInTheDocument();
});

test("게임 종료 뒤에도 마지막 개수가 남고 다시 시작하면 0으로 돌아간다", () => {
  render(<TypingGame />);
  const phrase = start();
  typeAndEnter(phrase.textContent!);

  fireEvent.click(button("게임 종료"));

  expect(screen.getByText(/게임이 끝났습니다/)).toBeInTheDocument();
  expect(count("hit")).toBe("1");
  expect(button("게임 시작")).toBeEnabled();
  expect(screen.getByRole("button", { name: "단어" })).toBeEnabled();

  fireEvent.click(button("게임 시작"));

  expect(count("hit")).toBe("0");
  expect(count("total")).toBe("1");
});
