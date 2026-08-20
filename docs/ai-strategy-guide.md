# AI strategy guide

This game ships with three autoplay strategies designed for different trade-offs between speed and board quality.

## Strategy overview

### Greedy Heuristic

The Greedy Heuristic strategy scores each legal move by looking at the resulting board state and choosing the move with the best immediate quality. This is a lightweight policy with a low computational cost, which means it responds quickly and is easier to tune when you want a fast or more observably "human-like" autoplayer.

Use this mode when:
- you want the AI to react quickly,
- you are comparing multiple simple policies,
- you want a less expensive autoplay loop for debugging or benchmarking.

### Expectimax Search

The Expectimax Search strategy evaluates candidate moves by simulating the next board state and then accounting for the random tile spawns that follow a player move. It chooses the move that maximizes expected value over a short search horizon, which usually leads to stronger long-term play.

Use this mode when:
- you want better board planning,
- you care more about long-term score quality than raw speed,
- the default AI behavior is the goal.

### Human Expert

The Human Expert strategy applies practical human play rules directly in move selection. It favors keeping the highest tile anchored in the bottom-right corner, following a monotonic snake-like ordering with alternating rows so smaller tiles can chain-merge upward into the corner, preferring Right/Down moves, and treating Up as close to a forbidden move unless board safety demands it. It now also computes three priority targets from the board state and dynamically biases scoring toward the highest-priority one: repair a broken chain, complete the next high-tile merge, or preserve the anchor / snake order. Repair-chain gets the heaviest target weight so the AI fixes structure first before chasing the next merge, and if the current board already shows a broken chain, that target becomes the immediate step goal. The active target list is also shown in the AI running label because the status text now mirrors the current AI label instead of only showing a generic running message, and the first-priority target can be outlined as a compact overlay badge on the board. It still rewards compact merge chains, penalizes max-tile drift, gives extra weight to lower-row chain pressure, explicitly raises priority when a small tile breaks the snake chain, and preserves immediate merge score opportunities as part of the tuning.

Use this mode when:
- you want behavior that is easier to reason about and inspect than search trees,
- you want a policy that explicitly mirrors human expert discipline,
- you want stronger board-shape consistency than a simple greedy baseline.

## Tuning the parameters

The AI panel exposes a small set of tuning controls:

### Heuristic bias

- Range: 0.5x to 2.0x
- Purpose: scales long-term board-quality terms such as empty cells, smoothness, monotonicity, merge potential, and corner preference. Immediate merge score and maximum-tile value remain independent, so changing the bias can alter which move is preferred.
- Practical effect: higher values favor structured positions with more room and future merge opportunities over an immediate score gain. This preference also grows as the score or maximum tile rises, when preserving a viable board becomes more important.

Suggested starting points:
- 1.0x: balanced default
- 1.3x to 1.6x: more aggressive board shaping
- 0.7x to 0.9x: more relaxed or lightweight play

### Search depth

- Range: 1 to 4
- Purpose: defines how many move/chance levels the Expectimax search looks ahead.
- Practical effect: deeper search usually means stronger decisions, but it also increases CPU time and can feel slower in the browser.

Suggested starting points:
- 1 or 2: good for responsive play
- 3: stronger planning while keeping the UI responsive
- 4: best quality but the slowest and most expensive option

### Speed

- Slow / Normal / Fast
- Purpose: controls how quickly the AI makes successive moves between decisions.
- Practical effect: this changes the pacing of the autoplay loop rather than the search logic itself.

## Auto restart option

The AI panel includes an `Auto restart` toggle. When enabled, the AI will automatically start a fresh game as soon as the current round ends. This is useful when you want to benchmark a strategy over many games or let the AI keep playing without manual intervention.

## Recommended default setup

For most players, the best starting configuration is:
- Strategy: Expectimax Search
- Heuristic bias: 1.0x
- Search depth: 2
- Speed: Normal
- Auto restart: off by default

This provides a strong balance between responsiveness and playing quality without making the browser feel sluggish.

If you want a more aggressive, faster comparison run, try:
- Strategy: Greedy Heuristic
- Heuristic bias: 1.2x
- Speed: Fast
- Auto restart: on for repeated runs

If you want a more deliberate, stronger run, try:
- Strategy: Expectimax Search
- Search depth: 3
- Speed: Slow
- Auto restart: on if you want to watch many games in sequence

If you want a human-like disciplined run, try:
- Strategy: Human Expert
- Speed: Normal
- Auto restart: off for observation, on for repeated trials
