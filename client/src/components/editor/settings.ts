
type Watcher = (oldValue: any, newValue: any) => void;

let targetWatcher: Watcher | null = null;

export function makeReactive(obj: any) {

    if (!(obj instanceof Object) || obj === null) {
        return obj;
    }

    const depMap = new Map<any, Watcher[]>();

    for (let key of Object.keys(obj)) {
        depMap.set(key, []);
        obj[key] = makeReactive(obj[key]);
    }

    const proxy = new Proxy(obj, {
        set(target, key, value) {
            const oldValue = target[key];
            if (oldValue === value) {
                return true;
            }
            target[key] = value;
            let watchers = depMap.get(key);
            if (!watchers) {
                watchers = [];
                depMap.set(key, watchers);
            }
            watchers.forEach(watcher => {
                watcher(oldValue, value);
            });
            return true;
        },
        get(target, key) {
            if (targetWatcher) {
                depMap.get(key)?.push(targetWatcher);
            }
            return target[key];
        },
        deleteProperty(target, key) {
            delete target[key];
            depMap.delete(key);
            return true;
        }
    });

    return proxy;

}

export function observe(fn: () => void, watcher: (oldValue: any, newValue: any) => void) {

    targetWatcher = watcher;
    fn();
    targetWatcher = null;

}

export function saveSettingToLocalStorage() {

    localStorage.setItem('settings',
        JSON.stringify(
            sceneSettingsReactive,
            (key, value) => {
                return ignoreKey.indexOf(key) !== -1 ? undefined : value;
            }
        )
    );

}

export function restoreSettingFromLocalStorage() {

    const settingStr = localStorage.getItem('settings');
    if (settingStr) {
        const settings = JSON.parse(settingStr);
        if (settings.version === sceneSettings.version) {
            copy(settings, sceneSettings);
        } else {
            localStorage.removeItem('settings');
        }
    }

    function copy(left: any, right: any) {
        for (let key of Object.keys(left)) {
            if (typeof left[key] !== 'object' && left[key] !== null) {
                right[key] = left[key]
            } else if (right[key]) {
                copy(left[key], right[key]);
            }
        }
    }

}

export enum TextureType {
    albedo = 'albedo',
    displace = 'displace',
    normal = 'normal',
    ao = 'ao',
    roughness = 'roughness',
    metalness = 'metalness',
    emissive = 'emissive',
    alpha = 'alpha',
}

const ignoreKey = ['text'];

const sceneSettings = {
    version: 3,
    currentTool: 'move',
    sculpt: {
        size: 0.2,
        brush: 'clay',
        invert: false,
        intensity: 20
    },
    paint: {
        size: 0.2,
        intensity: 20,
        color: 0xaaaaaa,
        verticeColor: false,
        closePath: false,
        metalness: 0.5,
        roughness: 0.5,
        importTextureType: TextureType.albedo,
    },
    edit: {
        type: 'sculpt',
        simpleSubdivision: false,
        verticesEditMode: 'edge',
    },
    transform: {
        x: 0,
        y: 0,
        z: 0,
        localX: 0,
        localY: 0,
        localZ: 0,
        type: 'translate',
    },
    saveSceneTo3DTiles: 0,
    global: {
        simplification: 1,
        showBVHHelper: false,
        BVHHelperDepth: 5,
        showOctreeHelper: true,
        showMeshEdge: true,
        meshEdgeDepthTest: true,
        subdivision: 1,
        showBoundingBox: false,
    },
    action: {
        importModel: 1,
        importGeoJson: 1,
        saveTo3DTiles: 1,
        importTexture: 1,
        loadTexturesInScene: 1,
        applyTexture: '',
        createGeometry: '',
        deleteGeometry: 1,
        mergeGeometries: 1,
        unionGeometries: 1,
        intersectGeometries: 1,
        extractFaces: 1,
        dulplicateMesh: 1,
        recomputeCenter: 1,
        exportSceneToGltf: 1,
        exportSelectedToGltf: 1,
        clearAllTexture: 1,
        applyEnvMap: 1,
        convertToPBRMaterial: 1,
        commitVersion: 1,
        selectScene: '',
        updateVersions: 1,
        editBoundary: 1,
    },
    scene: {
        secondCamera: true,
        castShadow: true,
        shadowMapResolution: 2048,
        showAxisHelper: false,
        lightAngle: 75,
        lightDirection: 45,
        lightIntensity: 1,
        lightDistance: 500,
        ambientLightIntensity: 0.2,
        showLightHelper: false,
        backgroundColor: 0xffffff,
        liveSelect: false,
        directionLight: true,
        baseMapCenterLng: -74.00516319107578,
        baseMapCenterLat: 40.71124243527472,
        baseMapZoomLevel: 18,
        baseMapBrightness: 0.5,
        showBaseMap: false,
        showSkybox: false,
        cubeTextureName: 'beach',
        logarithmicDepthBuffer: false,
        currentTileVersion: '',
    },
    text: {
        loading: -1,
        loadingText: '',
        bottomBar: `'T': translation; 'G': scale; 'R': rotation; 'WASD': move; 'Alt': range selection`,
        currentUserData: {

        }
    }
}

window.addEventListener('beforeunload', () => {

    saveSettingToLocalStorage();

});

(window as any).saveSettings = saveSettingToLocalStorage;

export type SceneSetting = typeof sceneSettings;

restoreSettingFromLocalStorage();

const sceneSettingsReactive: typeof sceneSettings = makeReactive(sceneSettings);

(window as any).sceneSettings = sceneSettings;

export { sceneSettingsReactive as sceneSettings };