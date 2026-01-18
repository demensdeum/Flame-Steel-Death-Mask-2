import { localizedStrings } from "./localizedStrings.js";
export class Translator {
    constructor() {
        this.locale = "en";
    }
    translatedStringForKey(key) {
        if (!(this.locale in localizedStrings)) {
            return `No locale: "${this.locale}" - key: "${key}"`;
        }
        if (!(key in localizedStrings[this.locale])) {
            return `No key: "${key}" - locale: "${this.locale}"`;
        }
        const output = localizedStrings[this.locale][key];
        return output;
    }
}
