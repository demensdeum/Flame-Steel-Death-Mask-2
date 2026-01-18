import { State } from "./state.js";
import { Utils } from "./utils.js";
export class CompanyLogoState extends State {
    constructor() {
        super(...arguments);
        this.switchMillisecondsTimeout = 2069;
        this.startDate = new Date();
    }
    initialize() {
    }
    step() {
        console.log("companyLogoState step");
    }
}
