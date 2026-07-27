/**
 * The crowd-comment pool — the showcase for "copy is an asset"
 * (specs/audience-and-score.spec.todo.md, specs/content-and-assets.spec.todo.md).
 *
 * Pure content: each line is just a list of tags (see ./tags.ts) plus the
 * line itself. A line is eligible when every one of its tags is present in
 * the active context; an empty `tags` array means generic filler that's
 * always eligible. Matching and weighted picking is logic, not content, so
 * it lives in ./accessors.ts (`pickCrowdComment`) instead of here.
 *
 * Adding or editing a line is a one-file change to CROWD_COMMENTS below.
 * See ./README.md for the authoring guide.
 */
import type { CrowdTag } from "./tags";

export interface CrowdCommentLine {
  /** Tags that must ALL be active for this line to be eligible. */
  tags: readonly CrowdTag[];
  says: string;
}

// Keep specific zingers and generic filler side by side — specificity is
// handled entirely by the weighting in pickCrowdComment (accessors.ts),
// not by file order.
export const CROWD_COMMENTS: readonly CrowdCommentLine[] = [
  // Generic filler — always eligible (no tags), lowest weight.
  { tags: [], says: "We love you {playerName}!!" },
  { tags: [], says: "Let's go!!" },
  { tags: [], says: "Come on, let's see something good!" },

  // Hits / death.
  { tags: ["hit"], says: "Booooo!" },
  { tags: ["death"], says: "Aw, come on!" },
  { tags: ["death", "earlyGame"], says: "That's it?! These seats cost me $5000!!" },
  { tags: ["death", "has-been", "falling"], says: "Oh, how the mighty have fallen." },
  { tags: ["death", "bossFight"], says: "SO CLOSE! SO CLOSE!" },

  // Grazing.
  { tags: ["graze"], says: "Whoooaaa!" },
  { tags: ["graze", "grazeStreak5"], says: "DUUUUDE!!" },
  { tags: ["graze", "grazeStreak10", "packedCrowd"], says: "THIS PLACE IS LOSING IT!!" },

  // Clears / comebacks.
  { tags: ["clear"], says: "And the crowd goes wild!" },
  { tags: ["clear", "comeback"], says: "HE'S STILL GOT IT!" },
  { tags: ["clear", "kevin-bacon"], says: "Of course he cleared it. He's Kevin Bacon." },

  // Episode/boss framing.
  { tags: ["levelStart"], says: "Here we go, here we go!" },
  { tags: ["bossIntro"], says: "Ooooooh, here we go!" },
  { tags: ["bossIntro", "largeCrowd"], says: "EVERYBODY ON YOUR FEET!" },

  // Score.
  { tags: ["scoreGain"], says: "Ka-ching!" },
  { tags: ["scoreGain", "packedCrowd"], says: "THE WHOLE PLACE IS GOING NUTS!" },
] as const;
