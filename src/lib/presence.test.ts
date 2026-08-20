import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultTeamNames, isUserOnline, splitUsersIntoTeams } from "./presence.ts";

describe("isUserOnline", () => {
  it("treats a recent heartbeat as online", () => {
    const now = Date.parse("2026-08-20T10:00:00.000Z");
    assert.equal(isUserOnline(new Date(now - 30_000).toISOString(), now), true);
    assert.equal(isUserOnline(new Date(now - 5 * 60_000).toISOString(), now), false);
    assert.equal(isUserOnline(null, now), false);
  });
});

describe("splitUsersIntoTeams", () => {
  it("spreads users across teams and respects per-team caps", () => {
    const buckets = splitUsersIntoTeams(["a", "b", "c", "d", "e", "f"], 3, 2);
    assert.equal(buckets.length, 3);
    assert.equal(buckets.flat().length, 6);
    assert.ok(buckets.every((row) => row.length === 2));
  });
});

describe("defaultTeamNames", () => {
  it("fills missing custom names", () => {
    assert.deepEqual(defaultTeamNames(3, ["Alpha", "", "Gamma"]), ["Alpha", "Team 2", "Gamma"]);
  });
});
