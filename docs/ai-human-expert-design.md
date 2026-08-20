# Human Expert AI Strategy Design

## Objective
Add a third autoplay strategy, **Human Expert**, based on `docs\human-expert-2048-strategies.md`, and integrate it into the existing AI strategy selector without breaking current heuristic and expectimax behavior.

## Source strategy mapping
The new strategy translates the human-expert principles into a deterministic scoring policy:

1. Home corner anchoring (default: bottom-right).
2. Monotonic snake preference toward that corner, with rows alternating direction so adjacent tiles can chain-merge cleanly toward the home corner.
3. Primary-direction bias (for bottom-right: Right + Down).
4. Empty-cell preservation.
5. Intentional merges that keep structure.
6. Near-forbidden reverse move penalty (for bottom-right: Up).

## Design constraints
- Keep existing `AIManager` lifecycle and controls unchanged.
- Reuse current simulator/evaluation helpers where possible.
- Preserve default strategy (`expectimax`).
- Keep behavior explainable and tunable with minimal new knobs.

## Implementation approach
### 1. Strategy wiring
- Add `humanExpert` to `strategyLabels`.
- Route `findBestMove` through a new `findHumanExpertMove`.
- Add UI option in `index.html`.

### 2. Human expert evaluator
For each legal move:
- Simulate resulting state.
- Compute three priority targets from the board state:
  1. repair a broken chain,
  2. complete the next high-tile merge (for example 512),
  3. preserve the anchor / snake order.
- Dynamically bias the scoring toward the highest-priority target while keeping the lower two as fallback goals.
- Use higher weights for the repair-chain target than the merge target, and keep anchor preservation as a lighter fallback.
- Promote the repair target into a concrete step goal when the board already shows a broken chain, so the agent fixes the local issue before chasing the larger target.
- Surface the active target list in the AI running label for user visibility.
- Provide a target tile outline candidate for the first-priority goal when possible.
- Render a compact board overlay badge for the outline candidate so the user can spot it at a glance.
- Score with weighted terms:
  - empty cells
  - max-tile-in-home-corner bonus
  - snake/monotonic alignment score
  - merge potential
  - smoothness
  - chain-merge bonus for adjacent merges along the bottom-right path
  - chain-pressure bonus for lower rows feeding the home corner
  - broken-chain penalty when a small tile interrupts the snake path
  - move-risk penalty for breaking the anchored snake pattern
  - score-potential bonus for preserving immediate merge opportunities
  - forbidden/reverse move penalty
  - primary direction bonus
  - Pick the highest score.

  Snake layout note:
  - Bottom row should descend from the home corner.
  - The row above should reverse direction so smaller tiles feed into that row's merges.
  - Continued rows should keep alternating direction to support a merge chain instead of a flat gradient.

Tie-breaks:
- Prefer primary moves (Right, then Down for bottom-right profile).
- Prefer move that preserves corner anchor.

### 3. Reused and new helpers
Reuse:
- `evaluateState` primitives (`computeSmoothness`, `computeMonotonicity`, `computeMergePotential`, max tile helpers).

Add:
- `computeHumanExpertScore(state, direction)`
- `computeSnakeAlignment(values, cornerProfile)`
- `computeCornerDistancePenalty(values, maxTile, cornerProfile)`

### 4. Documentation updates
- Update `docs\ai-autoplay.md` and `docs\ai-strategy-guide.md` to include the new strategy and when to use it.

### 5. Validation
- Extend `tests\ai_smoke_test.js`:
  - strategy label assertion
  - legal move assertion for `humanExpert`
  - behavior assertion that it avoids forbidden direction in a crafted state unless required.

## Non-goals
- No additional deep search for human-expert mode (single-step scoring policy by design).
- No change to game rules, keyboard controls, or default AI startup behavior.
