import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AlgebraView } from "./AlgebraView";
import { createHistoryStore } from "../../storage/history-store";

const stores: ReturnType<typeof createHistoryStore>[] = [];
const names: string[] = [];

function makeStore() {
  const name = `algebra-view-test-${crypto.randomUUID()}`;
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

describe("AlgebraView", () => {
  it("shows a symbolic transformation and saves it to local history", async () => {
    const store = makeStore();
    render(<AlgebraView initialInput="2x+3x" store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "Преобразовать" }));

    expect(await screen.findByLabelText("Результат преобразования")).toHaveTextContent("5*x");
    expect(await store.list()).toMatchObject([
      { feature: "algebra", input: "2x+3x", result: "5*x", status: "exact" },
    ]);
  });
});
