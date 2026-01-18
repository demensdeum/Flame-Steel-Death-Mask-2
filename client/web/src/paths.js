export class Paths {
    static modelPath(name) {
        return "./" + this.assetsDirectory + "/" + name + this.modelSuffix + this.modelExtension;
    }
    static texturePath(name) {
        return "./" + this.assetsDirectory + "/" + name + this.textureSuffix + this.textureExtension;
    }
    static environmentPath(name) {
        return name + this.skyboxEnvironmentSuffix + this.skyboxEnvironmentExtension;
    }
    static skyboxFrontTexturePath(name) {
        return name + ".skybox.front";
    }
    static skyboxBackTexturePath(name) {
        return name + ".skybox.back";
    }
    static skyboxTopTexturePath(name) {
        return name + ".skybox.top";
    }
    static skyboxBottomTexturePath(name) {
        return name + ".skybox.bottom";
    }
    static skyboxLeftTexturePath(name) {
        return name + ".skybox.left";
    }
    static skyboxRightTexturePath(name) {
        return name + ".skybox.right";
    }
}
Paths.assetsDirectory = "";
Paths.textureExtension = "jpg";
Paths.modelExtension = "glb";
Paths.skyboxEnvironmentExtension = "hdr";
Paths.modelSuffix = ".model.";
Paths.textureSuffix = ".texture.";
Paths.skyboxEnvironmentSuffix = ".skybox.environment.";
