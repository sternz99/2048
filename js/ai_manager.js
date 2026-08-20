function AIManager(gameManager) {
  this.gameManager = gameManager;
  this.running = false;
  this.timer = null;
  this.baseMoveDelay = 90;
  this.busy = false;
  this.speed = "normal";
  this.strategy = "expectimax";
  this.restartOnEnd = false;
  this.speedProfiles = {
    slow: 150,
    normal: 90,
    fast: 60
  };
  this.strategyLabels = {
    heuristic: "Greedy Heuristic",
    humanExpert: "Human Expert",
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

AIManager.prototype.setAutoRestart = function (enabled) {
  this.restartOnEnd = !!enabled;
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

  if (this.gameManager.won && !this.gameManager.keepPlaying) {
    this.gameManager.keepPlaying = true;
    this.gameManager.actuator.continueGame();
  }

  if (this.gameManager.isGameTerminated()) {
    if (this.restartOnEnd) {
      this.stop();
      this.gameManager.restart();
      this.start();
      return;
    }

    this.stop();
    this.gameManager.setAiStatus(false, "Game over");
    return;
  }

  this.busy = true;
  searchDepth = this.getSearchDepth();
  this.gameManager.setAiStatus(true, this.getAiRunningLabel(searchDepth));
  this.gameManager.actuator.updateAITarget(this.getHumanExpertTargetOutline());

  bestMove = this.getBestMoveForCurrentStrategy(searchDepth);
  this.busy = false;

  if (bestMove === null || bestMove === undefined) {
    this.stop();
    this.gameManager.setAiStatus(false, "No legal moves");
    return;
  }

  this.gameManager.move(bestMove, true);

  if (this.running) {
    this.gameManager.setAiStatus(true, this.getAiRunningLabel(searchDepth));
    this.gameManager.actuator.updateAITarget(this.getHumanExpertTargetOutline());
    this.scheduleNextMove();
  }
};

AIManager.prototype.getAiRunningLabel = function (searchDepth) {
  if (this.strategy !== "humanExpert") {
    return "AI running (" + this.getStrategyLabel() + ")";
  }

  return "AI running (" +
    this.getStrategyLabel() +
    "; targets: " +
    this.getHumanExpertTargetSummary() +
    "; depth " +
    searchDepth +
    ")";
};

AIManager.prototype.getAiStatusLabel = function (searchDepth) {
  if (this.strategy !== "humanExpert") {
    return "AI running (" + this.getStrategyLabel() + ")";
  }

  return this.getHumanExpertStatusLine(searchDepth);
};

AIManager.prototype.getHumanExpertStatusLine = function (searchDepth) {
  return this.getAiRunningLabel(searchDepth);
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
  if (this.strategy === "humanExpert") {
    return this.findHumanExpertMove();
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

AIManager.prototype.findHumanExpertMove = function () {
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

    score = this.computeHumanExpertScore(result.state, direction, currentState);
    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    } else if (score === bestScore) {
      bestDirection = this.breakHumanExpertTie(bestDirection, direction, result.state, currentState);
    }
  }

  return bestDirection;
};

AIManager.prototype.computeHumanExpertScore = function (state, direction, currentState) {
  var values = this.gameManager.getStateValues(state);
  var currentValues = this.gameManager.getStateValues(currentState);
  var currentMaxTile = this.computeMaxTile(currentValues);
  var emptyCells = this.gameManager.availableCellsFromState(state).length;
  var smoothness = this.computeSmoothness(values);
  var monotonicity = this.computeMonotonicity(values);
  var maxTile = this.computeMaxTile(values);
  var scorePotential = this.computeScorePotential(values);
  var cornerBonus = values[values.length - 1][values.length - 1] === maxTile ? maxTile : 0;
  var mergePotential = this.computeMergePotential(values);
  var snakeAlignment = this.computeSnakeAlignment(values);
  var targets = this.computeHumanExpertTargets(values, currentValues);
  var targetWeights = this.computeHumanExpertTargetWeights(targets);
  var stepGoals = this.computeHumanExpertStepGoals(values, currentValues, targets);
  var cornerDistancePenalty = this.computeCornerDistancePenalty(values, maxTile);
  var cornerAnchorPenalty = this.computeCornerAnchorPenalty(values, maxTile);
  var chainPressureBonus = this.computeChainPressureBonus(values);
  var brokenChainPenalty = this.computeBrokenChainPenalty(values);
  var chainMergeBonus = this.computeChainMergeBonus(currentValues, values, direction);
  var moveRiskPenalty = this.computeMoveRiskPenalty(currentValues, values, direction, currentMaxTile);
  var primaryDirectionBonus = (direction === 1 || direction === 2) ? 120 : 0;
  var forbiddenDirectionPenalty = direction === 0 ? -260 : 0;

  return emptyCells * 420 +
    smoothness * 5 +
    monotonicity * 10 +
    scorePotential * 12 +
    mergePotential * 24 +
    snakeAlignment * 28 +
    targets.repairChain * targetWeights.repairChain +
    targets.mergeMax * targetWeights.mergeMax +
    targets.keepAnchor * targetWeights.keepAnchor +
    stepGoals.repairChain * 90 +
    stepGoals.mergeMax * 60 +
    stepGoals.keepAnchor * 24 +
    cornerBonus * 8 +
    chainPressureBonus * 22 +
    brokenChainPenalty * 80 +
    chainMergeBonus * 32 +
    moveRiskPenalty * 26 +
    primaryDirectionBonus +
    forbiddenDirectionPenalty -
    cornerAnchorPenalty * 30 -
    cornerDistancePenalty * 18 +
    state.score;
};

AIManager.prototype.computeHumanExpertTargetWeights = function (targets) {
  return {
    repairChain: targets.repairChain > 0 ? 160 : 0,
    mergeMax: targets.mergeMax > 1 ? 120 : (targets.mergeMax > 0 ? 72 : 0),
    keepAnchor: targets.keepAnchor > 0 ? 48 : 0
  };
};

AIManager.prototype.computeHumanExpertStepGoals = function (values, currentValues, targets) {
  var goals = {
    repairChain: 0,
    mergeMax: 0,
    keepAnchor: 0
  };
  var currentMax = this.computeMaxTile(currentValues);
  var maxTile = this.computeMaxTile(values);
  var x;
  var y;

  if (targets.repairChain > 0) {
    goals.repairChain = 1;
  }

  if (targets.mergeMax > 0) {
    for (x = 0; x < values.length; x++) {
      for (y = 0; y < values[x].length; y++) {
        if (values[x][y] === currentMax && x + 1 < values.length && values[x + 1][y] === currentMax) {
          goals.mergeMax = 1;
        }
        if (values[x][y] === currentMax && y + 1 < values[x].length && values[x][y + 1] === currentMax) {
          goals.mergeMax = 1;
        }
      }
    }
  }

  if (targets.keepAnchor > 0 && maxTile === currentMax) {
    goals.keepAnchor = 1;
  }

  return goals;
};

AIManager.prototype.computeHumanExpertTargets = function (values, currentValues) {
  var targets = {
    repairChain: 0,
    mergeMax: 0,
    keepAnchor: 0
  };
  var maxTile = this.computeMaxTile(values);
  var currentMax = this.computeMaxTile(currentValues);
  var x;
  var y;

  if (values[values.length - 1][values.length - 1] === maxTile) {
    targets.keepAnchor = 1;
  }

  if (maxTile >= 512) {
    targets.mergeMax = 1;
  }

  for (y = 0; y < values.length; y++) {
    for (x = 0; x < values.length - 1; x++) {
      if (values[x][y] && values[x + 1][y] && values[x][y] === values[x + 1][y]) {
        targets.mergeMax = Math.max(targets.mergeMax, values[x][y] >= 512 ? 2 : 1);
      }
    }
  }

  for (y = 0; y < values.length; y++) {
    var rowValues = [];

    for (x = values.length - 1; x >= 0; x--) {
      if (values[x][y]) {
        rowValues.push(values[x][y]);
      }
    }

    for (x = 0; x < rowValues.length - 1; x++) {
      if (rowValues[x] > rowValues[x + 1] * 2) {
        targets.repairChain += 1;
      }
    }
  }

  if (currentMax !== maxTile && maxTile >= 256) {
    targets.mergeMax += 1;
  }

  return targets;
};

AIManager.prototype.getHumanExpertTargetSummary = function () {
  var currentValues = this.gameManager.getStateValues(this.gameManager.serialize());
  var targets = this.computeHumanExpertTargets(currentValues, currentValues);
  var parts = [];

  if (targets.repairChain > 0) {
    parts.push("repair chain");
  }
  if (targets.mergeMax > 0) {
    parts.push("merge max");
  }
  if (targets.keepAnchor > 0) {
    parts.push("keep anchor");
  }

  return parts.length ? parts.join(", ") : "stabilize board";
};

AIManager.prototype.getHumanExpertTargetTile = function () {
  var state = this.gameManager.serialize();
  var values = this.gameManager.getStateValues(state);
  var currentValues = this.gameManager.getStateValues(state);
  var targets = this.computeHumanExpertTargets(values, currentValues);
  var maxTile = this.computeMaxTile(values);
  var target = null;
  var x;
  var y;

  if (targets.repairChain > 0) {
    for (y = values.length - 1; y >= 0 && !target; y--) {
      for (x = values.length - 1; x >= 1; x--) {
        if (values[x][y] && values[x - 1][y] && values[x][y] !== values[x - 1][y]) {
          target = { x: x, y: y, value: Math.max(values[x][y], values[x - 1][y]) };
          break;
        }
      }
    }
  }

  if (!target && targets.mergeMax > 0) {
    for (y = values.length - 1; y >= 0 && !target; y--) {
      for (x = values.length - 1; x >= 1; x--) {
        if (values[x][y] === maxTile && values[x - 1][y] === maxTile) {
          target = { x: x, y: y, value: maxTile };
          break;
        }
      }
    }
  }

  if (!target && targets.keepAnchor > 0) {
    target = { x: values.length - 1, y: values.length - 1, value: maxTile };
  }

  return target;
};

AIManager.prototype.getHumanExpertTargetOutline = function () {
  var target = this.getHumanExpertTargetTile();

  if (!target) {
    return "";
  }

  return "target-" + target.x + "-" + target.y + "-" + target.value;
};

AIManager.prototype.computeSnakeAlignment = function (values) {
  var path = [
    [3, 3], [2, 3], [1, 3], [0, 3],
    [0, 2], [1, 2], [2, 2], [3, 2],
    [3, 1], [2, 1], [1, 1], [0, 1],
    [0, 0], [1, 0], [2, 0], [3, 0]
  ];
  var score = 0;
  var previousValue = null;

  for (var i = 0; i < path.length; i++) {
    var cell = path[i];
    var value = values[cell[0]][cell[1]] || 0;

   if (!value) {
      score += 1;
     continue;
   }

   if (previousValue === null) {
     score += this.log2(value);
     previousValue = value;
     continue;
   }

   if (value <= previousValue) {
     score += 2;
   } else {
     score -= Math.min(6, this.log2(value) - this.log2(previousValue));
   }

   previousValue = value;
  }

  return score;
};

AIManager.prototype.computeCornerAnchorPenalty = function (values, maxTile) {
  var cornerValue = values[values.length - 1][values.length - 1];

  if (cornerValue === maxTile) {
    return 0;
  }

  return maxTile - cornerValue;
};

AIManager.prototype.computeChainPressureBonus = function (values) {
  var size = values.length;
  var bonus = 0;
  var row;
  var col;

  for (row = size - 1; row >= 0; row--) {
    var rowValues = [];

    for (col = size - 1; col >= 0; col--) {
      if (values[col][row]) {
        rowValues.push(values[col][row]);
      }
    }

    if (!rowValues.length) {
      continue;
    }

    for (col = 0; col < rowValues.length - 1; col++) {
      if (rowValues[col] < rowValues[col + 1]) {
        bonus += this.log2(rowValues[col + 1]) - this.log2(rowValues[col]);
      } else if (rowValues[col] === rowValues[col + 1]) {
        bonus += this.log2(rowValues[col]);
      }
    }

    if (rowValues.length >= 2 && rowValues[0] <= rowValues[1]) {
      bonus += 2;
    }
  }

  return bonus;
};

AIManager.prototype.computeScorePotential = function (values) {
  var potential = 0;
  var x;
  var y;

  for (x = 0; x < values.length; x++) {
    for (y = 0; y < values[x].length; y++) {
      var value = values[x][y];

      if (!value) {
        continue;
      }

      if (x + 1 < values.length && values[x + 1][y] === value) {
        potential += value;
      }

      if (y + 1 < values[x].length && values[x][y + 1] === value) {
        potential += value;
      }
    }
  }

  return potential;
};

AIManager.prototype.computeBrokenChainPenalty = function (values) {
  var size = values.length;
  var penalty = 0;
  var row;
  var col;

  for (row = size - 1; row >= 0; row--) {
    var rowValues = [];

    for (col = size - 1; col >= 0; col--) {
      if (values[col][row]) {
        rowValues.push(values[col][row]);
      }
    }

    for (col = 0; col < rowValues.length - 1; col++) {
      if (rowValues[col] > rowValues[col + 1] * 2) {
        penalty += this.log2(rowValues[col]) - this.log2(rowValues[col + 1]);
      }
    }
  }

  for (col = size - 1; col >= 0; col--) {
    var columnValues = [];

    for (row = size - 1; row >= 0; row--) {
      if (values[col][row]) {
        columnValues.push(values[col][row]);
      }
    }

    for (row = 0; row < columnValues.length - 1; row++) {
      if (columnValues[row] > columnValues[row + 1] * 2) {
        penalty += this.log2(columnValues[row]) - this.log2(columnValues[row + 1]);
      }
    }
  }

  return penalty;
};

AIManager.prototype.computeChainMergeBonus = function (currentValues, nextValues, direction) {
  var size = currentValues.length;
  var bonus = 0;
  var row;
  var col;

  if (direction !== 1 && direction !== 2) {
    return 0;
  }

  for (row = size - 1; row >= 0; row--) {
    for (col = size - 1; col >= 0; col--) {
      var value = nextValues[col][row];
      if (!value) {
        continue;
      }

      if (direction === 1 && col + 1 < size && nextValues[col + 1][row] === value) {
        bonus += this.log2(value);
      }
      if (direction === 2 && row + 1 < size && nextValues[col][row + 1] === value) {
        bonus += this.log2(value);
      }
    }
  }

  for (row = size - 1; row >= 0; row--) {
    var chainRun = 0;
    for (col = size - 1; col >= 0; col--) {
      if (nextValues[col][row]) {
        chainRun += 1;
      } else {
        if (chainRun >= 3) {
          bonus += chainRun;
        }
        chainRun = 0;
      }
    }
    if (chainRun >= 3) {
      bonus += chainRun;
    }
  }

  return bonus;
};

AIManager.prototype.computeMoveRiskPenalty = function (currentValues, nextValues, direction, currentMaxTile) {
  var size = currentValues.length;
  var risk = 0;
  var x;
  var y;
  var currentCorner = currentValues[size - 1][size - 1] || 0;
  var nextCorner = nextValues[size - 1][size - 1] || 0;

  if (nextCorner < currentCorner) {
    risk += 8;
  }

  for (x = 0; x < size; x++) {
    for (y = 0; y < size; y++) {
      var value = nextValues[x][y];
      if (!value) {
        continue;
      }

      if (x !== size - 1 && value === currentMaxTile) {
        risk += 2;
      }

      if (direction === 3 && x > 0 && nextValues[x - 1][y] && nextValues[x - 1][y] > value) {
        risk += 1;
      }

      if (direction === 0 && y > 0 && nextValues[x][y - 1] && nextValues[x][y - 1] > value) {
        risk += 1;
      }
    }
  }

  return risk;
};

AIManager.prototype.computeCornerDistancePenalty = function (values, maxTile) {
  var maxPosition = null;
  var size = values.length;
  var x;
  var y;

  for (x = 0; x < size; x++) {
    for (y = 0; y < size; y++) {
      if (values[x][y] === maxTile) {
        maxPosition = { x: x, y: y };
        break;
      }
    }
    if (maxPosition) {
      break;
    }
  }

  if (!maxPosition) {
    return 0;
  }

  return Math.abs((size - 1) - maxPosition.x) + Math.abs((size - 1) - maxPosition.y);
};

AIManager.prototype.breakHumanExpertTie = function (currentDirection, candidateDirection, candidateState, currentState) {
  if (currentDirection === null || currentDirection === undefined) {
    return candidateDirection;
  }

  var currentPrimary = currentDirection === 1 || currentDirection === 2;
  var candidatePrimary = candidateDirection === 1 || candidateDirection === 2;

  if (candidatePrimary && !currentPrimary) {
    return candidateDirection;
  }
  if (currentPrimary && !candidatePrimary) {
    return currentDirection;
  }

  var currentResult = this.gameManager.simulateMove(currentState, currentDirection);
  var currentValues = this.gameManager.getStateValues(currentResult.state);
  var candidateValues = this.gameManager.getStateValues(candidateState);
  var currentMax = this.computeMaxTile(currentValues);
  var candidateMax = this.computeMaxTile(candidateValues);
  var currentCorner = currentValues[currentValues.length - 1][currentValues.length - 1] === currentMax;
  var candidateCorner = candidateValues[candidateValues.length - 1][candidateValues.length - 1] === candidateMax;

  if (candidateCorner && !currentCorner) {
    return candidateDirection;
  }
  if (currentCorner && !candidateCorner) {
    return currentDirection;
  }

  return candidateDirection < currentDirection ? candidateDirection : currentDirection;
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
