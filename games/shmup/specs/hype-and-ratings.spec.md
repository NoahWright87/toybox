# Shmup — Hype & Ratings Spec

> Issue: **F7 #135**. Status: formulas locked (Model 1, 2026-06-22); constants TBD.

## Grazing

- Detection from the graze-radius stat, producing **concentric rings** as fractions of the radius:
  `rings = [{frac:1.0, mult:1}, {frac:0.55, mult:2}, {frac:0.25, mult:4}]`; actual radius = `grazeRadius × frac`.
- **Graze multiplier** is a separate stat applied to payout.
- **Innermost ring only** (no stacking) — point-blank grazing is the deliberate high-skill, high-reward act.
- Exposes a graze event API (start/end, streak) consumed by items, the audience, and Hype.

## Hype — in-episode performance meter

Starts at **0 each episode** (items may change this). Top-of-screen meter.

```
HypeMax = base × crowdSize × itemMods            # ceiling rises with the crowd
gain:    Hype += eventValue × hypeGainMods       # graze/kill/trick/ring; clamp to HypeMax; idleTime → 0
decay:   d = baseDecay × (1 + k_idle·idleTime) × (1 + k_level·Hype/HypeMax)
         Hype = max(0, Hype − d·dt)              # super-linear: idle = rapid crash, top is slippery
reward:  ScoreMult = 1 + (Hype/HypeMax)·M        # M≈2 → up to ×3 score/gold at full Hype
```

**Hype-source items** reshape the meter, not just add to it: Masochist (Hype on damage taken), crits generate Hype, elites worth extra Hype, etc.

## Ratings — persistent career tier

Earned by converting the episode's (Hype-inflated) Score at episode end. Persistent across the career.

```
# Model 1 — Hype is rewarded ONCE, via ScoreMult. Do NOT apply a second Hype multiplier.
on clear:  RatingsGain = EpisodeScore × CrowdConversion × ratingsMods
           # EpisodeScore is already Hype-inflated, so "average Hype" is baked in via the integral
on death:  RatingsLoss = BasePenalty × (1 − stageProgress) × embarrassmentMod
           # + forfeit the episode's would-be RatingsGain (nothing banks)
cancelled: cumulative Ratings < 0
```

- **Gates ACCESS, not difficulty:** more node options skewed toward special nodes (`run-structure.spec.md`). Luck also biases special-node odds. Standard-node difficulty is driven by Season progress, never Ratings.
- **Tier ladder** (content registry): Nobody → Has-Been → … → Radical 🤙 → Kevin Bacon. The tier name *is* the progress bar.
- **Perks of high Ratings:** better shop tiers, comped rerolls, bigger crowds.
- **Loss:** Ratings < 0 = **Cancelled** = career over, any time (even the Pilot).

## Why Model 1

Current Hype multiplies score live; accumulating that Hype-inflated score across the episode *is* a time-average of your Hype, weighted by activity. So a separate average/peak-Hype settlement multiplier would double-count. Hype is rewarded exactly once, continuously.
