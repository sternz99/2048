# Human Expert AI Strategy Backlog

## Status legend
- `pending` not started
- `in_progress` actively implementing
- `done` finished

## Plan and backlog
| ID | Task | Status | Notes |
|---|---|---|---|
| HE-01 | Create design doc for Human Expert strategy | done | Added `docs\ai-human-expert-design.md` |
| HE-02 | Add Human Expert strategy option to UI and labels | done | Added selector option and `strategyLabels.humanExpert` |
| HE-03 | Implement Human Expert move-selection logic in `js\ai_manager.js` | done | Added scoring model, snake alignment, corner distance, and tie-breakers |
| HE-04 | Extend smoke tests for Human Expert strategy | done | Added legal move + forbidden-direction behavior checks |
| HE-05 | Update docs for strategy usage and defaults | done | Updated `docs\ai-autoplay.md` and `docs\ai-strategy-guide.md` |
| HE-06 | Run smoke and profile checks for updated strategy set | done | Smoke passed; profile harness run for `humanExpert` |

## Progress log
- 2026-08-21: Backlog initialized.
- 2026-08-21: HE-01 completed.
- 2026-08-21: HE-02 started.
- 2026-08-21: HE-02 completed.
- 2026-08-21: HE-03 completed.
- 2026-08-21: HE-04 completed.
- 2026-08-21: HE-05 completed.
- 2026-08-21: HE-06 started.
- 2026-08-21: HE-06 completed.
- 2026-08-21: Snake layout refined to alternate row direction for cleaner merge chaining into the home corner.
- 2026-08-21: Human Expert scoring refined to reward compact merge chains and stronger corner anchoring.
- 2026-08-21: Added move-risk penalty to reduce max-tile drift away from the home corner.
- 2026-08-21: Added chain-pressure bonus for lower rows so the third row does not outrun the fourth-row merge chain.
- 2026-08-21: Added broken-chain penalty so small tiles interrupting the snake path are repaired sooner.
- 2026-08-21: Added score-potential bonus to preserve immediate merge opportunities while maintaining the snake.
- 2026-08-21: Added priority targets to dynamically bias repair / high-tile merge / anchor preservation.
- 2026-08-21: Added target summary to the AI running label for Human Expert mode.
- 2026-08-21: Added autoplay resume on refresh when auto-restart is enabled.
- 2026-08-21: Increased repair-chain target weight above merge/anchor fallbacks.
