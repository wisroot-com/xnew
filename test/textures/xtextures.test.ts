import * as fs from 'fs';
import * as path from 'path';
import { xtextures } from '@mulsense/xnew';
import { uniformDeclarations } from '../../src/textures/runtime';

// jsdom has no WebGL2, so rendering is not tested here — these assert the def assembly:
// .glsl file imports resolve, and def.glsl = noise + schema-generated uniform decls + entry functions.
describe('xtextures defs', () => {
    test.each(Object.entries(xtextures))('%s carries a complete injectable glsl source', (name, texture) => {
        // every texture carries BOTH channels by design (flat surfaces return the geometric normal)
        expect(texture.def.color).toBeDefined();
        expect(texture.def.normal).toBeDefined();
        expect(texture.glsl).toContain('float xtex_noise(vec3 P)');
        for (const fn of [texture.def.color, texture.def.normal]) {
            expect(texture.glsl).toContain(`vec3 ${fn}(`);
        }
        for (const key in texture.uniforms) {
            const type = Array.isArray(texture.uniforms[key].value) ? 'vec3' : 'float';
            expect(texture.glsl).toMatch(new RegExp(`uniform ${type}[^;]*\\b${key}\\b`));
        }
    });

    test('uniform declarations come after the noise prelude and before the entry functions', () => {
        for (const texture of Object.values(xtextures)) {
            const noiseAt = texture.glsl.indexOf('float xtex_noise(vec3 P)');
            const uniformAt = texture.glsl.indexOf('uniform float');
            const fnAt = texture.glsl.indexOf(`vec3 ${texture.def.color ?? texture.def.normal}(`);
            expect(noiseAt).toBeLessThan(uniformAt);
            expect(uniformAt).toBeLessThan(fnAt);
        }
    });
});

describe('uniformDeclarations', () => {
    test('splits floats and vec3s by schema value shape', () => {
        const decls = uniformDeclarations({ a: { value: 1 }, b: { value: [1, 0, 0] }, c: { value: 2 } });
        expect(decls).toBe('uniform float a, c;\nuniform vec3 b;\n');
    });

    test('rejects keys that are not valid GLSL identifiers', () => {
        expect(() => uniformDeclarations({ 'fiber-density': { value: 1 } })).toThrow('not a valid GLSL identifier');
        expect(() => uniformDeclarations({ '2scale': { value: 1 } })).toThrow('not a valid GLSL identifier');
    });

    test('rejects reserved keys (host-owned names and gl_ / xtex namespaces)', () => {
        expect(() => uniformDeclarations({ uWorldSize: { value: 1 } })).toThrow('reserved');
        expect(() => uniformDeclarations({ gl_scale: { value: 1 } })).toThrow('reserved');
        expect(() => uniformDeclarations({ xtexFoo: { value: 1 } })).toThrow('reserved');
    });
});

// the preview harnesses (src/textures/preview/*.frag) hard-code the schema defaults as consts;
// this keeps that manual mirror honest, and checks their #include paths actually exist.
describe('preview harnesses', () => {
    const previewDir = path.join(__dirname, '../../src/textures/preview');
    const previews = fs.readdirSync(previewDir).filter((file) => file.endsWith('.frag'));
    const defs = Object.values(xtextures).map((texture) => texture.def);

    test.each(previews)('%s consts mirror the schema defaults', (file) => {
        const source = fs.readFileSync(path.join(previewDir, file), 'utf8');
        const def = defs.find((d) => file.split(/[-.]/)[0] === d.name.toLowerCase());
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
        expect(consts).toEqual(Object.fromEntries(
            Object.entries(def!.uniforms).map(([key, uniform]) => [key, uniform.value]),
        ));
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
