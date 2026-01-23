"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isResource = void 0;
const isResource = (goal) => {
    return goal.every((goal) => goal.type === 'resource');
};
exports.isResource = isResource;
//# sourceMappingURL=nodeUtils.js.map