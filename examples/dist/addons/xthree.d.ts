import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';

declare class UnitPromise {
    private promise;
    key?: string | undefined;
    constructor(promise: Promise<any>, key?: string | undefined);
    private chain;
    then(callback: Function): UnitPromise;
    catch(callback: Function): UnitPromise;
    finally(callback: Function): UnitPromise;
    static collect(promises: UnitPromise[]): Promise<Record<string, any>>;
}

interface Transform {
    position?: {
        x: number;
        y: number;
        z?: number;
    };
    scale?: number | {
        x: number;
        y: number;
        z?: number;
    };
    rotation?: {
        x: number;
        y: number;
        z?: number;
    };
}
declare function initialize({ canvas, camera }: {
    canvas: HTMLCanvasElement;
    camera?: THREE.Camera | null;
}): UnitPromise;
declare function nest(options?: Transform): THREE.Group;
declare function add(object: any): any;

interface TextureRange {
    min: number;
    max: number;
}
type TexturePreset = Record<string, number | number[]>;
type TexturePresets = {
    standard: TexturePreset;
} & Record<string, TexturePreset>;
interface TextureSource {
    name: string;
    glsl: string;
    ranges: Record<string, TextureRange>;
    presets: TexturePresets;
}
type TextureChannel = 'color' | 'normal';
interface TextureRenderer {
    render(params?: TexturePreset): void;
    dispose(): void;
}
interface RendererOptions {
    worldSize?: number;
    channel?: TextureChannel;
    tile?: boolean;
}
interface BakeOptions extends RendererOptions {
    size?: {
        width: number;
        height: number;
    };
    params?: TexturePreset;
}
interface Texture extends TextureSource {
    entry: string;
    bake(options?: BakeOptions): ImageBitmap;
    renderer(canvas: HTMLCanvasElement, options?: RendererOptions): TextureRenderer;
}

interface CarpetProps extends Transform {
    size?: number;
    tile?: number;
    fade?: {
        solid: number;
        clear: number;
    };
    texture?: TexturePreset;
}
declare function Carpet(unit: xnew.Unit, { size, tile, fade, texture, position, rotation, scale, }?: CarpetProps): void;

interface TatamiProps extends Transform {
    size?: number;
    grid?: [number, number];
    thickness?: number;
    texture?: TexturePreset;
}
declare function Tatami(unit: xnew.Unit, { size, grid, thickness, texture, position, rotation, scale, }?: TatamiProps): void;

interface ChabudaiProps extends Transform {
    radius?: number;
    thickness?: number;
    height?: number;
    legs?: number;
    legRadius?: number;
    texture?: TexturePreset;
}
declare function Chabudai(unit: xnew.Unit, { radius, thickness, height, legs, legRadius, texture, position, rotation, scale, }?: ChabudaiProps): void;

interface StandardBakeOptions {
    params?: TexturePreset;
    size?: {
        width: number;
        height: number;
    };
    worldSize?: number;
    tile?: boolean;
    repeat?: {
        x: number;
        y: number;
    };
}
interface StandardOptions extends THREE.MeshStandardMaterialParameters, StandardBakeOptions {
    inject?: boolean;
}
type StandardMaterial = THREE.MeshStandardMaterial & {
    uniforms?: Record<string, THREE.IUniform>;
};
declare function shader(texture: Texture, params?: TexturePreset): THREE.ShaderMaterial;
declare function standard(texture: Texture, options?: StandardOptions): StandardMaterial;

declare const xthree: {
    initialize: typeof initialize;
    nest: typeof nest;
    add: typeof add;
    material: {
        shader: typeof shader;
        standard: typeof standard;
    };
    models: {
        Chabudai: typeof Chabudai;
        Tatami: typeof Tatami;
        Carpet: typeof Carpet;
    };
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { xthree };
