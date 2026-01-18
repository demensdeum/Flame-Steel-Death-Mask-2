import { CompanyLogoState } from "./companyLogoState.js";
import { Context } from "./context.js";
import { InGameState } from "./inGameState.js";
function main(options = {}) {
    const debugEnabled = options["debugEnabled"] === "true";
    const context = new Context(debugEnabled);
    const companyLogoState = new CompanyLogoState("CompanyLogo", context);
    context.start(companyLogoState);
    const inGameState = new InGameState("InGame", context);
    context.start(inGameState);
    function step() {
        if (!context.isRunning) {
            return;
        }
        context.step();
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}
main();
