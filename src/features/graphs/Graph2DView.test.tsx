import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHistoryStore } from "../../storage/history-store";
import { Graph2DView } from "./Graph2DView";

const stores: ReturnType<typeof createHistoryStore>[] = [];
const names: string[] = [];

function makeStore() {
  const name = `graph2d-view-test-${crypto.randomUUID()}`;
  names.push(name);
  const store = createHistoryStore(name);
  stores.push(store);
  return store;
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(names.splice(0).map((name) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
});

describe("Graph2DView", () => {
  it("supports multiple functions, accessible range controls, and local history", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const store = makeStore();
    render(<Graph2DView initialInput="x^2" store={store} />);

    const expressions = screen.getByRole("group", { name: "Функции графика" });
    fireEvent.click(within(expressions).getByRole("button", { name: "Добавить функцию" }));
    const inputs = within(expressions).getAllByLabelText(/Функция/);
    fireEvent.change(inputs[0], { target: { value: "x^2" } });
    fireEvent.change(inputs[1], { target: { value: "sin(x)" } });
    fireEvent.click(screen.getByRole("button", { name: "Построить график" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Canvas 2D/i);
    expect(await store.list()).toMatchObject([
      { feature: "graph2d", input: "x^2; sin(x)", status: "approximate" },
    ]);
    expect(screen.getByLabelText("Текущий диапазон графика")).toHaveTextContent("x: [-10; 10]");
    fireEvent.click(screen.getByRole("button", { name: "Увеличить масштаб" }));
    expect(screen.getByLabelText("Текущий диапазон графика")).toHaveTextContent("x: [-8; 8]");
    expect(screen.getByRole("button", { name: "Увеличить масштаб" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Сместить влево" })).toBeVisible();
  });

  it("shows a clear error for an empty expression", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<Graph2DView initialInput="" store={makeStore()} />);

    fireEvent.click(screen.getByRole("button", { name: "Построить график" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/выражение/i);
  });

  it("zooms around the current center without silently clamping the range", () => {
    render(<Graph2DView store={makeStore()} />);

    fireEvent.click(screen.getByRole("button", { name: "Увеличить масштаб" }));

    expect(screen.getByLabelText("Минимум x")).toHaveValue(-8);
    expect(screen.getByLabelText("Максимум x")).toHaveValue(8);
  });
});
