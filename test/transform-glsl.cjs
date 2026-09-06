// Jest transform: import a .glsl file as its source string (mirrors the rollup glsl plugin).
module.exports = {
    process(sourceText) {
        const code =
            'Object.defineProperty(exports, "__esModule", { value: true });\n' +
            `exports.default = ${JSON.stringify(sourceText)};`;
        return { code };
    },
};
