import { xtextures } from '@mulsense/xnew';

// jsdom has no WebGL2, so rendering is not tested here — these assert the def assembly:
// .glsl file imports resolve, and def.glsl = noise + schema-generated uniform decls + entry function.
describe('xtextures defs', () => {
    test.each(Object.entries(xtextures))('%s carries a complete injectable glsl source', (name, texture) => {
        expect(texture.glsl).toContain('float xtex_noise(vec3 P)');
        expect(texture.glsl).toContain(`vec3 ${texture.fn}(`);
        for (const key in texture.uniforms) {
            const type = Array.isArray(texture.uniforms[key].value) ? 'vec3' : 'float';
            expect(texture.glsl).toMatch(new RegExp(`uniform ${type}[^;]*\\b${key}\\b`));
        }
    });

    test('uniform declarations come after the noise prelude and before the entry function', () => {
        for (const texture of Object.values(xtextures)) {
            const noiseAt = texture.glsl.indexOf('float xtex_noise(vec3 P)');
            const uniformAt = texture.glsl.indexOf('uniform float');
            const fnAt = texture.glsl.indexOf(`vec3 ${texture.fn}(`);
            expect(noiseAt).toBeLessThan(uniformAt);
            expect(uniformAt).toBeLessThan(fnAt);
        }
    });
});
