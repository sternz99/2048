function AIManager(gameManager) {
  this.gameManager = gameManager;
  this.running = false;
  this.timer = null;
  this.moveDelay = 120;
  this.searchDepth = 3;
}

AIManager.prototype.start = function () {
  if (this.running || this.gameManager.isGameTerminated()) {
    return;
  }

  this.running = true;
  this.gameManager.setAiStatus(true, "AI running");
  this.scheduleNextMove();
};

AIManager.prototype.stop = function () {
  this.running = false;

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

AIManager.prototype.scheduleNextMove = function () {
  var self = this;

  if (!this.running) {
    return;
  }

  this.timer = window.setTimeout(function () {
    self.step();
  }, this.moveDelay);
};

AIManager.prototype.step = function () {
  var bestMove;

  if (!this.running) {
    return;
  }

  if (this.gameManager.isGameTerminated()) {
    this.stop();
    this.gameManager.setAiStatus(false, "Game over");
    return;
  }

  bestMove = this.findBestMove();

  if (bestMove === null || bestMove === undefined) {
    this.stop();
    this.gameManager.setAiStatus(false, "No legal moves");
    return;
  }

  this.gameManager.move(bestMove);

  if (this.running) {
    this.scheduleNextMove();
  }
};

AIManager.prototype.findBestMove = function () {
  var bestDirection = null;
  var bestScore = -Infinity;
  var directions = [0, 1, 2, 3];

  for (var i = 0; i < directions.length; i++) {
    var direction = directions[i];
    var result = this.gameManager.simulateMove(this.gameManager.serialize(), direction);
    var score;

    if (!result.moved) {
      continue;
    }

    score = this.expectimaxChance(result.state, this.searchDepth - 1);

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

  if (!cells.length) {
    return this.expectimaxMove(state, depth);
  }

  probabilityPerCell = 1 / cells.length;

  for (var i = 0; i < cells.length; i++) {
    total += probabilityPerCell * 0.9 * this.expectimaxMove(
      this.gameManager.addTileToState(state, cells[i], 2),
      depth
    );
    total += probabilityPerCell * 0.1 * this.expectimaxMove(
      this.gameManager.addTileToState(state, cells[i], 4),
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

  return emptyCells * 270 +
    smoothness * 0.2 +
    monotonicity * 1.1 +
    maxTile * 1.0 +
    cornerBonus * 1.6 +
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

AIManager.prototype.log2 = function (value) {
  return Math.log(value) / Math.log(2);
};
