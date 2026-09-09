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

interface ShaderMaterialOptions {
    type: 'shader';
    params?: TexturePreset;
}
interface BakeMaterialOptions extends THREE.MeshStandardMaterialParameters {
    type?: 'bake';
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
interface InjectMaterialOptions extends THREE.MeshStandardMaterialParameters {
    type: 'inject';
    params?: TexturePreset;
}
type InjectMaterial = THREE.MeshStandardMaterial & {
    uniforms: Record<string, THREE.IUniform>;
};
declare function material(texture: Texture, options: ShaderMaterialOptions): THREE.ShaderMaterial;
declare function material(texture: Texture, options: InjectMaterialOptions): InjectMaterial;
declare function material(texture: Texture, options?: BakeMaterialOptions): THREE.MeshStandardMaterial;

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
declare const xthree: {
    init({ canvas, camera }: {
        canvas: HTMLCanvasElement;
        camera?: THREE.Camera | null;
    }): UnitPromise;
    nest(transform?: Transform): THREE.Group;
    add(object: any): any;
    material: typeof material;
    project: typeof project;
    Pin: typeof Pin;
    Plane: typeof Plane;
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};
declare function project(point: THREE.Vector3): {
    x: number;
    y: number;
} | null;
interface PinProps {
    point: () => THREE.Vector3 | null;
    gap?: number;
    frame?: HTMLElement;
}
declare function Pin(unit: xnew.Unit, { point, ...others }: PinProps): void;
interface PlaneProps {
    object: () => THREE.Object3D | null;
    frame?: HTMLElement;
    className?: string;
    style?: string;
}
declare function Plane(unit: xnew.Unit, { object, ...others }: PlaneProps): void;

export { Pin, Plane, project, xthree };
