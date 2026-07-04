import * as THREE from 'three';

declare class UnitPromise {
    private promise;
    key?: string;
    constructor(promise: Promise<any>, key?: string);
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
    finalize(): void;
    readonly renderer: any;
    readonly camera: THREE.Camera;
    readonly scene: THREE.Scene;
    readonly canvas: HTMLCanvasElement;
};

export { xthree };
