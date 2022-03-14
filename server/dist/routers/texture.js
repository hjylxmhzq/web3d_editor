"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const router_1 = __importDefault(require("../utils/router"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const textureType = {
    'albedo': 'albedo',
    'ao': 'ao',
    'height': 'displace',
    'roughness': 'roughness',
    'normal': 'normal',
    'emissive': 'emissive',
    'metallic': 'metalness',
    'alpha': 'alpha',
};
router_1.default.get('/gettextures', async (ctx, next) => {
    const texturePath = path_1.default.join(__dirname, '../../resources/textures');
    const files = await fs_extra_1.default.readdir(texturePath);
    const textures = [];
    for (let file of files) {
        for (let key of Object.keys(textureType)) {
            if (file.includes(key)) {
                textures.push({
                    type: textureType[key],
                    filename: file,
                });
            }
        }
    }
    ctx.body = JSON.stringify(textures);
    await next();
});
//# sourceMappingURL=texture.js.map