import * as THREE from 'three';
import { xnew } from '@mulsense/xnew';

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
declare function applyTransform(object: THREE.Object3D, { position, scale, rotation }: Transform): void;
declare function Root(unit: xnew.Unit, { canvas, camera }: any): {
    readonly canvas: any;
    readonly camera: any;
    readonly renderer: THREE.WebGLRenderer;
    readonly scene: THREE.Scene;
};
declare const xthree: {
    initialize: typeof initialize;
    nest: typeof nest;
    add: typeof add;
    material: {
        shader: typeof shader;
        standard: typeof standard;
    };
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { Root, applyTransform, xthree };
export type { Transform };
