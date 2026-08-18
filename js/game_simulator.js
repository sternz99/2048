function GameSimulator() {}

GameSimulator.prototype.cloneState = function (state) {
  return JSON.parse(JSON.stringify(state));
};

GameSimulator.prototype.availableCells = function (state) {
  var cells = [];

  for (var x = 0; x < state.grid.size; x++) {
    for (var y = 0; y < state.grid.size; y++) {
      if (!state.grid.cells[x][y]) {
        cells.push({ x: x, y: y });
      }
    }
  }

  return cells;
};

GameSimulator.prototype.addTile = function (state, cell, value) {
  var nextState = this.cloneState(state);

  nextState.grid.cells[cell.x][cell.y] = {
    position: { x: cell.x, y: cell.y },
    value: value
  };

  return nextState;
};

GameSimulator.prototype.getValues = function (state) {
  var values = [];

  for (var x = 0; x < state.grid.size; x++) {
    values[x] = [];
    for (var y = 0; y < state.grid.size; y++) {
      values[x][y] = state.grid.cells[x][y] ? state.grid.cells[x][y].value : 0;
    }
  }

  return values;
};
