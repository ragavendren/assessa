import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageMapFromUrl, resolveImageRef } from "./question-image-ref.ts";

describe("resolveImageRef", () => {
  it("keeps http(s) URLs including avif", () => {
    const url = "https://cdn.example.com/follow-me-social-business-theme-design_24877-50426.avif";
    assert.equal(resolveImageRef(url), url);
  });

  it("maps a filename to an uploaded URL", () => {
    assert.equal(
      resolveImageRef("diagram.png", { "diagram.png": "https://files.example/diagram.png" }),
      "https://files.example/diagram.png",
    );
  });
});

describe("imageMapFromUrl", () => {
  it("indexes both the full URL and the file name", () => {
    const url = "https://cdn.example.com/path/banner.avif";
    assert.deepEqual(imageMapFromUrl(url), {
      [url.toLowerCase()]: url,
      "banner.avif": url,
    });
  });
});
