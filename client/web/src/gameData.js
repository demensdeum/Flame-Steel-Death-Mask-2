export class GameData {
    constructor() {
        this._order = "";
        this._name = "";
        this.playerServerGeolocationPosition = null;
        this.playerClientGeolocationPosition = null;
        this._balance = 0;
        this.message = "No message";
        this.model = "DEFAULT";
        this.isZonesViewEnabled = true;
        this.isLocationResolvedOnce = () => {
            return this.playerClientGeolocationPosition != null;
        };
    }
    set order(value) {
        this._order = value;
        this.delegate?.gameDataDidChangeOrder(this, this._order);
    }
    get order() {
        return this._order;
    }
    set name(value) {
        this._name = value;
        this.delegate?.gameDataDidChangeName(this, this._name);
    }
    get name() {
        return this._name;
    }
    set balance(value) {
        this._balance = value;
        this.delegate?.gameDataDidChangeBalance(this, this._balance);
    }
    get balance() {
        return this._balance;
    }
    geolocationPositionIsInSync() {
        if (!this.playerClientGeolocationPosition || !this.playerServerGeolocationPosition) {
            return false;
        }
        else {
            return this.playerServerGeolocationPosition.near(this.playerClientGeolocationPosition);
        }
    }
}
