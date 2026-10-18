/* Дурокер — запуск */
'use strict';
bindUI();
startBackground();
requestAnimationFrame(tickTimer);
newGame();
/* первый визит — сразу предложить выбрать соперника */
if (!load('durocker-bot')) openBots();
