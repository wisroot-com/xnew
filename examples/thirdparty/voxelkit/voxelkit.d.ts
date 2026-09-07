declare class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x: number, y: number, z: number);
    length(): number;
    array(): [number, number, number];
    static add(vec0: Vec3, vec1: Vec3): Vec3;
    static sub(vec0: Vec3, vec1: Vec3): Vec3;
    static mul(vec0: Vec3, scale: number): Vec3;
    static dot(vec0: Vec3, vec1: Vec3): number;
}

interface Composit {
    models: Model[];
    bones: Bone[];
    dsize: [number, number, number];
}
declare class Model {
    name: string;
    indices: Int32Array;
    vertexs: Float32Array;
    normals: Float32Array;
    coords: Float32Array;
    colors: Int8Array;
    constructor(name: string, size: number);
}
declare class Bone {
    parent: Bone | null;
    name: string;
    refs: number[];
    vec0: Vec3;
    vec1: Vec3;
    constructor(parent: Bone | null, name: string, vec0: Vec3, vec1: Vec3, refs: number[]);
    offset(): Vec3;
    distance(vec: Vec3): number;
}

declare const voxelkit: {
    load(path: string, { scale, chamfer }?: {
        scale?: number | null;
        chamfer?: number;
    }): any;
    parse(blob: Blob, { scale, chamfer, extension }?: {
        scale?: number | null;
        chamfer?: number;
        extension?: string;
    }): Promise<Composit[]>;
    convertVRM(composit: Composit): Promise<Uint8Array<ArrayBufferLike>>;
};

export { voxelkit as default };
