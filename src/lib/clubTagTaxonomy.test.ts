import { describe, expect, it } from "vitest";
import {
  eventMatchesFollowedTags,
  findTagByName,
  notifySubscriberTagIds,
  walkAncestors,
  walkDescendants,
} from "./clubTagTaxonomy";
import type { ClubTagNode } from "./clubTagTaxonomy";

const TAXONOMY: ClubTagNode[] = [
  { id: "tech", name: "Technology", parent_tag_id: null },
  { id: "cs", name: "ComputerScience", parent_tag_id: "tech" },
  { id: "ml", name: "MachineLearning", parent_tag_id: "cs" },
  { id: "nn", name: "NeuralNetworks", parent_tag_id: "ml" },
];

describe("club tag hierarchical taxonomy (#4732)", () => {
  it("structures Technology → ComputerScience → MachineLearning", () => {
    const ml = findTagByName(TAXONOMY, "#MachineLearning");
    const cs = findTagByName(TAXONOMY, "#ComputerScience");
    const tech = findTagByName(TAXONOMY, "#Technology");
    expect(ml?.parent_tag_id).toBe(cs?.id);
    expect(cs?.parent_tag_id).toBe(tech?.id);
    expect(tech?.parent_tag_id).toBeNull();
  });

  it("walks UP so a MachineLearning follower also sees ComputerScience events", () => {
    const followed = [findTagByName(TAXONOMY, "MachineLearning")!.id];
    expect(walkAncestors("ml", TAXONOMY)).toEqual(["ml", "cs", "tech"]);
    expect(eventMatchesFollowedTags(["cs"], followed, TAXONOMY)).toBe(true);
    expect(eventMatchesFollowedTags(["tech"], followed, TAXONOMY)).toBe(true);
    expect(eventMatchesFollowedTags(["ml"], followed, TAXONOMY)).toBe(true);
    expect(eventMatchesFollowedTags(["nn"], followed, TAXONOMY)).toBe(false);
  });

  it("walks DOWN so a MachineLearning event notifies NeuralNetworks subscribers", () => {
    expect(walkDescendants("ml", TAXONOMY)).toEqual(["ml", "nn"]);
    const notify = notifySubscriberTagIds(["ml"], TAXONOMY);
    expect(notify.has("ml")).toBe(true);
    expect(notify.has("nn")).toBe(true);
    expect(notify.has("cs")).toBe(false);
    expect(notify.has("tech")).toBe(false);
  });
});
