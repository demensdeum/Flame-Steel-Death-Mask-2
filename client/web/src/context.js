import { SceneController } from './sceneController.js';
import { IdleState } from './idleState.js';
import { GameData } from './gameData.js';
import { Translator } from './translator.js';
import { SoundPlayer } from './soundPlayer.js';
import { GameSettings } from './gameSettings.js';
import { debugPrint } from './runtime.js';
import { Terminal } from './terminal.js';
import { NavigationController } from './navigationController.js';
import { MinimapController } from './minimapController.js';

export class Context {

    constructor(debugEnabled) {
        this.isRunning = false;
        this.translator = new Translator();
        this.canvas = document.querySelector("canvas");
        this.soundPlayer = new SoundPlayer(0.7);
        this.debugEnabled = debugEnabled;
        this.gameData = new GameData();
        this.state = new IdleState("Idle State", this);
        if (!this.canvas || this.canvas == undefined) {
            this.raiseCriticalError("1Canvas in NULL!!!!");
        }
        const canvas = this.canvas;
        const gameSettings = GameSettings.default();
        this.sceneController = new SceneController(canvas, false, gameSettings, false);
        this.terminal = new Terminal(this);
        this.navigationController = new NavigationController(this);
        this.minimapController = new MinimapController(this);




        debugPrint("Game Context Initialized...");
    }
    start(state) {
        this.state = state;
        this.isRunning = true;
        this.transitionTo(this.state);
    }
    raiseCriticalError(error) {
        if (this.debugEnabled) {
            console.error(error);
        }
        else {
            alert(error);
        }
        this.isRunning = false;
    }
    transitionTo(state) {
        debugPrint(`Transitioning to ${state.name}`);
        this.state = state;
        this.state.initialize();
    }
    step() {
        this.state.step();
        this.sceneController.step();
    }
}
