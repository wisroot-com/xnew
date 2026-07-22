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
    dispose(object: any): void;
    texture(texture: any, params?: Record<string, any>): THREE.ShaderMaterial;
    coord2dTo3d(x: number, y: number, z?: number): THREE.Vector3;
    coord3dTo2d(x: number, y: number, z: number): THREE.Vector2;
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { xthree };
