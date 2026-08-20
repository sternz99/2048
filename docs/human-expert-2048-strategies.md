# Human expert strategies for 2048

This note summarizes the most common, field-tested strategies used by strong human players.  
It focuses on practical play patterns rather than AI search methods.

## 1. Pick and protect a “home corner”

The most universal expert habit is to keep the highest tile anchored in one corner (usually bottom-right or bottom-left) and avoid moving it away.

Why it works:

- It creates a stable structure for building large merges.
- It reduces board chaos from random spawns.
- It makes future moves more predictable.

Rule of thumb:

- Once your max tile reaches the corner, treat dislodging it as an emergency-only action.

## 2. Build a monotonic “snake” layout

Experts shape tiles so values decrease smoothly away from the home corner (often in a snake pattern across rows or columns).

Example idea (highest near bottom-right):

- Bottom row: 1024, 512, 256, 128
- Row above: 64, 32, 16, 8
- etc.

Why it works:

- Nearby tiles are closer in value, increasing merge opportunities.
- The board stays organized instead of fragmented.

## 3. Favor two primary directions

Strong players usually rely on two moves most of the game:

- one horizontal direction toward the corner side,
- one vertical direction toward the corner side.

They minimize opposite-direction moves that break structure.

Common pattern (corner = bottom-right):

- Frequent: Right + Down
- Rare/careful: Left
- Avoid: Up (unless required to survive)

## 4. Keep empty cells available

Space is life in 2048.  
Experts constantly protect mobility by preserving empty cells.

Practical targets:

- Early/mid game: keep several open cells whenever possible.
- When space is tight: prioritize moves that create at least one immediate empty cell.

If two moves score similarly, choose the one that keeps more empty spaces.

## 5. Merge with intent, not greed

Beginners over-prioritize immediate merges.  
Experts prefer merges that preserve board shape and future chains.

Good merge:

- Advances structure toward your monotonic layout.

Bad merge:

- Gains points now but drags large tiles away from the corner or creates isolated values.

Think “board health first, score second” in difficult positions.

## 6. Prepare merges one step early

High-level play is about setup:

- Align pairs before you need them.
- Keep “next merge” tiles adjacent along your snake path.
- Avoid creating single high tiles with no matching partner plan.

A useful check each turn:

- “If a bad spawn appears, do I still have a safe follow-up move?”

## 7. Use the “forbidden move” mindset

Many experts treat one direction as nearly forbidden (the direction that pulls away from the corner).  
They only use it when:

- no safe primary-direction move exists, or
- it immediately prevents a loss.

This discipline dramatically reduces self-inflicted collapses.
