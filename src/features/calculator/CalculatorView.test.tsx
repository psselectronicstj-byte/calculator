import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CalculatorView } from "./CalculatorView";
import { createHistoryStore } from "../../storage/history-store";

const stores: ReturnType<typeof createHistoryStore>[] = [];
const names: string[] = [];

function makeStore() {
  const name = `calculator-view-test-${crypto.randomUUID()}`;
  names.push(name);
  const store = createHistoryStore(name);
  stores.push(store);
  return store;
}

afterEach(async () => {
  cleanup();
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(names.splice(0).map((name) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
});

describe("CalculatorView", () => {
  it("calculates an expression and saves it to local history", async () => {
    const store = makeStore();
    render(<CalculatorView store={store} />);
    fireEvent.change(screen.getByRole("textbox", { name: /математическое выражение/i }), {
      target: { value: "2+3" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Вычислить" }));

    expect(await screen.findByText("5", { selector: "output" })).toBeInTheDocument();
    await waitFor(async () => expect(await store.list()).toMatchObject([
      { feature: "calculator", input: "2+3", result: "5", status: "exact" },
    ]));
  });

  it("inserts keypad input at the editor cursor", async () => {
    render(<CalculatorView initialInput="12" store={makeStore()} />);
    const editor = screen.getByRole("textbox", { name: /математическое выражение/i }) as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(1, 1);

    fireEvent.click(screen.getByRole("button", { name: "Вставить +" }));

    await waitFor(() => expect(editor).toHaveValue("1+2"));
    expect(editor.selectionStart).toBe(2);
  });

  it("reports invalid expressions in the result area", async () => {
    render(<CalculatorView store={makeStore()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /математическое выражение/i }), {
      target: { value: "sqrt(-1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Вычислить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/отрицательного числа/i);
  });

  it("formats approximate values without exposing floating-point noise", async () => {
    render(<CalculatorView store={makeStore()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /математическое выражение/i }), {
      target: { value: "0.1+0.2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Вычислить" }));

    expect(await screen.findByText("≈ 0.3", { selector: "output" })).toBeInTheDocument();
  });

  it("preserves useful precision when formatting decimal results", async () => {
    render(<CalculatorView store={makeStore()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /математическое выражение/i }), {
      target: { value: "1.23456789012345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Вычислить" }));

    expect(await screen.findByText("≈ 1.23456789012345", { selector: "output" })).toBeInTheDocument();
  });
});
