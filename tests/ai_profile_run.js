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

function createHarness(seed) {
  const elements = {};
  const seededMath = Object.create(Math);
  let randomState = seed >>> 0;

  seededMath.random = function () {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

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
    Math: seededMath,
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
  context.window.Math = seededMath;
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

function getGridMaxTile(grid) {
  let maxTile = 0;
  for (let x = 0; x < grid.size; x++) {
    for (let y = 0; y < grid.size; y++) {
      const tile = grid.cells[x][y];
      if (tile) {
        maxTile = Math.max(maxTile, tile.value);
      }
    }
  }
  return maxTile;
}

function runGame(depth, label, speed, strategy, heuristicBias, seed, maxMoves) {
  const context = createHarness(seed);
  const gameManager = new context.GameManager(
    4,
    context.KeyboardInputManager,
    context.HTMLActuator,
    context.LocalStorageManager
  );
  const aiManager = new context.AIManager(gameManager);
  if (speed) {
    aiManager.speed = speed;
  }
  if (strategy) {
    aiManager.setStrategy(strategy);
  }
  if (heuristicBias) {
    aiManager.setConfig({ heuristicBias: heuristicBias });
  }
  gameManager.setAIManager(aiManager);

  let moveCount = 0;
  const start = Date.now();

  while (!gameManager.isGameTerminated() && moveCount < maxMoves) {
    const bestMove = aiManager.findBestMove(depth);
    if (bestMove === null || bestMove === undefined) {
      break;
    }

    gameManager.move(bestMove);
    moveCount += 1;
  }

  const elapsed = Date.now() - start;
  const maxTile = getGridMaxTile(gameManager.grid);

  return {
    label: label,
    moves: moveCount,
    score: gameManager.score,
    maxTile: maxTile,
    elapsedMs: elapsed,
    speed: speed || "normal",
    strategy: strategy || aiManager.strategy,
    heuristicBias: heuristicBias || aiManager.settings.heuristicBias,
    seed: seed
  };
}

function runProfile() {
  const runCount = Number(process.argv[2] || 8);
  const depth = Number(process.argv[3] || 2);
  const requestedSpeed = (process.argv[4] || "all").toLowerCase();
  const requestedStrategy = (process.argv[5] || "all").toLowerCase();
  const heuristicBias = Number(process.argv[6] || 1);
  const seed = Number(process.argv[7] || 2048);
  const maxMoves = Number(process.argv[8] || 160);
  const speeds = requestedSpeed === "all" ? ["slow", "normal", "fast"] : [requestedSpeed];
  const strategies = requestedStrategy === "all" ? ["heuristic", "expectimax"] : [requestedStrategy];
  const results = [];

  strategies.forEach(function (strategy) {
    speeds.forEach(function (speed) {
      let totalMoves = 0;
      let totalScore = 0;
      let totalElapsed = 0;
      let maxMaxTile = 0;

      for (let i = 0; i < runCount; i++) {
        const result = runGame(
          depth,
          strategy + "-" + speed + "-run-" + (i + 1),
          speed,
          strategy,
          heuristicBias,
          seed + i,
          maxMoves
        );
        results.push(result);
        totalMoves += result.moves;
        totalScore += result.score;
        totalElapsed += result.elapsedMs;
        maxMaxTile = Math.max(maxMaxTile, result.maxTile);
      }

      const summary = {
        strategy: strategy,
        speed: speed,
        runs: runCount,
        depth: depth,
        heuristicBias: heuristicBias,
        seed: seed,
        maxMoves: maxMoves,
        averageMoves: (totalMoves / runCount).toFixed(1),
        averageScore: (totalScore / runCount).toFixed(1),
        averageMs: (totalElapsed / runCount).toFixed(1),
        maxTileReached: maxMaxTile
      };

      console.log("AI profile summary for " + strategy + " / " + speed);
      console.log(JSON.stringify(summary, null, 2));
    });
  });

  if (requestedSpeed === "all" && requestedStrategy === "all") {
    console.log("AI profile comparison complete");
  }
}

runProfile();
