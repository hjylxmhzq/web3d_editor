import { Versions } from "../../../../api/vertionControl";

type Tileset = Record<string, any>;

export function mergeTilesets(base: Tileset, left: Tileset, right: Tileset) {

    const baseRoot = base.root;
    const leftRoot = left.root;
    const rightRoot = right.root;

    const mergedRoot = merge(baseRoot, leftRoot, rightRoot);

    return {
        ...base,
        root: mergedRoot,
    };

    function merge(baseNode: any = {}, leftNode: any = {}, rightNode: any = {}) {

        const leftURI = leftNode.content?.uri;
        const rightURI = rightNode.content?.uri;
        const baseURI = baseNode.content?.uri;
        const newNode = {
            ...leftNode,
            ...rightNode,
        };

        if (leftURI !== rightURI) {

            if (baseURI === leftURI) {

                newNode.content = {
                    uri: rightURI,
                };

            } else if (baseURI === rightURI) {

                newNode.content = {
                    uri: leftURI,
                };

            }

        }

        const childrenLen = Math.max(leftNode.children.length, rightNode.children.length);

        newNode.children = [];

        for (let i = 0; i < childrenLen; i++) {

            newNode.children[i] = merge(baseNode.children[i], leftNode.children[i], rightNode.children[i]);

        }

        return newNode;

    }


}

export function getLastVersions(versions: Versions) {

    const froms = new Set<number>();
    const tos = new Set<number>();

    for (let v of versions.links) {

        froms.add(v.from);
        tos.add(v.to);

    }

    const lastVersions = [];

    for (let v of Array.from(tos)) {

        if (!froms.has(v)) {

            lastVersions.push(versions.nodes[v]);

        }

    }

    return lastVersions;

}

interface VersionLink {
    name: string,
    parents: VersionLink[]
}

function getVersionLink(versions: Versions) {

    const nodesByName: Record<string, VersionLink> = {};

    const nodes = versions.nodes.map(n => {
        const node: VersionLink = { name: n.tagName, parents: [] };
        nodesByName[n.tagName] = node;
        return node;
    });

    for (let link of versions.links) {

        nodes[link.to].parents.push(nodes[link.from]);

    }

    return nodesByName;

}

export function getBaseVersion(versions: Versions, left: string, right: string) {

    const nodes = getVersionLink(versions);

    const leftNode = nodes[left];
    const rightNode = nodes[right];

    return helper(leftNode, rightNode);

    function helper(left: VersionLink, right: VersionLink) {

        const leftParents = new Set<string>();
        let cur = left;
        while (cur.parents.length) {

            cur = cur.parents[0];
            leftParents.add(cur.name);

        }

        cur = right;
        while (cur) {

            cur = cur.parents[0];
            if (leftParents.has(cur.name)) {
                break;
            }

        }

        const base = cur.name;

        return base;

    }

}