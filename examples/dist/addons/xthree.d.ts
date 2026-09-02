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
        shader(texture: any, params: Record<string, any>): THREE.ShaderMaterial;
        standard(texture: any, options: Record<string, any>): THREE.MeshStandardMaterial;
    };
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { xthree };
