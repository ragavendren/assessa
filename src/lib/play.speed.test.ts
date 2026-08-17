import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossedSpeedAlert, speedZoneOf } from "./play.speed.ts";

describe("speedZoneOf", () => {
  it("maps remaining time to urgency zones", () => {
    assert.equal(speedZoneOf(300, 300), "ok");
    assert.equal(speedZoneOf(150, 300), "half");
    assert.equal(speedZoneOf(75, 300), "quarter");
    assert.equal(speedZoneOf(30, 300), "ten");
    assert.equal(speedZoneOf(15, 300), "red");
  });
});

describe("crossedSpeedAlert", () => {
  it("fires once when a threshold is crossed", () => {
    assert.equal(crossedSpeedAlert(0.51, 0.5)?.title, "50% left");
    assert.equal(crossedSpeedAlert(0.26, 0.25)?.title, "25% left");
    assert.equal(crossedSpeedAlert(0.11, 0.1)?.title, "10% left");
    assert.equal(crossedSpeedAlert(0.06, 0.05)?.title, "5% left");
    assert.equal(crossedSpeedAlert(0.49, 0.48), null);
  });
});
