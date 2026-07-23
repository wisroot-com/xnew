import * as fs from 'fs';
import * as path from 'path';
import { xtextures } from '@mulsense/xnew';
import { defineTexture } from '../../src/textures/xtextures';
import { fragmentSource, uniformDeclarations } from '../../src/textures/runtime';

// jsdom has no WebGL2, so rendering is not tested here — these assert the def assembly:
// .glsl file imports resolve, and texture.glsl = noise + schema-generated uniform decls + entry functions.
describe('xtextures textures', () => {
    test.each(Object.entries(xtextures))('%s carries a complete injectable glsl source', (name, texture) => {
        // every texture carries BOTH channels by design (flat surfaces return the geometric normal)
        expect(texture.color).toBeDefined();
        expect(texture.normal).toBeDefined();
        expect(texture.glsl).toContain('float xtex_noise(vec3 P)');
        for (const fn of [texture.color, texture.normal]) {
            expect(texture.glsl).toContain(`vec3 ${fn}(`);
        }
        for (const key in texture.presets.standard) {
            const type = Array.isArray(texture.presets.standard[key]) ? 'vec3' : 'float';
            expect(texture.glsl).toMatch(new RegExp(`uniform ${type}[^;]*\\b${key}\\b`));
        }
    });

    test('uniform declarations come after the noise prelude and before the entry functions', () => {
        for (const texture of Object.values(xtextures)) {
            const noiseAt = texture.glsl.indexOf('float xtex_noise(vec3 P)');
            const uniformAt = texture.glsl.indexOf('uniform float');
            const fnAt = texture.glsl.indexOf(`vec3 ${texture.color}(`);
            expect(noiseAt).toBeLessThan(uniformAt);
            expect(uniformAt).toBeLessThan(fnAt);
        }
    });

    test.each(Object.entries(xtextures))('%s exposes the bake / renderer flows', (name, texture) => {
        expect(typeof texture.bake).toBe('function');
        expect(typeof texture.renderer).toBe('function');
    });

    test.each(Object.entries(xtextures))('%s derives its entry names from its member key', (name, texture) => {
        expect(texture.name).toBe(name);
        const entry = 'xtex' + name.charAt(0).toUpperCase() + name.slice(1);
        expect(texture.color).toBe(`${entry}Color`);
        expect(texture.normal).toBe(`${entry}Normal`);
    });
});

describe('defineTexture', () => {
    const glsl = 'vec3 xtexFooColor(vec3 pos){ return vec3(0.0); }\nvec3 xtexFooNormal(vec3 pos, vec3 normal, vec3 tangent){ return normalize(normal); }';
    const empty = { ranges: {}, presets: { standard: {} } };

    test('rejects names that are not lowercase-led identifiers', () => {
        expect(() => defineTexture({ name: 'Foo', glsl, ...empty })).toThrow('lowercase-led identifier');
        expect(() => defineTexture({ name: 'foo-bar', glsl, ...empty })).toThrow('lowercase-led identifier');
    });

    test('rejects glsl that lacks a derived entry function', () => {
        expect(() => defineTexture({ name: 'foo', glsl: 'vec3 xtexFooColor(vec3 pos){ return vec3(0.0); }', ...empty }))
            .toThrow('does not define vec3 xtexFooNormal(');
        expect(defineTexture({ name: 'foo', glsl, ...empty }).color).toBe('xtexFooColor');
    });

    test('rejects a missing standard preset', () => {
        expect(() => defineTexture({ name: 'foo', glsl, ranges: {}, presets: {} } as any))
            .toThrow('must carry presets.standard');
    });

    test('rejects a scalar standard key without a range', () => {
        expect(() => defineTexture({ name: 'foo', glsl, ranges: {}, presets: { standard: { scale: 1 } } }))
            .toThrow('scalar uniform "scale" has no range');
        // vec3 keys need no range
        expect(() => defineTexture({ name: 'foo', glsl, ranges: {}, presets: { standard: { tint: [1, 0, 0] } } }))
            .not.toThrow();
    });

    test('rejects ranges that do not match presets.standard', () => {
        expect(() => defineTexture({ name: 'foo', glsl, ranges: { scale: { min: 0, max: 1 } }, presets: { standard: {} } }))
            .toThrow('range key "scale" is not in presets.standard');
        expect(() => defineTexture({ name: 'foo', glsl, ranges: { tint: { min: 0, max: 1 } }, presets: { standard: { tint: [1, 0, 0] } } }))
            .toThrow('range key "tint" is a vec3');
    });

    test('accepts partial presets but rejects unknown keys and type mismatches', () => {
        const base = { name: 'foo', glsl, ranges: { scale: { min: 0, max: 1 } } };
        const standard = { scale: 1, tint: [1, 0, 0] };
        expect(defineTexture({ ...base, presets: { standard, pale: { tint: [1, 1, 1] } } }).presets.pale)
            .toEqual({ tint: [1, 1, 1] });
        expect(() => defineTexture({ ...base, presets: { standard, pale: { extra: 1 } } }))
            .toThrow('preset "pale" key "extra" is not in presets.standard');
        expect(() => defineTexture({ ...base, presets: { standard, pale: { tint: 1 } } }))
            .toThrow('preset "pale" key "tint" does not match the standard type');
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
        expect(samples(color, texture.color)).toBe(1);
        const normal = fragmentSource(texture, 'normal', false);
        expect(normal).toContain(`${texture.normal}(pos`);
        expect(normal).toContain('* 0.5 + 0.5');
    });

    test('tile blends 4 wrapped samples with edge-band weights', () => {
        const tiled = fragmentSource(texture, 'color', true);
        expect(samples(tiled, texture.color)).toBe(4);
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
