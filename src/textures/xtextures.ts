//----------------------------------------------------------------------------------------------------
// xtextures — procedural textures (shader-first). Each entry is an xnew component that renders the
// texture into its own <canvas> via WebGL2 (no three), AND carries its GLSL definition so adapters
// like xthree.texture() can inject the same shader into a ShaderMaterial (no image copy).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { createTextureRenderer, type TextureChannel, type TextureDef } from './runtime';
import { wood } from './wood';
import { concrete } from './concrete';

export type TextureComponent = ((unit: xnew.Unit, props?: any) => any) & {
    def: TextureDef;
    glsl: string;
    uniforms: TextureDef['uniforms'];
};

// build a canvas-rendering component from a texture definition
function defineTexture(def: TextureDef): TextureComponent {
    function Texture(unit: xnew.Unit, props: any = {}) {
        const {
            size,
            worldSize,
            channel,
            style = 'display: block; width: 100%; height: auto;',
            ...params
        } = props ?? {};
        const width = size?.width ?? 512;
        const height = size?.height ?? 512;

        const canvas = xnew(`<canvas width="${width}" height="${height}" style="${style}">`).element as HTMLCanvasElement;
        const renderer = createTextureRenderer(canvas, def, { worldSize, channel: channel as TextureChannel | undefined });

        const state: Record<string, number | number[]> = {};
        for (const key in def.uniforms) {
            state[key] = def.uniforms[key].value;
        }
        Object.assign(state, params);
        renderer.render(state);

        unit.on('finalize', () => renderer.dispose());

        return {
            get canvas() {
                return canvas;
            },
            set(next: Record<string, number | number[]>) {
                Object.assign(state, next);
                renderer.render(state);
            },
            render() {
                renderer.render(state);
            },
        };
    }

    return Object.assign(Texture, { def, glsl: def.glsl, uniforms: def.uniforms });
}

export const xtextures = {
    Wood: defineTexture(wood),
    Concrete: defineTexture(concrete),
};
