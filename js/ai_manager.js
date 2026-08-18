function AIManager(gameManager) {
  this.gameManager = gameManager;
  this.running = false;
  this.timer = null;
  this.baseMoveDelay = 90;
  this.busy = false;
  this.speed = "normal";
  this.strategy = "expectimax";
  this.speedProfiles = {
    slow: 150,
    normal: 90,
    fast: 60
  };
  this.strategyLabels = {
    heuristic: "Greedy Heuristic",
    expectimax: "Expectimax Search"
  };
  this.settings = {
    heuristicBias: 1,
    expectimaxDepth: 2
  };
}

AIManager.prototype.start = function () {
  if (this.running || this.gameManager.isGameTerminated()) {
    return;
  }

  this.running = true;
  this.gameManager.setAiStatus(true, "AI running (" + this.getStrategyLabel() + ")");
  this.scheduleNextMove();
};

AIManager.prototype.stop = function () {
  this.running = false;
  this.busy = false;

  if (this.timer !== null) {
    window.clearTimeout(this.timer);
    this.timer = null;
  }

  this.gameManager.setAiStatus(false, "AI stopped");
};

AIManager.prototype.toggle = function () {
  if (this.running) {
    this.stop();
  } else {
    this.start();
  }
};

AIManager.prototype.getStrategyLabel = function () {
  return this.strategyLabels[this.strategy] || this.strategyLabels.expectimax;
};

AIManager.prototype.setStrategy = function (strategy) {
  if (!this.strategyLabels[strategy]) {
    return;
  }

  this.strategy = strategy;

  if (this.running) {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.gameManager.setAiStatus(true, "AI running (" + this.getStrategyLabel() + ")");
    this.scheduleNextMove();
  }
};

AIManager.prototype.setSpeed = function (speed) {
  if (!this.speedProfiles[speed]) {
    return;
  }

  this.speed = speed;

  if (this.running) {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.gameManager.setAiStatus(true, "AI running (" + this.getStrategyLabel() + ")");
    this.scheduleNextMove();
  }
};

AIManager.prototype.setConfig = function (config) {
  if (!config || typeof config !== "object") {
    return;
  }

  if (config.heuristicBias !== undefined) {
    this.settings.heuristicBias = this.clamp(Number(config.heuristicBias), 0.5, 2);
  }

  if (config.expectimaxDepth !== undefined) {
    this.settings.expectimaxDepth = this.clamp(Math.round(Number(config.expectimaxDepth)), 1, 4);
  }

  if (this.running) {
    this.gameManager.setAiStatus(true, "AI running (" + this.getStrategyLabel() + ")");
  }
};

AIManager.prototype.scheduleNextMove = function () {
  var self = this;
  var delay = this.getMoveDelay();

  if (!this.running) {
    return;
  }

  this.timer = null;
  this.timer = window.setTimeout(function () {
    self.step();
  }, delay);
};

AIManager.prototype.step = function () {
  var bestMove;
  var searchDepth;

  if (!this.running) {
    return;
  }

  if (this.gameManager.isGameTerminated()) {
    this.stop();
    this.gameManager.setAiStatus(false, "Game over");
    return;
  }

  this.busy = true;
  searchDepth = this.getSearchDepth();
  this.gameManager.setAiStatus(true, "AI thinking (" + this.getStrategyLabel() + ", depth " + searchDepth + ")");

  bestMove = this.getBestMoveForCurrentStrategy(searchDepth);
  this.busy = false;

  if (bestMove === null || bestMove === undefined) {
    this.stop();
    this.gameManager.setAiStatus(false, "No legal moves");
    return;
  }

  this.gameManager.move(bestMove, true);

  if (this.running) {
    this.gameManager.setAiStatus(true, "AI running (" + this.getStrategyLabel() + ")");
    this.scheduleNextMove();
  }
};

AIManager.prototype.getBestMoveForCurrentStrategy = function (depth) {
  return this.findBestMove(depth);
};

AIManager.prototype.findHeuristicMove = function () {
  var bestDirection = null;
  var bestScore = -Infinity;
  var directions = [0, 1, 2, 3];
  var currentState = this.gameManager.serialize();

  for (var i = 0; i < directions.length; i++) {
    var direction = directions[i];
    var result = this.gameManager.simulateMove(currentState, direction);
    var score;

    if (!result.moved) {
      continue;
    }

    score = this.evaluateState(result.state);
    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }

  return bestDirection;
};

AIManager.prototype.findBestMove = function (depth) {
  if (this.strategy === "heuristic") {
    return this.findHeuristicMove();
  }

  var bestDirection = null;
  var bestScore = -Infinity;
  var directions = [0, 1, 2, 3];
  var currentState = this.gameManager.serialize();

  for (var i = 0; i < directions.length; i++) {
    var direction = directions[i];
    var result = this.gameManager.simulateMove(currentState, direction);
    var score;

    if (!result.moved) {
      continue;
    }

    score = this.expectimaxChance(result.state, depth - 1);

    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }

  return bestDirection;
};

AIManager.prototype.expectimaxMove = function (state, depth) {
  var bestScore = -Infinity;
  var directions = [0, 1, 2, 3];
  var foundMove = false;

  if (depth <= 0) {
    return this.evaluateState(state);
  }

  for (var i = 0; i < directions.length; i++) {
    var result = this.gameManager.simulateMove(state, directions[i]);
    var score;

    if (!result.moved) {
      continue;
    }

    foundMove = true;
    score = this.expectimaxChance(result.state, depth - 1);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  if (!foundMove) {
    return this.evaluateState(state);
  }

  return bestScore;
};

AIManager.prototype.expectimaxChance = function (state, depth) {
  var cells = this.gameManager.availableCellsFromState(state);
  var total = 0;
  var probabilityPerCell;
  var sampledCells = cells;

  if (!cells.length) {
    return this.expectimaxMove(state, depth);
  }

  if (cells.length > 6) {
    sampledCells = this.sampleCells(cells, state);
  }

  probabilityPerCell = 1 / sampledCells.length;

  for (var i = 0; i < sampledCells.length; i++) {
    total += probabilityPerCell * 0.9 * this.expectimaxMove(
      this.gameManager.addTileToState(state, sampledCells[i], 2),
      depth
    );
    total += probabilityPerCell * 0.1 * this.expectimaxMove(
      this.gameManager.addTileToState(state, sampledCells[i], 4),
      depth
    );
  }

  return total;
};

AIManager.prototype.evaluateState = function (state) {
  var values = this.gameManager.getStateValues(state);
  var emptyCells = this.gameManager.availableCellsFromState(state).length;
  var smoothness = this.computeSmoothness(values);
  var monotonicity = this.computeMonotonicity(values);
  var maxTile = this.computeMaxTile(values);
  var cornerBonus = this.computeCornerBonus(values, maxTile);
  var mergePotential = this.computeMergePotential(values);
  var heuristicBias = this.settings.heuristicBias || 1;
  var progress = Math.max(
    this.log2(maxTile || 1) / 11,
    Math.min(state.score / 20000, 1)
  );
  var structureWeight = heuristicBias * (1 + progress);
  var structureScore = emptyCells * 320 +
    smoothness * 4 +
    monotonicity * 12 +
    cornerBonus * 6 +
    mergePotential * 20;

  return structureScore * structureWeight +
    maxTile * 2 +
    state.score;
};

AIManager.prototype.computeSmoothness = function (values) {
  var score = 0;

  for (var x = 0; x < values.length; x++) {
    for (var y = 0; y < values[x].length; y++) {
      var value = values[x][y];

      if (!value) {
        continue;
      }

      if (x + 1 < values.length && values[x + 1][y]) {
        score -= Math.abs(this.log2(value) - this.log2(values[x + 1][y]));
      }

      if (y + 1 < values[x].length && values[x][y + 1]) {
        score -= Math.abs(this.log2(value) - this.log2(values[x][y + 1]));
      }
    }
  }

  return score;
};

AIManager.prototype.computeMonotonicity = function (values) {
  var totals = [0, 0, 0, 0];
  var size = values.length;
  var x;
  var y;

  for (x = 0; x < size; x++) {
    for (y = 0; y < size - 1; y++) {
      var currentRow = this.log2(values[x][y] || 1);
      var nextRow = this.log2(values[x][y + 1] || 1);

      if (currentRow > nextRow) {
        totals[0] += nextRow - currentRow;
      } else if (nextRow > currentRow) {
        totals[1] += currentRow - nextRow;
      }
    }
  }

  for (y = 0; y < size; y++) {
    for (x = 0; x < size - 1; x++) {
      var currentColumn = this.log2(values[x][y] || 1);
      var nextColumn = this.log2(values[x + 1][y] || 1);

      if (currentColumn > nextColumn) {
        totals[2] += nextColumn - currentColumn;
      } else if (nextColumn > currentColumn) {
        totals[3] += currentColumn - nextColumn;
      }
    }
  }

  return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
};

AIManager.prototype.computeMaxTile = function (values) {
  var maxTile = 0;

  for (var x = 0; x < values.length; x++) {
    for (var y = 0; y < values[x].length; y++) {
      maxTile = Math.max(maxTile, values[x][y]);
    }
  }

  return maxTile;
};

AIManager.prototype.computeCornerBonus = function (values, maxTile) {
  var corners = [
    values[0][0],
    values[0][values.length - 1],
    values[values.length - 1][0],
    values[values.length - 1][values.length - 1]
  ];

  for (var i = 0; i < corners.length; i++) {
    if (corners[i] === maxTile) {
      return maxTile;
    }
  }

  return 0;
};

AIManager.prototype.computeMergePotential = function (values) {
  var score = 0;

  for (var x = 0; x < values.length; x++) {
    for (var y = 0; y < values[x].length; y++) {
      var value = values[x][y];

      if (!value) {
        continue;
      }

      if (x + 1 < values.length && values[x + 1][y] === value) {
        score += this.log2(value);
      }

      if (y + 1 < values[x].length && values[x][y + 1] === value) {
        score += this.log2(value);
      }
    }
  }

  return score;
};

AIManager.prototype.getSearchDepth = function () {
  var emptyCells = this.gameManager.grid.availableCells().length;
  var baseDepth = emptyCells >= 10 ? 3 : 2;
  var tunedDepth = Math.min(4, Math.max(1, this.settings.expectimaxDepth));

  if (this.speed === "slow") {
    return Math.min(4, Math.max(1, tunedDepth + 1));
  }

  if (this.speed === "fast") {
    return Math.max(1, Math.min(4, tunedDepth - 1));
  }

  return Math.min(4, Math.max(1, tunedDepth + baseDepth - 2));
};

AIManager.prototype.getMoveDelay = function () {
  var emptyCells = this.gameManager.grid.availableCells().length;
  var baseDelay = this.speedProfiles[this.speed] || this.speedProfiles.normal;

  if (emptyCells <= 2) {
    return baseDelay + 75;
  }

  if (emptyCells <= 5) {
    return baseDelay + 35;
  }

  return baseDelay;
};

AIManager.prototype.sampleCells = function (cells, state) {
  var values = this.gameManager.getStateValues(state);

  return cells.slice().sort(function (first, second) {
    return values[second.x][second.y] - values[first.x][first.y];
  }).slice(0, 6);
};

AIManager.prototype.log2 = function (value) {
  return Math.log(value) / Math.log(2);
};

AIManager.prototype.clamp = function (value, min, max) {
  return Math.min(max, Math.max(min, value));
};
