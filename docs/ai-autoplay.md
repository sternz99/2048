# 2048 AI autoplay

This project includes optional autoplay modes that can play the game without manual input.

## Design

The project supports three autoplay strategies, which the user can pick from the UI before starting AI play:

- Greedy Heuristic: a fast agent that scores each legal move immediately by board quality and tile potential.
- Human Expert: a rule-based strategy inspired by strong human play habits (corner anchoring, snake ordering, primary-direction discipline, and avoiding destabilizing reverse moves).
- Expectimax Search: a search-based agent that simulates candidate moves and random tile spawns to maximize expected utility.

For Expectimax Search, the AI evaluates candidate moves by simulating the next board state, then applying a chance node for the random tile spawn. This is a classic expectimax approach:

- Player node: choose the move that maximizes the expected utility.
- Chance node: after a move, a new tile is added at a random empty cell with 90% probability of a 2 and 10% probability of a 4.
- Terminal state: when no legal moves remain, the game stops.

## Implementation notes

The live game logic stays separate from the AI simulation layer:

- `js/game_manager.js` owns the live board and movement loop.
- `js/game_simulator.js` clones board state without mutating the active game.
- `js/ai_manager.js` runs the strategy selector, human-expert policy, heuristic evaluation, and expectimax search.

The heuristic prioritizes:

- empty cells,
- board smoothness,
- monotonicity,
- corner retention,
- merge potential,
- current maximum tile.

## UI behavior

The browser includes:

- a Start/Stop AI button,
- a strategy control (`Greedy Heuristic`, `Human Expert`, `Expectimax Search`),
- a speed control (`slow`, `normal`, `fast`),
- status text showing whether the AI is thinking, running, or stopped.

The default experience keeps the game responsive by using bounded search depth and a paced action loop.

## Validation

Short, bounded smoke tests and a lightweight profile harness are included under `tests/` to guard against regressions and to confirm the AI remains stable in browser-like conditions.
