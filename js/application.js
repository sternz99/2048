// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  var gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
  var aiManager = new AIManager(gameManager);

  window.gameManager = gameManager;
  window.aiManager = aiManager;
  gameManager.setAIManager(aiManager);
  gameManager.applyAISettingsToManager(aiManager);
  gameManager.applyAISettingsToUI();

  if (gameManager.aiSettings.autoRestart && gameManager.storageManager.getGameState()) {
    aiManager.start();
  }
});
