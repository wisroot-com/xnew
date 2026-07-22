import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';
import { cpSync } from 'fs';

const configs = [];
export default configs;

append('', 'index', 'xnew');
append('addons/', 'xpixi', 'xpixi',  ['@mulsense/xnew', 'pixi.js']);
append('addons/', 'xthree', 'xthree', ['@mulsense/xnew', 'three']);
append('addons/', 'xmatter', 'xmatter', ['@mulsense/xnew', 'matter-js']);
append('addons/', 'xrapier2d', 'xrapier2d', ['@mulsense/xnew', '@dimforge/rapier2d-compat']);
append('addons/', 'xrapier3d', 'xrapier3d', ['@mulsense/xnew', '@dimforge/rapier3d-compat']);
append('addons/', 'xreact', 'xreact', ['@mulsense/xnew', 'react']);

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

function append(dir, src, name, external = []) {
    // ESM build — the only distribution format (`import { xnew } from '@mulsense/xnew'`).
    configs.push({
        input: `./src/${dir}${src}.ts`,
        output: [
            { file: `./dist/${dir}${name}.mjs`, format: 'es', },
        ],
        external,
        plugins: [
            glsl(),
            typescript({ removeComments: true }),
            copyto(`./dist/${dir}${name}.mjs`, `./examples/dist/${dir}${name}.mjs`),
        ],
    });
    configs.push({
        input: `./src/${dir}${src}.ts`,
        output: { file: `./dist/${dir}${name}.d.ts`, format: 'es', },
        plugins: [
            dts({ compilerOptions: { removeComments: true } }),
            copyto(`./dist/${dir}${name}.d.ts`, `./examples/dist/${dir}${name}.d.ts`),
        ]
    });
    function copyto(src, dst) {
        return {
            name: 'copyto',
            writeBundle() { cpSync(src, dst, { recursive: true, force: true }); },
        };
    }
}
