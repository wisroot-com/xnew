//----------------------------------------------------------------------------------------------------
// xtextures — procedural textures (shader-first). Each entry is a plain texture object: the complete
// GLSL source (injectable into adapters like xthree.material.shader()) plus the two usage flows —
// bake() to an ImageBitmap on one shared OffscreenCanvas, and renderer() for a caller-owned canvas.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from './glsl/noise.glsl';
import { wood } from './define/wood';
import { tatami } from './define/tatami';
import { carpet } from './define/carpet';

//----------------------------------------------------------------------------------------------------
// shared shape — what a texture module authors and what the runtime consumes
//----------------------------------------------------------------------------------------------------

export interface TextureRange { min: number; max: number; }

// a params bag: scalar → float uniform, [r, g, b] → vec3 uniform
export type TexturePreset = Record<string, number | number[]>;

// standard is the complete authority on uniform keys and types; other presets partially override it
export type TexturePresets = { standard: TexturePreset } & Record<string, TexturePreset>;

// ranges / presets list the common parameters first, individual ones after: every texture defines scale (the size of one feature cell in world units, so the glsl divides position by it) / seed / color / background, and the names angle (rotation in the texture plane, Z axis) and bump (normal perturbation strength) are reserved for the textures that have them
// what a texture module authors — glsl is the body only (defineTexture prepends the noise prelude +
// uniform declarations) and must define both channel entry functions derived from name:
// vec3 xtex<Name>Color(vec3 pos) and vec3 xtex<Name>Normal(vec3 pos, vec3 normal, vec3 tangent)
export interface TextureSource { name: string; glsl: string; ranges: Record<string, TextureRange>; presets: TexturePresets; }

export type TextureChannel = 'color' | 'normal';

export interface TextureRenderer {
    render(params?: TexturePreset): void;
    dispose(): void;
}

export interface RendererOptions {
    worldSize?: number;
    channel?: TextureChannel;
    tile?: boolean;
}

export interface BakeOptions extends RendererOptions {
    size?: { width: number; height: number };
    params?: TexturePreset;
}

//----------------------------------------------------------------------------------------------------
// texture objects — assemble the complete glsl and attach the usage flows; schema / glsl consistency is asserted by the tests, not here
//----------------------------------------------------------------------------------------------------

export interface Texture extends TextureSource {
    // the channel entry-function prefix derived from name: "wood" → xtexWood (+ Color / Normal)
    entry: string;
    bake(options?: BakeOptions): ImageBitmap;
    renderer(canvas: HTMLCanvasElement, options?: RendererOptions): TextureRenderer;
}

export function defineTexture(source: TextureSource): Texture {
    const texture: Texture = {
        ...source,
        entry: 'xtex' + source.name.charAt(0).toUpperCase() + source.name.slice(1),
        glsl: noiseGlsl + uniformDeclarations(source.presets.standard) + source.glsl,
        bake(options: BakeOptions = {}) {
            return bakeTexture(texture, options);
        },
        renderer(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
            return createTextureRenderer(canvas, texture, options);
        },
    };
    return texture;
}

//----------------------------------------------------------------------------------------------------
// uniform declarations — generated from the standard preset; keys become GLSL identifiers verbatim, so they are validated here (throws at assembly, long before a shader compile)
//----------------------------------------------------------------------------------------------------

const RESERVED_UNIFORMS = ['uWorldSize'];

export function uniformDeclarations(standard: TexturePreset): string {
    const floats: string[] = [];
    const vec3s: string[] = [];
    for (const key in standard) {
        if (/^[A-Za-z][A-Za-z0-9_]*$/.test(key) === false) {
            throw new Error(`xtextures: uniform key "${key}" is not a valid GLSL identifier`);
        } else if (key.startsWith('gl_') || key.startsWith('xtex') || RESERVED_UNIFORMS.includes(key)) {
            throw new Error(`xtextures: uniform key "${key}" is reserved`);
        } else if (Array.isArray(standard[key])) {
            vec3s.push(key);
        } else {
            floats.push(key);
        }
    }
    let declarations = '';
    if (floats.length > 0) {
        declarations += `uniform float ${floats.join(', ')};\n`;
    }
    if (vec3s.length > 0) {
        declarations += `uniform vec3 ${vec3s.join(', ')};\n`;
    }
    return declarations;
}

//----------------------------------------------------------------------------------------------------
// shader sources — the fragment main samples the channel entry function on the z=0 slice; tile blends 4 wrapped samples in a border band, making the image periodic
//----------------------------------------------------------------------------------------------------

const VERTEX_SOURCE = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export function fragmentSource(def: Texture, channel: TextureChannel, tile: boolean): string {
    // color: paint the returned color; normal: encode the flat-slice normal as a bakeable normal map
    const sample = channel === 'normal'
        ? (pos: string) => `${def.entry}Normal(${pos}, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0))`
        : (pos: string) => `${def.entry}Color(${pos})`;
    const encode = channel === 'normal'
        ? (value: string) => `vec4(normalize(${value}) * 0.5 + 0.5, 1.0)`
        : (value: string) => `vec4(${value}, 1.0)`;

    const body = tile
        ? `vec2 w = smoothstep(1.0 - 0.2, 1.0, vUv);
  vec3 sx = vec3(uWorldSize, 0.0, 0.0);
  vec3 sy = vec3(0.0, uWorldSize, 0.0);
  vec3 blended = mix(
    mix(${sample('pos')}, ${sample('pos - sx')}, w.x),
    mix(${sample('pos - sy')}, ${sample('pos - sx - sy')}, w.x),
    w.y);
  fragColor = ${encode('blended')};`
        : `fragColor = ${encode(sample('pos'))};`;

    return `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uWorldSize;
${def.glsl}
void main(){
  vec3 pos = vec3((vUv - 0.5) * uWorldSize, 0.0);
  ${body}
}`;
}

//----------------------------------------------------------------------------------------------------
// gl helpers — program compile (aPos pinned to attribute 0 so one VAO serves every program) and draw
//----------------------------------------------------------------------------------------------------

function compileTextureProgram(gl: WebGL2RenderingContext, def: Texture, channel: TextureChannel, tile: boolean): WebGLProgram {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource(def, channel, tile)));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('xtextures: program link failed\n' + log);
    }
    return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('xtextures: shader compile failed\n' + log + '\n' + source);
    }
    return shader;
}

// a fullscreen triangle covering clip space, bound to attribute 0
function createFullscreenVao(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; buffer: WebGLBuffer } {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return { vao, buffer };
}

interface TexturePipeline {
    program: WebGLProgram;
    draw(width: number, height: number, worldSize: number, params: TexturePreset): void;
}

// one compiled program plus its uniform-location cache and draw call — the unit renderer and bake share
function createPipeline(gl: WebGL2RenderingContext, def: Texture, channel: TextureChannel, tile: boolean, vao: WebGLVertexArrayObject): TexturePipeline {
    const program = compileTextureProgram(gl, def, channel, tile);
    const locations = new Map<string, WebGLUniformLocation | null>();
    // uniform names in the glsl equal the schema keys; unused ones resolve to null locations (silently skipped)
    function locate(name: string): WebGLUniformLocation | null {
        if (locations.has(name) === false) {
            locations.set(name, gl.getUniformLocation(program, name));
        }
        return locations.get(name) ?? null;
    }
    function draw(width: number, height: number, worldSize: number, params: TexturePreset): void {
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.uniform1f(locate('uWorldSize'), worldSize);
        for (const name in def.presets.standard) {
            const value = params[name] ?? def.presets.standard[name];
            if (Array.isArray(value)) {
                gl.uniform3f(locate(name), value[0], value[1], value[2]);
            } else {
                gl.uniform1f(locate(name), value);
            }
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { program, draw };
}

//----------------------------------------------------------------------------------------------------
// per-canvas renderer — owns its own context (live previews); dispose when the canvas goes away
//----------------------------------------------------------------------------------------------------

function createTextureRenderer(canvas: HTMLCanvasElement, def: Texture, options: RendererOptions = {}): TextureRenderer {
    const { worldSize = 3, channel = 'color', tile = false } = options;
    const gl = canvas.getContext('webgl2');
    if (gl === null) {
        throw new Error('xtextures: WebGL2 is not available');
    }
    const { vao, buffer } = createFullscreenVao(gl);
    const pipeline = createPipeline(gl, def, channel, tile, vao);
    return {
        render(params: TexturePreset = {}) {
            pipeline.draw(canvas.width, canvas.height, worldSize, params);
        },
        dispose() {
            gl.deleteProgram(pipeline.program);
            gl.deleteBuffer(buffer);
            gl.deleteVertexArray(vao);
        },
    };
}

//----------------------------------------------------------------------------------------------------
// bake — render once on the shared OffscreenCanvas (browser contexts are capped, so bakes must not own one each) and hand the frame out as an ImageBitmap (the transfer detaches it)
//----------------------------------------------------------------------------------------------------

interface BakeContext {
    canvas: OffscreenCanvas;
    gl: WebGL2RenderingContext;
    vao: WebGLVertexArrayObject;
    pipelines: Map<string, TexturePipeline>;
}

let bakeContext: BakeContext | null = null;

function sharedBakeContext(): BakeContext {
    if (bakeContext === null) {
        if (typeof OffscreenCanvas === 'undefined') {
            throw new Error('xtextures: bake requires OffscreenCanvas support');
        }
        const canvas = new OffscreenCanvas(1, 1);
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
        if (gl === null) {
            throw new Error('xtextures: WebGL2 is not available');
        }
        const { vao } = createFullscreenVao(gl);
        bakeContext = { canvas, gl, vao, pipelines: new Map() };
    }
    return bakeContext;
}

function bakeTexture(def: Texture, options: BakeOptions = {}): ImageBitmap {
    const { worldSize = 3, channel = 'color', tile = false, params = {} } = options;
    const { width = 512, height = 512 } = options.size ?? {};

    const { canvas, gl, vao, pipelines } = sharedBakeContext();
    const key = `${def.name}:${channel}:${tile}`;
    let pipeline = pipelines.get(key);
    if (pipeline === undefined) {
        pipeline = createPipeline(gl, def, channel, tile, vao);
        pipelines.set(key, pipeline);
    }
    canvas.width = width;
    canvas.height = height;
    pipeline.draw(width, height, worldSize, params);
    return canvas.transferToImageBitmap();
}

//----------------------------------------------------------------------------------------------------
// the texture table — last so module-init assembly runs after every const above is initialized
//----------------------------------------------------------------------------------------------------

export const xtextures = {
    wood: defineTexture(wood),
    tatami: defineTexture(tatami),
    carpet: defineTexture(carpet),
};
