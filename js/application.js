// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  var gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
  var aiManager = new AIManager(gameManager);

  gameManager.setAIManager(aiManager);
});
