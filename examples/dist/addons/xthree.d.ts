import * as THREE from 'three';

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

declare const xthree: {
    initialize({ canvas, camera }: {
        canvas: HTMLCanvasElement;
        camera?: THREE.Camera | null;
    }): UnitPromise;
    nest(options?: {
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
    }): THREE.Group;
    add(object: any): any;
    material: {
        shader: (texture: Texture, params?: TexturePreset) => THREE.ShaderMaterial;
        standard: (texture: Texture, options?: StandardOptions) => StandardMaterial;
    };
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { xthree };
