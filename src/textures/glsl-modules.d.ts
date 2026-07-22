//----------------------------------------------------------------------------------------------------
// glsl modules — `import glsl from './x.glsl'` resolves to the file's source string
// (rollup: inline glsl plugin in rollup.config.js; jest: test/transform-glsl.cjs)
//----------------------------------------------------------------------------------------------------

declare module '*.glsl' {
    const source: string;
    export default source;
}
