import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HistoryEntry } from "../../domain/history-entry";
import { HistoryView } from "./HistoryView";
import { createHistoryStore } from "../../storage/history-store";

const openStores: ReturnType<typeof createHistoryStore>[] = [];
const databaseNames: string[] = [];

function makeStore() {
  const name = `history-view-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  const store = createHistoryStore(name);
  openStores.push(store);
  return store;
}

const sampleEntry: HistoryEntry = {
  id: "history-one",
  feature: "equations",
  input: "x^2=4",
  result: "x = -2, 2",
  status: "exact",
  createdAt: 1,
};

afterEach(async () => {
  cleanup();
  await Promise.all(openStores.splice(0).map((store) => store.close()));
  await Promise.all(databaseNames.splice(0).map((name) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
});

describe("HistoryView", () => {
  it("shows a directed empty state", async () => {
    render(<HistoryView store={makeStore()} onRestore={vi.fn()} />);
    expect(await screen.findByText(/история пока пуста/i)).toBeInTheDocument();
  });

  it("reopens a saved calculation in its original feature and input", async () => {
    const store = makeStore();
    await store.add(sampleEntry);
    const onRestore = vi.fn();
    render(<HistoryView store={store} onRestore={onRestore} />);

    fireEvent.click(await screen.findByRole("button", { name: /открыть x\^2=4/i }));

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith({ feature: "equations", input: "x^2=4" });
    });
  });

  it("deletes a record and exposes an explicit clear-history action", async () => {
    const store = makeStore();
    await store.add(sampleEntry);
    await store.add({ ...sampleEntry, id: "history-two", input: "x=3" });
    render(<HistoryView store={store} onRestore={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /удалить x\^2=4/i }));
    fireEvent.click(await screen.findByRole("button", { name: /очистить историю/i }));
    expect(await screen.findByText(/история пока пуста/i)).toBeInTheDocument();
    await waitFor(async () => expect(await store.list()).toEqual([]));
  });

  it("does not describe storage failure as an empty history", async () => {
    const store = makeStore();
    await store.close();
    render(<HistoryView store={store} onRestore={vi.fn()} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/история пока пуста/i)).not.toBeInTheDocument();
  });
});
