function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;
  this.simulator      = new GameSimulator;

  this.startTiles     = 2;
  this.aiEnabled      = false;
  this.aiStatus       = "AI stopped";
  this.aiManager      = null;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("toggleAI", this.toggleAI.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  if (this.aiManager) {
    this.aiManager.stop();
  }

  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

GameManager.prototype.setAIManager = function (aiManager) {
  this.aiManager = aiManager;
};

GameManager.prototype.toggleAI = function () {
  if (this.aiManager) {
    this.aiManager.toggle();
  }
};

GameManager.prototype.setAiStatus = function (enabled, status) {
  this.aiEnabled = enabled;
  this.aiStatus = status;
  this.actuate();
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated(),
    aiEnabled:  this.aiEnabled,
    aiStatus:   this.aiStatus
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

GameManager.prototype.availableCellsFromState = function (state) {
  return this.simulator.availableCells(state);
};

GameManager.prototype.addTileToState = function (state, cell, value) {
  return this.simulator.addTile(state, cell, value);
};

GameManager.prototype.getStateValues = function (state) {
  return this.simulator.getValues(state);
};

GameManager.prototype.simulateMove = function (state, direction) {
  var nextState = this.simulator.cloneState(state);
  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;
  var self = this;

  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      var cell = { x: x, y: y };
      var tile = self.getStateCellContent(nextState, cell);

      if (!tile) {
        return;
      }

      var positions = self.findFarthestStatePosition(nextState, cell, vector);
      var next = self.getStateCellContent(nextState, positions.next);

      if (next && next.value === tile.value && !next.merged) {
        nextState.grid.cells[positions.next.x][positions.next.y] = {
          position: { x: positions.next.x, y: positions.next.y },
          value: tile.value * 2,
          merged: true
        };
        nextState.grid.cells[cell.x][cell.y] = null;
        nextState.score += tile.value * 2;

        if (tile.value * 2 === 2048) {
          nextState.won = true;
        }

        moved = true;
      } else if (!self.positionsEqual(cell, positions.farthest)) {
        nextState.grid.cells[positions.farthest.x][positions.farthest.y] = {
          position: { x: positions.farthest.x, y: positions.farthest.y },
          value: tile.value
        };
        nextState.grid.cells[cell.x][cell.y] = null;
        moved = true;
      }
    });
  });

  self.clearStateMergeFlags(nextState);
  nextState.over = moved ? !self.movesAvailableFromState(nextState) : nextState.over;

  return {
    moved: moved,
    state: nextState
  };
};

GameManager.prototype.getStateCellContent = function (state, cell) {
  if (this.withinBounds(cell, state.grid.size)) {
    return state.grid.cells[cell.x][cell.y];
  }

  return null;
};

GameManager.prototype.findFarthestStatePosition = function (state, cell, vector) {
  var previous;

  do {
    previous = cell;
    cell = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.withinBounds(cell, state.grid.size) &&
           !this.getStateCellContent(state, cell));

  return {
    farthest: previous,
    next: cell
  };
};

GameManager.prototype.movesAvailableFromState = function (state) {
  return this.availableCellsFromState(state).length || this.tileMatchesAvailableFromState(state);
};

GameManager.prototype.tileMatchesAvailableFromState = function (state) {
  for (var x = 0; x < state.grid.size; x++) {
    for (var y = 0; y < state.grid.size; y++) {
      var tile = this.getStateCellContent(state, { x: x, y: y });

      if (!tile) {
        continue;
      }

      for (var direction = 0; direction < 4; direction++) {
        var vector = this.getVector(direction);
        var other = this.getStateCellContent(state, { x: x + vector.x, y: y + vector.y });

        if (other && other.value === tile.value) {
          return true;
        }
      }
    }
  }

  return false;
};

GameManager.prototype.clearStateMergeFlags = function (state) {
  for (var x = 0; x < state.grid.size; x++) {
    for (var y = 0; y < state.grid.size; y++) {
      if (state.grid.cells[x][y]) {
        delete state.grid.cells[x][y].merged;
      }
    }
  }
};

GameManager.prototype.withinBounds = function (position, size) {
  var limit = size || this.size;
  return position.x >= 0 && position.x < limit &&
         position.y >= 0 && position.y < limit;
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
