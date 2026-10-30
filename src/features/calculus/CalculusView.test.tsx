import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CalculusView } from "./CalculusView";
import { createHistoryStore } from "../../storage/history-store";

const stores: ReturnType<typeof createHistoryStore>[] = [];
const names: string[] = [];

function makeStore() {
  const name = `calculus-view-test-${crypto.randomUUID()}`;
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

describe("CalculusView", () => {
  it("shows a derivative and saves it to local history", async () => {
    const store = makeStore();
    render(<CalculusView initialInput="x^2" store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "Найти производную" }));

    expect(await screen.findByLabelText("Результат анализа")).toHaveTextContent("2*x");
    expect(await store.list()).toMatchObject([
      { feature: "calculus", input: "x^2", result: "2*x", status: "exact" },
    ]);
  });
});
