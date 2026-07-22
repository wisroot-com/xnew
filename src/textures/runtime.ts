//----------------------------------------------------------------------------------------------------
// xtextures runtime — the shared shape (TextureDef) + a minimal WebGL2 renderer that draws a texture
// into a canvas via a fullscreen triangle. No three, no image copy: the GLSL runs on the GPU directly.
// Uniform names in def.glsl equal the schema keys; unused ones resolve to null locations (silently skipped).
//----------------------------------------------------------------------------------------------------

export interface TextureUniform {
    value: number | number[];
    min?: number;
    max?: number;
    step?: number;
}

export interface TextureDef {
    name: string;
    // channel entry function names inside glsl — every texture carries BOTH:
    // color: `vec3 <fn>(vec3 pos)` returns a color.
    // normal: `vec3 <fn>(vec3 pos, vec3 normal, vec3 tangent)` returns a perturbed object-space normal
    // (flat surfaces just `return normalize(normal)`); the canvas runtime encodes it as a normal-map
    // image (n * 0.5 + 0.5), three lights the color with it.
    color: string;
    normal: string;
    glsl: string; // prelude + uniform declarations + the entry functions
    uniforms: Record<string, TextureUniform>;
}

export type TextureChannel = 'color' | 'normal';

export interface TextureRenderer {
    render(params: Record<string, number | number[]>): void;
    dispose(): void;
}

//----------------------------------------------------------------------------------------------------
// uniform declarations — generated from the uniform schema so names live in one place.
// Keys become GLSL identifiers verbatim, so they are validated here (throws at def-assembly time,
// long before a shader compile): identifier syntax, no gl_ / xtex namespaces, no host-owned names.
//----------------------------------------------------------------------------------------------------

const RESERVED_UNIFORMS = ['uWorldSize'];

export function uniformDeclarations(uniforms: Record<string, TextureUniform>): string {
    const floats: string[] = [];
    const vec3s: string[] = [];
    for (const key in uniforms) {
        if (/^[A-Za-z][A-Za-z0-9_]*$/.test(key) === false) {
            throw new Error(`xtextures: uniform key "${key}" is not a valid GLSL identifier`);
        } else if (key.startsWith('gl_') || key.startsWith('xtex') || RESERVED_UNIFORMS.includes(key)) {
            throw new Error(`xtextures: uniform key "${key}" is reserved`);
        } else if (Array.isArray(uniforms[key].value)) {
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
// renderer
//----------------------------------------------------------------------------------------------------

export function createTextureRenderer(
    canvas: HTMLCanvasElement,
    def: TextureDef,
    options: { worldSize?: number; channel?: TextureChannel } = {},
): TextureRenderer {
    const worldSize = options.worldSize ?? 3;
    const channel = options.channel ?? (def.color !== undefined ? 'color' : 'normal');
    if (def[channel] === undefined) {
        throw new Error(`xtextures: texture "${def.name}" has no ${channel} channel`);
    }
    const gl = canvas.getContext('webgl2');
    if (gl === null) {
        throw new Error('xtextures: WebGL2 is not available');
    }

    const vertexSource = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

    // color: paint the returned color; normal: encode the flat-slice normal as a bakeable normal map
    const body = channel === 'normal'
        ? `vec3 n = ${def.normal}(pos, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0));
  fragColor = vec4(n * 0.5 + 0.5, 1.0);`
        : `fragColor = vec4(${def.color}(pos), 1.0);`;

    const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uWorldSize;
${def.glsl}
void main(){
  vec3 pos = vec3((vUv - 0.5) * uWorldSize, 0.0);
  ${body}
}`;

    const program = linkProgram(gl, vertexSource, fragmentSource);

    // fullscreen triangle covering clip space
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const locations = new Map<string, WebGLUniformLocation | null>();
    function location(name: string): WebGLUniformLocation | null {
        if (locations.has(name) === false) {
            locations.set(name, gl!.getUniformLocation(program, name));
        }
        return locations.get(name) ?? null;
    }

    function render(params: Record<string, number | number[]>): void {
        gl!.viewport(0, 0, canvas.width, canvas.height);
        gl!.useProgram(program);
        gl!.bindVertexArray(vao);
        gl!.uniform1f(location('uWorldSize'), worldSize);
        for (const name in def.uniforms) {
            const value = params[name] ?? def.uniforms[name].value;
            if (Array.isArray(value)) {
                gl!.uniform3f(location(name), value[0], value[1], value[2]);
            } else {
                gl!.uniform1f(location(name), value);
            }
        }
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function dispose(): void {
        gl!.deleteProgram(program);
        gl!.deleteBuffer(buffer);
        gl!.deleteVertexArray(vao);
    }

    return { render, dispose };
}

function linkProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
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
