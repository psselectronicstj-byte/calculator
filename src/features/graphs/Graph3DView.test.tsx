import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../app/AppShell";
import { createHistoryStore } from "../../storage/history-store";
import { Graph3DView } from "./Graph3DView";

const stores: ReturnType<typeof createHistoryStore>[] = [];
const names: string[] = [];

function makeStore() {
  const name = `graph3d-view-test-${crypto.randomUUID()}`;
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

describe("Graph3DView", () => {
  it("supports multiple surfaces and saves their ranges to local history", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const store = makeStore();
    render(<Graph3DView initialInput="x+y" store={store} />);

    expect(screen.getByLabelText("Разрешение поверхности")).toHaveValue(64);
    const expressions = screen.getByRole("group", { name: "Поверхности графика" });
    fireEvent.click(within(expressions).getByRole("button", { name: "Добавить функцию" }));
    fireEvent.change(within(expressions).getByLabelText("Функция 2"), { target: { value: "x-y" } });
    fireEvent.click(screen.getByRole("button", { name: "Построить поверхности" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/WebGL/i);
    expect(await store.list()).toMatchObject([
      {
        feature: "graph3d",
        input: "x+y; x-y",
        result: expect.stringContaining("64"),
        status: "approximate",
      },
    ]);
  });

  it("announces WebGL context loss and leaves controls available", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<Graph3DView store={makeStore()} />);

    fireEvent.click(screen.getByRole("button", { name: "Построить поверхности" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/WebGL/i);
    fireEvent(screen.getByRole("img", { name: "Трёхмерная поверхность" }), new Event("webglcontextlost"));

    expect(screen.getByRole("alert")).toHaveTextContent(/контекст WebGL потерян/i);
    expect(screen.getByRole("button", { name: "Построить поверхности" })).toBeVisible();
  });

  it("rejects an empty surface expression before rendering", () => {
    render(<Graph3DView initialInput="" store={makeStore()} />);

    fireEvent.click(screen.getByRole("button", { name: "Построить поверхности" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/выражение/i);
  });

  it("keeps other application sections reachable when WebGL is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "3D-график" }));
    fireEvent.click(screen.getByRole("button", { name: "Построить поверхности" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/WebGL/i);
    fireEvent.click(screen.getByRole("button", { name: "Калькулятор" }));

    expect(screen.getByRole("heading", { name: "Калькулятор", level: 2 })).toBeVisible();
  });
});
