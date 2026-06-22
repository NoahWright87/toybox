# Shmup — Audience & Score Spec

> Issues: **T10 #161** (audience), **C14 #163** (score), **F2 #130** (copy). Status: framing locked.

## Live studio audience

Visible silhouettes along the bottom of the screen — the presentation backbone of the showmanship theme.

- **Crowd size is environmental**, derived from Season + Ratings + stage type (famous pilots draw bigger crowds; a "crowded arena" stage variant is larger and rowdier with whistles/camera flashes). Crowd size also sets the **Hype ceiling** and **comment frequency**.
- **Capacity-gated service:** every game event (enemy dies, graze start/end, episode start, boss intro, score gained, hit, death) calls the service constantly, but it only **emits** a reaction if it has spare capacity (rate limiter) — keeps the screen readable.
- On emit: a **random silhouette** shows text rising + fading, with **per-comment rise/fade speeds** so a big crowd spreads chatter out and stays legible.
- **Score popups** render over the crowd too. The score-event function **auto-derives tags and calls the audience service**, so one call produces the popup *and* the reaction — single pipe.
- **Audio (later):** rising "whoooah" through a graze run → applause on a clean escape, sigh/boo on a hit or embarrassing death. Same event API; ships after the visual layer.

## Crowd-comment pool

Lines live in the content registry (`content-and-assets.spec.md`):
- **Strongly-typed tags** (enum / string-literal union), never raw strings.
- A reaction carries a context; eligible lines match its tags; **more matching tags = higher pick weight**. Generic filler and hyper-specific zingers coexist; specific wins when it applies.
- Token interpolation (`{playerName}`, `{tier}`, …).
- Tag dimensions: event (death/hit/graze/clear/levelStart/bossIntro/scoreGain…), stage timing (early/mid/late/boss), damage source, current Ratings tier, peak tier & trajectory (rising/falling/comeback), crowd size.

## Score & results

A 90s arcade results screen: grouped sub-scores summing to a **Total Score**.

| Group | Feeds it |
|---|---|
| **Destruction** | enemies / elites / bosses killed, structures bombed, total damage |
| **Affluence** | gold earned, tips caught, peak net worth, items owned, interest accrued |
| **Showmanship** | grazes, ring/ramp stunts, point-blank kills, peak Hype, time at max Hype |
| **Stardom** | peak Ratings/tier, episodes as fan-favorite, biggest comeback |
| **Survival** | Seasons cleared, episodes survived, deepest Syndication run, no-hit clears |

(Optional 6th **Heroics**, or folded into Showmanship/Stardom.)

**Model 1 guardrail:** each score-event is multiplied **once** by Hype's `ScoreMult`. Ratings derive from this Score — do **not** apply a second Hype multiplier.

**Recording moments:** **Finale score** when the Series Finale is beaten; **Syndication score** when Cancelled in endless. Both persist.
