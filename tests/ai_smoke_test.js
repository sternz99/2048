const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createElement(name) {
  return {
    name: name,
    textContent: "",
    children: [],
    classList: {
      add: function () {},
      remove: function () {}
    },
    setAttribute: function () {},
    appendChild: function (child) {
      this.children.push(child);
      this.firstChild = this.children[0] || null;
    },
    removeChild: function () {
      this.children.shift();
      this.firstChild = this.children[0] || null;
    },
    getElementsByTagName: function () {
      return [{ textContent: "" }];
    },
    addEventListener: function () {},
    firstChild: null
  };
}

function createHarness() {
  const elements = {};
  const document = {
    querySelector: function (selector) {
      if (!elements[selector]) {
        elements[selector] = createElement(selector);
      }
      return elements[selector];
    },
    getElementsByClassName: function (name) {
      return [this.querySelector("." + name)];
    },
    createElement: function (tag) {
      return createElement(tag + ":" + Math.random());
    },
    addEventListener: function () {}
  };
  const context = {
    console: console,
    JSON: JSON,
    Math: Math,
    Date: Date,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    document: document,
    window: {
      requestAnimationFrame: function (fn) { fn(); },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      localStorage: {
        _data: {},
        setItem: function (key, value) { this._data[key] = String(value); },
        getItem: function (key) { return this._data[key]; },
        removeItem: function (key) { delete this._data[key]; }
      },
      navigator: {}
    }
  };

  context.window.document = document;
  context.window.window = context.window;
  context.window.console = console;
  context.window.Math = Math;
  context.window.JSON = JSON;
  vm.createContext(context);

  [
    "js/tile.js",
    "js/grid.js",
    "js/local_storage_manager.js",
    "js/keyboard_input_manager.js",
    "js/html_actuator.js",
    "js/game_simulator.js",
    "js/game_manager.js",
    "js/ai_manager.js"
  ].forEach(function (file) {
    const code = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    vm.runInContext(code, context, { filename: file });
  });

  return context;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createState(cells, score) {
  return {
    grid: {
      size: 4,
      cells: cells
    },
    score: score || 0,
    over: false,
    won: false,
    keepPlaying: false
  };
}

function createEmptyCells() {
  const cells = [];
  for (let x = 0; x < 4; x++) {
    cells[x] = [];
    for (let y = 0; y < 4; y++) {
      cells[x][y] = null;
    }
  }
  return cells;
}

function tile(x, y, value) {
  return {
    position: { x: x, y: y },
    value: value
  };
}

function testSimulateMoveMerge() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const cells = createEmptyCells();
  cells[0][0] = tile(0, 0, 2);
  cells[1][0] = tile(1, 0, 2);
  const result = gameManager.simulateMove(createState(cells, 0), 3);

  assert(result.moved, "expected merge move to be legal");
  assert(result.state.grid.cells[0][0].value === 4, "expected merge result in leftmost cell");
  assert(result.state.grid.cells[1][0] === null, "expected merged source cell to be cleared");
  assert(result.state.score === 4, "expected merged score increase");
}

function testAddTileDoesNotMutateOriginal() {
  const context = createHarness();
  const simulator = new context.GameSimulator();
  const cells = createEmptyCells();
  const state = createState(cells, 0);
  const nextState = simulator.addTile(state, { x: 2, y: 1 }, 4);

  assert(state.grid.cells[2][1] === null, "expected original state to stay unchanged");
  assert(nextState.grid.cells[2][1].value === 4, "expected cloned state to receive new tile");
}

function testExpectimaxFindsLegalMove() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  aiManager.setStrategy("expectimax");
  const move = aiManager.findBestMove(3);

  assert([0, 1, 2, 3].indexOf(move) !== -1, "expected expectimax to return a legal direction");
}

function testHeuristicStrategyFindsLegalMove() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  aiManager.setStrategy("heuristic");
  const move = aiManager.findBestMove(1);

  assert([0, 1, 2, 3].indexOf(move) !== -1, "expected heuristic strategy to return a legal direction");
  assert(aiManager.getStrategyLabel() === "Greedy Heuristic", "expected heuristic to report Greedy Heuristic");
}

function testHumanExpertStrategyFindsLegalMove() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  aiManager.setStrategy("humanExpert");
  const move = aiManager.findBestMove(1);

  assert([0, 1, 2, 3].indexOf(move) !== -1, "expected human expert strategy to return a legal direction");
  assert(aiManager.getStrategyLabel() === "Human Expert", "expected human expert to report Human Expert");
}

function testHumanExpertAvoidsForbiddenMoveWhenAlternativesExist() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [16, 8, 4, 2],
    [32, 16, 8, 4],
    [64, 32, 16, 8],
    [0, 0, 0, 0]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x]) {
        cells[x][y] = tile(x, y, rows[y][x]);
      }
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  aiManager.setStrategy("humanExpert");
  const move = aiManager.findBestMove(1);

  assert(move !== 0, "expected human expert to avoid Up when safer alternatives exist");
}

function testHumanExpertKeepsMaxTileAnchored() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [2, 4, 8, 16],
    [4, 8, 16, 32],
    [8, 16, 32, 64],
    [128, 256, 512, 1024]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      cells[x][y] = tile(x, y, rows[y][x]);
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  aiManager.setStrategy("humanExpert");
  const move = aiManager.findBestMove(1);

  assert(move !== 3, "expected human expert to avoid pulling the max tile away from the anchored corner");
}

function testHumanExpertPrefersBottomRowChainPressure() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [2, 4, 8, 16],
    [4, 8, 16, 32],
    [64, 128, 256, 512],
    [2, 2, 4, 8]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      cells[x][y] = tile(x, y, rows[y][x]);
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  aiManager.setStrategy("humanExpert");
  const move = aiManager.findBestMove(1);

  assert(move === 1 || move === 2, "expected human expert to favor a chain-friendly move over drifting the third row");
}

function testHumanExpertRepairsBrokenSnakeChain() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [2, 4, 8, 16],
    [4, 8, 16, 32],
    [64, 2, 128, 256],
    [2, 4, 8, 16]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      cells[x][y] = tile(x, y, rows[y][x]);
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  aiManager.setStrategy("humanExpert");
  const move = aiManager.findBestMove(1);

  assert(move !== 0, "expected human expert to prioritize repairing a broken snake chain");
}

function testHumanExpertRewardsImmediateScorePotential() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [2, 2, 8, 16],
    [4, 8, 16, 32],
    [8, 16, 32, 64],
    [128, 256, 512, 1024]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      cells[x][y] = tile(x, y, rows[y][x]);
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  aiManager.setStrategy("humanExpert");
  const move = aiManager.findBestMove(1);

  assert(move === 1 || move === 3 || move === 2, "expected human expert to keep score-producing merges in play");
}

function testHumanExpertComputesPriorityTargets() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [2, 4, 8, 16],
    [4, 8, 16, 32],
    [64, 2, 128, 256],
    [2, 4, 8, 16]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      cells[x][y] = tile(x, y, rows[y][x]);
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  const targets = aiManager.computeHumanExpertTargets(gameManager.getStateValues(gameManager.serialize()), gameManager.getStateValues(gameManager.serialize()));

  assert(targets.repairChain > 0, "expected broken chain state to raise repair target priority");
}

function testHumanExpertTargetWeightsPreferRepairChain() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const weights = aiManager.computeHumanExpertTargetWeights({ repairChain: 2, mergeMax: 1, keepAnchor: 1 });

  assert(weights.repairChain > weights.mergeMax, "expected repair chain to have the highest target weight");
}

function testHumanExpertRunningLabelIncludesTargets() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  aiManager.setStrategy("humanExpert");
  const label = aiManager.getAiRunningLabel(2);

  assert(label.indexOf("targets:") !== -1, "expected running label to include target summary");
}

function testActuatorShowsAIStatusText() {
  const context = createHarness();
  const actuator = new context.HTMLActuator();
  const status = context.document.querySelector(".ai-status");
  const button = context.document.querySelector(".ai-button");

  actuator.updateAI(true, "AI running (Human Expert; targets: repair chain; depth 2)");

  assert(button.textContent === "AI running ...", "expected AI button to keep the generic running label");
  assert(status.textContent.indexOf("targets:") !== -1, "expected AI status label to show the running label");
}

function testGameManagerKeepsDetailedAiStatus() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  gameManager.setAIManager(aiManager);

  gameManager.setAiStatus(true, "AI running (Human Expert; targets: repair chain; depth 2)");

  assert(gameManager.aiStatus.indexOf("targets:") !== -1, "expected game manager to preserve detailed AI status");
}

function testAiStatusStaysSingleLine() {
  const context = createHarness();
  const actuator = new context.HTMLActuator();
  const status = context.document.querySelector(".ai-status");

  actuator.updateAI(true, "AI running (Human Expert; targets: repair chain, merge max; depth 2)");

  assert(status.textContent.indexOf("\n") === -1, "expected AI status text to remain on one line");
}

function testHeuristicBiasChangesMovePreference() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [0, 256, 0, 512],
    [0, 256, 8, 8],
    [128, 0, 0, 4],
    [0, 2, 16, 8]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x]) {
        cells[x][y] = tile(x, y, rows[y][x]);
      }
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  gameManager.score = 8192;
  aiManager.setStrategy("heuristic");
  aiManager.setConfig({ heuristicBias: 0.5 });
  const immediateScoreMove = aiManager.findBestMove(1);
  aiManager.setConfig({ heuristicBias: 2 });
  const boardQualityMove = aiManager.findBestMove(1);
  const immediateResult = gameManager.simulateMove(gameManager.serialize(), immediateScoreMove);
  const qualityResult = gameManager.simulateMove(gameManager.serialize(), boardQualityMove);

  assert(immediateScoreMove === 0, "expected low bias to prefer the immediate high-value merge");
  assert(boardQualityMove === 1, "expected high bias to prefer the higher-potential board");
  assert(immediateResult.state.score > qualityResult.state.score, "expected the low-bias move to gain more immediate score");
  assert(
    aiManager.computeMergePotential(gameManager.getStateValues(qualityResult.state)) >
      aiManager.computeMergePotential(gameManager.getStateValues(immediateResult.state)),
    "expected the high-bias move to preserve more merge potential"
  );
}

function testLateGameProgressEmphasizesBoardStructure() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  const cells = createEmptyCells();
  const rows = [
    [64, 0, 64, 0],
    [16, 64, 256, 32],
    [0, 2, 0, 0],
    [0, 0, 0, 1024]
  ];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x]) {
        cells[x][y] = tile(x, y, rows[y][x]);
      }
    }
  }

  gameManager.grid = new context.Grid(4, cells);
  aiManager.setStrategy("heuristic");
  gameManager.score = 0;
  const earlyMove = aiManager.findBestMove(1);
  gameManager.score = 18432;
  const lateMove = aiManager.findBestMove(1);
  const lateResult = gameManager.simulateMove(gameManager.serialize(), lateMove);

  assert(earlyMove === 2, "expected early play to prefer the immediate board shape");
  assert(lateMove === 1, "expected late play to preserve the higher-ceiling position");
  assert(
    gameManager.availableCellsFromState(lateResult.state).length === 9,
    "expected the late-game move to create additional board space"
  );
}

function testConfigurableStrategySettings() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);

  aiManager.setConfig({ heuristicBias: 1.7, expectimaxDepth: 3 });

  assert(aiManager.settings.heuristicBias === 1.7, "expected heuristic bias to update");
  assert(aiManager.settings.expectimaxDepth === 3, "expected expectimax depth to update");
}

function testRangeOutputDisplaysCurrentValue() {
  const context = createHarness();
  const keyboardInputManager = new context.KeyboardInputManager();

  const heuristicInput = context.document.querySelector("#ai-heuristic-bias");
  heuristicInput.id = "ai-heuristic-bias";
  heuristicInput.value = "1.7";
  keyboardInputManager.updateRangeOutput(heuristicInput, "heuristicBias");

  const depthInput = context.document.querySelector("#ai-expectimax-depth");
  depthInput.id = "ai-expectimax-depth";
  depthInput.value = "3";
  keyboardInputManager.updateRangeOutput(depthInput, "expectimaxDepth");

  const heuristicOutput = context.document.querySelector("output[for='ai-heuristic-bias']");
  const depthOutput = context.document.querySelector("output[for='ai-expectimax-depth']");

  assert(heuristicOutput.textContent === "1.7x", "expected heuristic slider output to show the current value");
  assert(depthOutput.textContent === "3", "expected depth slider output to show the current value");
}

function testHumanExpertStrategyPersistsAcrossSettingsLoad() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );

  gameManager.storageManager.setAISettings({
    strategy: "humanExpert",
    speed: "fast",
    autoRestart: true,
    heuristicBias: 1.4,
    expectimaxDepth: 3,
    controlsCollapsed: false
  });

  gameManager.loadAISettings();

  assert(gameManager.aiSettings.strategy === "humanExpert", "expected human expert strategy to load from storage");
}

function testAutoRestartResumesOnReload() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  gameManager.setAIManager(aiManager);
  gameManager.storageManager.setAISettings({
    strategy: "humanExpert",
    speed: "normal",
    autoRestart: true,
    heuristicBias: 1,
    expectimaxDepth: 2,
    controlsCollapsed: false
  });
  gameManager.storageManager.setGameState({
    grid: { size: 4, cells: (function () {
      const cells = [];
      for (let x = 0; x < 4; x++) {
        cells[x] = [];
        for (let y = 0; y < 4; y++) {
          cells[x][y] = null;
        }
      }
      cells[3][3] = { position: { x: 3, y: 3 }, value: 1024 };
      return cells;
    })() },
    score: 0,
    over: false,
    won: false,
    keepPlaying: false
  });

  aiManager.start = function () {
    this.running = true;
  };
  gameManager.setup();

  assert(aiManager.running === true, "expected AI to resume after reload when auto-restart is enabled");
}

function testAutoRestartWhenGameEnds() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);

  gameManager.setAIManager(aiManager);
  aiManager.running = true;
  aiManager.setAutoRestart(true);

  let restarted = 0;
  const originalRestart = gameManager.restart.bind(gameManager);
  gameManager.restart = function () {
    restarted += 1;
    originalRestart();
  };

  gameManager.over = true;
  aiManager.step();

  assert(restarted === 1, "expected AI to restart the game when auto-restart is enabled");
  assert(aiManager.running === true, "expected AI to resume after auto-restarting");
  aiManager.stop();
}

function testStaleActuateDoesNotReshowGameOver() {
  const context = createHarness();
  const queue = [];
  context.window.requestAnimationFrame = function (fn) {
    queue.push(fn);
  };

  const actuator = new context.HTMLActuator();
  const message = context.document.querySelector(".game-message");
  const addedClasses = [];
  message.classList = {
    add: function (className) {
      addedClasses.push(className);
    },
    remove: function () {}
  };

  actuator.actuate(new context.Grid(4), {
    score: 0,
    over: true,
    won: false,
    bestScore: 0,
    terminated: true,
    aiEnabled: false,
    aiStatus: "AI stopped"
  });

  actuator.continueGame();
  actuator.actuate(new context.Grid(4), {
    score: 0,
    over: false,
    won: false,
    bestScore: 0,
    terminated: false,
    aiEnabled: false,
    aiStatus: "AI stopped"
  });

  queue.forEach(function (fn) {
    fn();
  });

  assert(addedClasses.indexOf("game-over") === -1, "expected stale game-over render to be ignored after restart");
}

function testNoLegalMoveReturnsNull() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);

  const noMoveBoard = [
    [tile(0, 0, 2), tile(1, 0, 4), tile(2, 0, 2), tile(3, 0, 4)],
    [tile(0, 1, 4), tile(1, 1, 2), tile(2, 1, 4), tile(3, 1, 2)],
    [tile(0, 2, 2), tile(1, 2, 4), tile(2, 2, 2), tile(3, 2, 4)],
    [tile(0, 3, 4), tile(1, 3, 2), tile(2, 3, 4), tile(3, 3, 2)]
  ];

  const state = createState(noMoveBoard, 0);
  gameManager.grid = new context.Grid(4, noMoveBoard);
  const move = aiManager.findBestMove(2);

  assert(move === null || move === undefined, "expected no legal moves to be treated as terminal state");
  assert(typeof aiManager.expectimaxMove(state, 2) === "number", "expected terminal board evaluation to still return a numeric score");
}

function testAIMoveDoesNotPauseItself() {
  const context = createHarness();
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);

  gameManager.setAIManager(aiManager);
  aiManager.running = true;
  aiManager.setAiStatus = function () {};

  gameManager.move(1, true);

  assert(aiManager.running === true, "expected AI to remain running after its own move");
}

function run() {
  testSimulateMoveMerge();
  testAddTileDoesNotMutateOriginal();
  testExpectimaxFindsLegalMove();
  testHeuristicStrategyFindsLegalMove();
  testHumanExpertStrategyFindsLegalMove();
  testHumanExpertAvoidsForbiddenMoveWhenAlternativesExist();
  testHumanExpertKeepsMaxTileAnchored();
  testHumanExpertPrefersBottomRowChainPressure();
  testHumanExpertRepairsBrokenSnakeChain();
  testHumanExpertRewardsImmediateScorePotential();
  testHumanExpertComputesPriorityTargets();
  testHumanExpertRunningLabelIncludesTargets();
  testActuatorShowsAIStatusText();
  testGameManagerKeepsDetailedAiStatus();
  testAiStatusStaysSingleLine();
  testHumanExpertTargetWeightsPreferRepairChain();
  testHeuristicBiasChangesMovePreference();
  testLateGameProgressEmphasizesBoardStructure();
  testConfigurableStrategySettings();
  testRangeOutputDisplaysCurrentValue();
  testHumanExpertStrategyPersistsAcrossSettingsLoad();
  testAutoRestartResumesOnReload();
  testAutoRestartWhenGameEnds();
  testStaleActuateDoesNotReshowGameOver();
  testNoLegalMoveReturnsNull();
  testAIMoveDoesNotPauseItself();
  console.log("ai smoke tests passed");
}

run();
