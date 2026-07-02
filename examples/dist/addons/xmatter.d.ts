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

declare const xmatter: {
    initialize({}?: any): UnitPromise;
    readonly engine: any;
    readonly world: any;
};

export { xmatter };
