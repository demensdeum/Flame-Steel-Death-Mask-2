export class GameVector3 {
    static zero() {
        return new GameVector3(0, 0, 0);
    }
    static zeroBut({ x = 0, y = 0, z = 0 }) {
        return new GameVector3(x, y, z);
    }
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    movedVector(toPosition, speed) {
        const directionVector = toPosition.subtract(this);
        const normalizedDirection = directionVector.normalize();
        const step = normalizedDirection.multiply(speed);
        const distanceToTarget = this.distanceTo(toPosition);
        if (distanceToTarget <= step.length()) {
            return toPosition;
        }
        const newPosition = this.add(step);
        return newPosition;
    }
    populate(sourceVector) {
        this.x = sourceVector.x;
        this.y = sourceVector.y;
        this.z = sourceVector.z;
    }
    add(otherVector) {
        return new GameVector3(this.x + otherVector.x, this.y + otherVector.y, this.z + otherVector.z);
    }
    subtract(otherVector) {
        return new GameVector3(this.x - otherVector.x, this.y - otherVector.y, this.z - otherVector.z);
    }
    multiply(scalar) {
        return new GameVector3(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    distanceTo(otherVector) {
        const dx = otherVector.x - this.x;
        const dy = otherVector.y - this.y;
        const dz = otherVector.z - this.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    length() {
        return Math.sqrt(this.x * this.x +
            this.y * this.y +
            this.z * this.z);
    }
    normalize() {
        const length = Math.sqrt(this.x *
            this.x +
            this.y *
                this.y +
            this.z *
                this.z);
        if (length === 0) {
            return new GameVector3(0, 0, 0);
        }
        return new GameVector3(this.x / length, this.y / length, this.z / length);
    }
    clone() {
        return new GameVector3(this.x, this.y, this.z);
    }
    printable() {
        return `x: ${this.x} | y: ${this.y} | z: ${this.z}`;
    }
}
