# Dual AI strategy plan

## Goal
Allow the user to choose between two autoplay strategies before starting the AI:

- Greedy Heuristic
- Expectimax Search

## Scope
- Keep the live game loop and board state logic intact.
- Add a strategy selector to the UI without breaking keyboard controls or manual gameplay.
- Preserve the existing speed control and AI lifecycle.
- Validate both strategies with smoke tests and bounded profile runs.

## Tasks
1. Add a strategy abstraction in `js/ai_manager.js` with a default of expectimax.
2. Implement a greedy heuristic move selector for Option A.
3. Wire the selected strategy to the browser controls and status label.
4. Add or extend smoke tests for each strategy and the strategy-switching flow.
5. Run short validation for both agents and document the default recommendation.

## Acceptance criteria
- The user can select either strategy from the UI before starting AI autoplay.
- Start AI behaves correctly for both strategies without freezing or auto-stopping unexpectedly.
- The default strategy remains Expectimax Search for the current behavior.
- Smoke tests pass for both strategy paths.
