import { describe, it, expect } from "vitest";
import { generateDeterministicAvatarSvg, hashString } from "./avatarGenerator";

describe("avatarGenerator", () => {
  it("generates deterministic hash for the same input string", () => {
    const hash1 = hashString("user@university.edu");
    const hash2 = hashString("user@university.edu");
    const hash3 = hashString("different@university.edu");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it("produces identical SVG output and dataUrl for identical seeds", () => {
    const res1 = generateDeterministicAvatarSvg("alex.chen@mit.edu");
    const res2 = generateDeterministicAvatarSvg("alex.chen@mit.edu");

    expect(res1.svg).toBe(res2.svg);
    expect(res1.dataUrl).toBe(res2.dataUrl);
    expect(res1.palette).toEqual(res2.palette);
  });

  it("produces different visual palettes for distinct user seeds", () => {
    const resA = generateDeterministicAvatarSvg("user_alpha_1");
    const resB = generateDeterministicAvatarSvg("user_beta_99");

    expect(resA.svg).not.toBe(resB.svg);
  });
});
