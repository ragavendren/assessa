import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FAQ_ITEMS,
  faqCategories,
  faqItemsFor,
  relatedFaqItems,
  tourStepsFor,
  TOUR_STEPS,
} from "./help-content.ts";

describe("faqItemsFor", () => {
  it("hides admin-only items from participants", () => {
    const items = faqItemsFor(false);
    assert.ok(items.length > 0);
    assert.ok(items.every((item) => item.audience === "all"));
    assert.ok(items.some((item) => item.id === "what-is-required"));
    assert.equal(
      items.some((item) => item.audience === "admin"),
      false,
    );
  });

  it("includes admin items for administrators", () => {
    const items = faqItemsFor(true);
    assert.ok(items.some((item) => item.id === "admin-nav"));
    assert.ok(items.some((item) => item.id === "admin-play"));
    assert.equal(items.length, FAQ_ITEMS.length);
    assert.ok(FAQ_ITEMS.every((item) => item.tag.trim().length > 0));
  });
});

describe("faqCategories", () => {
  it("preserves first-seen category order", () => {
    const categories = faqCategories(faqItemsFor(true));
    assert.deepEqual(categories, [
      "Getting started",
      "Daily Play",
      "Weekly Play",
      "Play modes",
      "Assessments",
      "XP & badges",
      "Leaderboard",
      "Profile",
      "Admin",
    ]);
  });
});

describe("relatedFaqItems", () => {
  it("returns other questions in the same topic", () => {
    const items = faqItemsFor(true);
    const playVs = items.find((item) => item.id === "play-vs-assessments");
    assert.ok(playVs);
    const related = relatedFaqItems(playVs, items);
    assert.ok(related.every((item) => item.category === "Play modes"));
    assert.ok(related.every((item) => item.id !== "play-vs-assessments"));
    assert.ok(related.length > 0);
  });
});

describe("tourStepsFor", () => {
  it("drops Play and Admin steps for a participant when Play is off", () => {
    const steps = tourStepsFor({ isAdmin: false, playOn: false });
    assert.ok(steps.every((step) => step.audience !== "admin"));
    assert.ok(steps.every((step) => !step.requiresPlay));
    assert.ok(steps.some((step) => step.id === "welcome"));
    assert.ok(steps.some((step) => step.id === "assessments"));
  });

  it("keeps Play and Admin steps when both apply", () => {
    const steps = tourStepsFor({ isAdmin: true, playOn: true });
    assert.ok(steps.some((step) => step.id === "play"));
    assert.ok(steps.some((step) => step.id === "admin"));
    assert.equal(steps.length, TOUR_STEPS.length);
  });
});
