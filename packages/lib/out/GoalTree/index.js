"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPistarModel = exports.validateModel = void 0;
const fs_1 = require("fs");
const validateModel = ({ model }) => {
    const root = model.actors
        .map((item) => 
    // check in node list if there are more than one root
    item.nodes.reduce((hasRoot, node) => {
        // Exclude Quality nodes from root check
        if (node.type === 'istar.Quality') {
            return hasRoot;
        }
        // Check if this node has outgoing links
        const isRoot = !model.links.find((link) => link.source === node.id);
        // Also exclude nodes that are targets of QualificationLinks (connected to Quality nodes)
        const isQualifiedByQuality = model.links.some((link) => {
            if (link.type !== 'istar.QualificationLink')
                return false;
            if (link.target !== node.id)
                return false;
            // Check if the source is a Quality node
            const sourceNode = item.nodes.find((n) => n.id === link.source);
            return sourceNode?.type === 'istar.Quality';
        });
        if (isQualifiedByQuality) {
            return hasRoot; // Skip this node in root check
        }
        if (isRoot && hasRoot) {
            throw new Error('invalid number of roots, one allowed');
        }
        if (isRoot) {
            node.customProperties.root = 'true';
        }
        return isRoot || hasRoot;
    }, false))
        // check if all actors have a root
        .every((isValid) => isValid);
    if (!root) {
        throw new Error('invalid number of root, one allowed');
    }
};
exports.validateModel = validateModel;
const loadPistarModel = ({ filename }) => {
    const modelFile = (0, fs_1.readFileSync)(filename);
    const model = JSON.parse(modelFile.toString());
    (0, exports.validateModel)({ model });
    return model;
};
exports.loadPistarModel = loadPistarModel;
//# sourceMappingURL=index.js.map