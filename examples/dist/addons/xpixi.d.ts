import * as PIXI from 'pixi.js';

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

declare const xpixi: {
    init({ canvas }: {
        canvas: HTMLCanvasElement;
    }): UnitPromise;
    nest(options?: {
        position?: {
            x: number;
            y: number;
        };
        scale?: number | {
            x: number;
            y: number;
        };
        rotation?: number;
    }): PIXI.Container;
    add(object: any): any;
    readonly renderer: any;
    readonly scene: PIXI.Container;
    readonly canvas: HTMLCanvasElement;
};

export { xpixi };
