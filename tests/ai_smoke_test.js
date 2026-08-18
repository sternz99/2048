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
  testNoLegalMoveReturnsNull();
  testAIMoveDoesNotPauseItself();
  console.log("ai smoke tests passed");
}

run();
