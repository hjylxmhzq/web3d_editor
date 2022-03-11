import { Object3D } from "three";

class SceneHistory {

    historyList: HisotryItem[] = [];

    constructor() {

    }

    push(obj: Object3D) {

        const item = new HisotryItem(obj);
        this.historyList.push(item);

    }
}

class HisotryItem {
    constructor(public object: Object3D) {

    }
}

const sceneHistory = new SceneHistory();

export {
    sceneHistory,
}