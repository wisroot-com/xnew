import * as PIXI from 'pixi.js';

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

declare const xpixi: {
    initialize({ canvas }: {
        canvas: HTMLCanvasElement;
    }): UnitPromise;
    nest(object: any): any;
    add(object: any): any;
    remove(object: any): void;
    load(source: string | string[]): any;
    finalize(): void;
    readonly renderer: any;
    readonly scene: PIXI.Container;
    readonly canvas: HTMLCanvasElement;
};

export { xpixi };
