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
    nest(object: any): any;
    add(object: any): any;
    remove(object: any): void;
    dispose(object: any): void;
    coord2dTo3d(x: number, y: number, z?: number): THREE.Vector3;
    coord3dTo2d(x: number, y: number, z: number): THREE.Vector2;
    finalize(): void;
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { xthree };
