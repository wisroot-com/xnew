import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';
import { cpSync } from 'fs';

const configs = [];
export default configs;

append('index', 'xnew');
append('addons/pixi/xpixi', 'addons/xpixi', ['@mulsense/xnew', 'pixi.js']);
append('addons/three/xthree', 'addons/xthree', ['@mulsense/xnew', 'three']);
append('addons/matter/xmatter', 'addons/xmatter', ['@mulsense/xnew', 'matter-js']);
append('addons/rapier2d/xrapier2d', 'addons/xrapier2d', ['@mulsense/xnew', '@dimforge/rapier2d-compat']);
append('addons/rapier3d/xrapier3d', 'addons/xrapier3d', ['@mulsense/xnew', '@dimforge/rapier3d-compat']);
append('addons/react/xreact', 'addons/xreact', ['@mulsense/xnew', 'react']);

// import a .glsl file as its source string (see src/textures/glsl-modules.d.ts)
function glsl() {
    return {
        name: 'glsl',
        transform(code, id) {
            if (id.endsWith('.glsl')) {
                return { code: `export default ${JSON.stringify(code)};`, map: null };
            }
        },
    };
}

// `src` is the entry path under src/ (addons are nested per library); `dst` is the flat dist/ path.
function append(src, dst, external = []) {
    // ESM build — the only distribution format (`import { xnew } from '@mulsense/xnew'`).
    configs.push({
        input: `./src/${src}.ts`,
        output: [
            { file: `./dist/${dst}.mjs`, format: 'es', },
        ],
        external,
        plugins: [
            glsl(),
            typescript({ removeComments: true }),
            copyto(`./dist/${dst}.mjs`, `./examples/dist/${dst}.mjs`),
        ],
    });
    configs.push({
        input: `./src/${src}.ts`,
        output: { file: `./dist/${dst}.d.ts`, format: 'es', },
        plugins: [
            dts({ compilerOptions: { removeComments: true } }),
            copyto(`./dist/${dst}.d.ts`, `./examples/dist/${dst}.d.ts`),
        ]
    });
    function copyto(src, dst) {
        return {
            name: 'copyto',
            writeBundle() { cpSync(src, dst, { recursive: true, force: true }); },
        };
    }
}
