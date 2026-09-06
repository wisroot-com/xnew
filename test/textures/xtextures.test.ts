import * as fs from 'fs';
import * as path from 'path';
import { xtextures } from '@mulsense/xnew';
import { fragmentSource, uniformDeclarations } from '../../src/textures/xtextures';

// the channel entry-function naming contract: name "wood" → xtexWoodColor / xtexWoodNormal
function entry(name: string): string {
    return 'xtex' + name.charAt(0).toUpperCase() + name.slice(1);
}

// jsdom has no WebGL2, so rendering is not tested here — these assert the def assembly:
// .glsl file imports resolve, and texture.glsl = noise + schema-generated uniform decls + entry functions.
// defineTexture itself is check-free, so schema / glsl consistency is asserted here instead.
describe('xtextures textures', () => {
    test.each(Object.entries(xtextures))('%s carries a complete injectable glsl source', (name, texture) => {
        expect(texture.name).toBe(name);
        expect(/^[a-z][A-Za-z0-9]*$/.test(name)).toBe(true);
        expect(texture.glsl).toContain('float xtex_noise(vec3 P)');
        // every texture defines BOTH channels by design (flat surfaces return the geometric normal)
        for (const fn of [`${entry(name)}Color`, `${entry(name)}Normal`]) {
            expect(texture.glsl).toContain(`vec3 ${fn}(`);
        }
        for (const key in texture.presets.standard) {
            const type = Array.isArray(texture.presets.standard[key]) ? 'vec3' : 'float';
            expect(texture.glsl).toMatch(new RegExp(`uniform ${type}[^;]*\\b${key}\\b`));
        }
    });

    test.each(Object.entries(xtextures))('%s schema is consistent', (name, texture) => {
        const standard = texture.presets.standard;
        for (const key in standard) {
            if (Array.isArray(standard[key]) === false) {
                // every scalar uniform needs a range (UI sliders); vec3s need none
                expect(texture.ranges[key]).toBeDefined();
            }
        }
        for (const key in texture.ranges) {
            expect(Array.isArray(standard[key])).toBe(false);
        }
        for (const preset of Object.values(texture.presets)) {
            for (const key in preset) {
                // standard is the complete authority on uniform keys and types
                expect(standard[key]).toBeDefined();
                expect(Array.isArray(preset[key])).toBe(Array.isArray(standard[key]));
            }
        }
    });

    // the common parameter vocabulary — definitions list it first so the schema-generated UI rows line up across textures
    const COMMON = ['scale', 'angle', 'bump', 'seed', 'color', 'background'];
    const REQUIRED = ['scale', 'seed', 'color', 'background'];

    test.each(Object.entries(xtextures))('%s lists the common parameters first', (name, texture) => {
        const standard = texture.presets.standard;
        for (const key of REQUIRED) {
            expect(standard[key]).toBeDefined();
        }
        // color / background are the two base colors; angle / bump are reserved scalar names
        expect(Array.isArray(standard.color)).toBe(true);
        expect(Array.isArray(standard.background)).toBe(true);
        for (const key of ['angle', 'bump']) {
            if (standard[key] !== undefined) {
                expect(Array.isArray(standard[key])).toBe(false);
            }
        }
        for (const keys of [Object.keys(standard), Object.keys(texture.ranges)]) {
            const common = keys.map((key, index) => (COMMON.includes(key) ? index : -1)).filter((index) => index >= 0);
            const individual = keys.map((key, index) => (COMMON.includes(key) ? -1 : index)).filter((index) => index >= 0);
            expect(Math.max(...common)).toBeLessThan(Math.min(...individual, Infinity));
        }
    });

    test('uniform declarations come after the noise prelude and before the entry functions', () => {
        for (const texture of Object.values(xtextures)) {
            const noiseAt = texture.glsl.indexOf('float xtex_noise(vec3 P)');
            const uniformAt = texture.glsl.indexOf('uniform float');
            const fnAt = texture.glsl.indexOf(`vec3 ${entry(texture.name)}Color(`);
            expect(noiseAt).toBeLessThan(uniformAt);
            expect(uniformAt).toBeLessThan(fnAt);
        }
    });

    test.each(Object.entries(xtextures))('%s exposes the bake / renderer flows', (name, texture) => {
        expect(typeof texture.bake).toBe('function');
        expect(typeof texture.renderer).toBe('function');
    });
});

describe('fragmentSource', () => {
    const texture = xtextures.wood;

    // count entry-function call sites in the generated main (the def glsl above it holds the definition)
    function samples(source: string, fn: string): number {
        return source.slice(source.indexOf('void main()')).match(new RegExp(`${fn}\\(`, 'g'))!.length;
    }

    test('color samples the color entry once; normal encodes a normalized normal map', () => {
        const color = fragmentSource(texture, 'color', false);
        expect(samples(color, 'xtexWoodColor')).toBe(1);
        const normal = fragmentSource(texture, 'normal', false);
        expect(normal).toContain('xtexWoodNormal(pos');
        expect(normal).toContain('* 0.5 + 0.5');
    });

    test('tile blends 4 wrapped samples with edge-band weights', () => {
        const tiled = fragmentSource(texture, 'color', true);
        expect(samples(tiled, 'xtexWoodColor')).toBe(4);
        expect(tiled).toContain('smoothstep');
        expect(tiled).toContain('pos - sx - sy');
    });
});

describe('uniformDeclarations', () => {
    test('splits floats and vec3s by the standard preset value shape', () => {
        const decls = uniformDeclarations({ a: 1, b: [1, 0, 0], c: 2 });
        expect(decls).toBe('uniform float a, c;\nuniform vec3 b;\n');
    });

    test('rejects keys that are not valid GLSL identifiers', () => {
        expect(() => uniformDeclarations({ 'fiber-density': 1 })).toThrow('not a valid GLSL identifier');
        expect(() => uniformDeclarations({ '2scale': 1 })).toThrow('not a valid GLSL identifier');
    });

    test('rejects reserved keys (host-owned names and gl_ / xtex namespaces)', () => {
        expect(() => uniformDeclarations({ uWorldSize: 1 })).toThrow('reserved');
        expect(() => uniformDeclarations({ gl_scale: 1 })).toThrow('reserved');
        expect(() => uniformDeclarations({ xtexFoo: 1 })).toThrow('reserved');
    });
});

// the preview harnesses (src/textures/preview/*.frag) hard-code the schema defaults as consts;
// this keeps that manual mirror honest, and checks their #include paths actually exist.
describe('preview harnesses', () => {
    const previewDir = path.join(__dirname, '../../src/textures/preview');
    const previews = fs.readdirSync(previewDir).filter((file) => file.endsWith('.frag'));
    const defs = Object.values(xtextures);

    test.each(previews)('%s consts mirror the schema defaults', (file) => {
        const source = fs.readFileSync(path.join(previewDir, file), 'utf8');
        const def = defs.find((d) => file.split(/[-.]/)[0] === d.name);
        expect(def).toBeDefined();

        // only the consts above the first #include mirror the schema; later ones are harness-local
        const head = source.slice(0, source.indexOf('#include'));
        const consts: Record<string, number | number[]> = {};
        for (const m of head.matchAll(/const float ([A-Za-z_][A-Za-z0-9_]*) = ([^;]+);/g)) {
            consts[m[1]] = Number(m[2]);
        }
        for (const m of head.matchAll(/const vec3 ([A-Za-z_][A-Za-z0-9_]*) = vec3\(([^)]+)\);/g)) {
            consts[m[1]] = m[2].split(',').map(Number);
        }
        expect(consts).toEqual(def!.presets.standard);
    });

    test.each(previews)('%s #include paths exist', (file) => {
        const source = fs.readFileSync(path.join(previewDir, file), 'utf8');
        const includes = [...source.matchAll(/#include "([^"]+)"/g)].map((m) => m[1]);
        expect(includes.length).toBeGreaterThan(0);
        for (const include of includes) {
            expect(fs.existsSync(path.join(previewDir, include))).toBe(true);
        }
    });
});
