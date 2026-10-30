import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EquationView } from "./EquationView";
import { createHistoryStore } from "../../storage/history-store";

const stores: ReturnType<typeof createHistoryStore>[] = [];
const names: string[] = [];

function makeStore() {
  const name = `equation-view-test-${crypto.randomUUID()}`;
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

describe("EquationView", () => {
  it("solves an equation and saves the solution to local history", async () => {
    const store = makeStore();
    render(<EquationView initialInput="x^2-4=0" store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "Решить уравнение" }));

    expect(await screen.findByLabelText("Решение уравнения")).toHaveTextContent("2");
    expect(await store.list()).toMatchObject([
      { feature: "equations", input: "x^2-4=0", status: "exact" },
    ]);
  });

  it("rejects a blank interval endpoint instead of interpreting it as zero", async () => {
    render(<EquationView initialInput="x=0" store={makeStore()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Начало интервала" }), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Найти корни" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/интервал/i);
  });

  it("keeps the restorable equation as the history input for interval search", async () => {
    const store = makeStore();
    render(<EquationView initialInput="x^2-2=0" store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "Найти корни" }));

    expect(await store.list()).toMatchObject([
      { feature: "equations", input: "x^2-2=0", status: "approximate" },
    ]);
  });
});
