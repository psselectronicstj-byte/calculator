import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import type { HistoryEntry } from "../domain/history-entry";
import { createHistoryStore } from "./history-store";

const openedStores: ReturnType<typeof createHistoryStore>[] = [];
const databaseNames: string[] = [];

function makeStore() {
  const name = `history-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  const store = createHistoryStore(name);
  openedStores.push(store);
  return store;
}

function entry(id: string, createdAt: number, input = "2+2"): HistoryEntry {
  return {
    id,
    feature: "calculator",
    input,
    result: "4",
    status: "exact",
    createdAt,
  };
}

afterEach(async () => {
  await Promise.all(openedStores.splice(0).map((store) => store.close()));
  await Promise.all(databaseNames.splice(0).map((name) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
});

describe("historyStore", () => {
  it("adds and lists entries newest first", async () => {
    const store = makeStore();
    await store.add(entry("old", 1));
    await store.add(entry("new", 2));

    expect((await store.list()).map(({ id }) => id)).toEqual(["new", "old"]);
  });

  it("persists entries when the database is reopened", async () => {
    const name = `history-test-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const original = createHistoryStore(name);
    openedStores.push(original);
    await original.add(entry("saved", 3, "sin(pi/2)"));
    await original.close();

    const reopened = createHistoryStore(name);
    openedStores.push(reopened);
    expect(await reopened.list()).toEqual([entry("saved", 3, "sin(pi/2)")]);
  });

  it("deletes one entry and clears the remaining history", async () => {
    const store = makeStore();
    await store.add(entry("one", 1));
    await store.add(entry("two", 2));
    await store.delete("one");
    expect((await store.list()).map(({ id }) => id)).toEqual(["two"]);

    await store.clear();
    expect(await store.list()).toEqual([]);
  });
});
