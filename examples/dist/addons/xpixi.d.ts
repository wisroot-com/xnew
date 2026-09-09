import { xnew } from '@mulsense/xnew';
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

interface Transform {
    position?: {
        x: number;
        y: number;
    };
    scale?: number | {
        x: number;
        y: number;
    };
    rotation?: number;
}
declare const xpixi: {
    init({ canvas }: {
        canvas: HTMLCanvasElement;
    }): UnitPromise;
    nest(transform?: Transform): PIXI.Container;
    add(object: any): any;
    project: typeof project;
    Pin: typeof Pin;
    readonly renderer: any;
    readonly scene: PIXI.Container;
    readonly canvas: HTMLCanvasElement;
};
declare function project(point: {
    x: number;
    y: number;
}, from?: PIXI.Container): {
    x: number;
    y: number;
} | null;
interface PinProps {
    point: () => {
        x: number;
        y: number;
    } | null;
    space?: PIXI.Container;
    gap?: number;
    frame?: HTMLElement;
}
declare function Pin(unit: xnew.Unit, { point, space, ...others }: PinProps): void;

export { Pin, project, xpixi };
