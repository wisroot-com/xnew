//----------------------------------------------------------------------------------------------------
// models / Tatami — a tatami floor; grid counts the room in half-mat cells ([1,1] 半畳 / [2,1] 一畳 / [3,3] 四畳半)
// The underside sits at y = 0 like the other models, so the mats stand on the floor plane and the top face is at thickness.
// Mats are laid so that no four of them meet at a point (祝儀敷き) — that rule is what turns 3x3 into the windmill.
//----------------------------------------------------------------------------------------------------

import { xnew, xtextures } from '@mulsense/xnew';
import * as THREE from 'three';
import { nest, add, type Transform } from '../graph';
import { standard } from '../material';
import type { TexturePreset } from '../../../textures/xtextures';

export interface TatamiProps extends Transform {
    // the short side of one mat = one grid cell, in world units
    size?: number;
    // the room in half-mat cells along x / z: [1,1] 半畳, [2,1] / [1,2] 一畳, [3,3] 四畳半
    grid?: [number, number];
    thickness?: number;
    // xtextures.tatami params; scale / aspect follow the geometry and the seed is walked per mat, so those three are the model's own
    texture?: TexturePreset;
}

export function Tatami(unit: xnew.Unit,
    {
        size = 1, grid = [2, 1], thickness = 0.06, texture = {},
        position, rotation, scale,
    }: TatamiProps = {}
) {
    nest({ position, rotation, scale });

    const [cols, rows] = grid;
    const geometries: Record<number, THREE.ExtrudeGeometry> = {};   // one per mat shape (half / full), shared by every mat of it

    layout(cols, rows).forEach(({ x, z, aspect, turned }, index) => {
        const geometry = geometries[aspect] ?? (geometries[aspect] = makeGeometry(size, aspect, thickness));
        const mesh = add(new THREE.Mesh(geometry, standard(xtextures.tatami, {
            // scale = worldSize = the short side, so the bake window carries exactly one mat; the seed is walked so neighbours don't repeat
            params: { ...texture, scale: size, aspect, seed: ((texture.seed as number) ?? 0) + index * 13 },
            worldSize: size,
            size: { width: Math.round(512 * aspect), height: 512 },
            roughness: 1,
        })));
        mesh.rotation.y = turned ? Math.PI / 2 : 0;
        mesh.position.set((x - cols / 2) * size, thickness / 2, (z - rows / 2) * size);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    });
}

//----------------------------------------------------------------------------------------------------
// laying — which mat goes where, in half-mat cells
//----------------------------------------------------------------------------------------------------

// x / z are the mat's center in cell units; aspect 2 = a full mat, 1 = a half one; turned runs it along z
interface Placement { x: number, z: number, aspect: number, turned: boolean }

// the order the options are tried at each cell: long in x, long in z, then the half mat
const OPTIONS: { aspect: number, turned: boolean }[] = [
    { aspect: 2, turned: false },
    { aspect: 2, turned: true },
    { aspect: 1, turned: false },
];

const STEP_LIMIT = 20000;   // real rooms are solved in a few hundred steps; the cap only keeps a pathological grid from hanging

// the half mat goes to the middle first (a room only needs one when both sides are odd, so the middle is a single cell) — for 3x3 that leaves the windmill as the only way to lay the rest
function layout(cols: number, rows: number): Placement[] {
    const odd = (cols * rows) % 2 === 1;
    return solve(cols, rows, true) ?? (odd ? solve(cols, rows, false) : null) ?? straight(cols, rows);
}

// depth-first over the cells in reading order, backtracking whenever a mat would complete a four-mat corner
function solve(cols: number, rows: number, centered: boolean): Placement[] | null {
    const owner = new Int32Array(cols * rows).fill(-1);
    const placements: Placement[] = [];
    let halves = (cols * rows) % 2;
    let steps = 0;

    function put(x: number, z: number, aspect: number, turned: boolean): void {
        for (let i = 0; i < aspect; i++) {
            owner[(z + (turned ? i : 0)) * cols + x + (turned ? 0 : i)] = placements.length;
        }
        placements.push({ x: x + (turned ? 0.5 : aspect / 2), z: z + (turned ? aspect / 2 : 0.5), aspect, turned });
    }

    function undo(x: number, z: number, aspect: number, turned: boolean): void {
        for (let i = 0; i < aspect; i++) {
            owner[(z + (turned ? i : 0)) * cols + x + (turned ? 0 : i)] = -1;
        }
        placements.pop();
    }

    // free means every cell the mat would take is inside the room and still empty
    function free(x: number, z: number, aspect: number, turned: boolean): boolean {
        const ex = x + (turned ? 0 : aspect - 1), ez = z + (turned ? aspect - 1 : 0);
        return ex < cols && ez < rows && owner[ez * cols + ex] === -1;
    }

    // a vertex is fine unless its four cells are all laid and all belong to different mats
    function corner(vx: number, vz: number): boolean {
        let fine = true;
        if (vx > 0 && vz > 0 && vx < cols && vz < rows) {
            const ids = [owner[(vz - 1) * cols + vx - 1], owner[(vz - 1) * cols + vx], owner[vz * cols + vx - 1], owner[vz * cols + vx]];
            fine = ids.includes(-1) || new Set(ids).size < 4;
        }
        return fine;
    }

    // only the vertices around the mat just laid can have become a four-mat corner
    function valid(x: number, z: number, aspect: number, turned: boolean): boolean {
        let ok = true;
        for (let i = 0; i < aspect; i++) {
            const cx = x + (turned ? 0 : i), cz = z + (turned ? i : 0);
            ok = ok && corner(cx, cz) && corner(cx + 1, cz) && corner(cx, cz + 1) && corner(cx + 1, cz + 1);
        }
        return ok;
    }

    function fill(from: number): boolean {
        let index = from;
        while (index < owner.length && owner[index] !== -1) {
            index++;
        }
        let done = index === owner.length;
        if (done === false && ++steps < STEP_LIMIT) {
            const x = index % cols, z = Math.floor(index / cols);
            for (const { aspect, turned } of OPTIONS) {
                if ((aspect === 2 || halves > 0) && free(x, z, aspect, turned)) {
                    halves -= aspect === 1 ? 1 : 0;
                    put(x, z, aspect, turned);
                    done = valid(x, z, aspect, turned) && fill(index + 1);
                    if (done === false) {
                        undo(x, z, aspect, turned);
                        halves += aspect === 1 ? 1 : 0;
                    }
                }
                if (done) {
                    break;
                }
            }
        }
        return done;
    }

    if (centered && halves === 1) {
        put((cols - 1) / 2, (rows - 1) / 2, 1, false);
        halves = 0;
    }
    return fill(0) ? placements : null;
}

// last resort for a room no proper laying fits: straight rows, with a half mat wherever one is left over
function straight(cols: number, rows: number): Placement[] {
    const placements: Placement[] = [];
    for (let z = 0; z < rows; z++) {
        for (let x = 0; x < cols; x++) {
            const aspect = x + 1 < cols ? 2 : 1;
            placements.push({ x: x + aspect / 2, z: z + 0.5, aspect, turned: false });
            x += aspect - 1;
        }
    }
    return placements;
}

//----------------------------------------------------------------------------------------------------
// geometry — one mat slab, mapped so the one baked tatami cell wraps every face
//----------------------------------------------------------------------------------------------------

// a chamfered slab; the outline is pulled in by the chamfer so the bevel brings the widest point back to the real size
function makeGeometry(size: number, aspect: number, thickness: number): THREE.ExtrudeGeometry {
    const chamfer = thickness * 0.15;   // without it the mat edge stands up like a blade
    const length = size * aspect;
    const hx = length / 2 - chamfer, hz = size / 2 - chamfer;
    const shape = new THREE.Shape()
        .moveTo(-hx, -hz).lineTo(hx, -hz).lineTo(hx, hz).lineTo(-hx, hz).lineTo(-hx, -hz);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness - 2 * chamfer,
        bevelEnabled: true, bevelSegments: 1, bevelOffset: 0,
        bevelSize: chamfer, bevelThickness: chamfer,
    });
    geometry.rotateX(-Math.PI / 2);   // lay the extrusion (+z) down onto up (+y)
    geometry.center();
    applyUv(geometry, size, aspect, thickness);
    return geometry;
}

// map the one tatami cell face by face — there is no separate side material, so changing the heri color
// or width follows onto the sides too. ExtrudeGeometry is non-indexed, so normals identify the faces.
function applyUv(geometry: THREE.ExtrudeGeometry, size: number, aspect: number, thickness: number): void {
    const length = size * aspect;
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const depth = 0.5 - position.getY(i) / thickness;           // 0 = top side / 1 = underside
        if (Math.abs(normal.getY(i)) > 0.3) {
            // top / bottom / chamfer: planar projection, so the weave wraps over the chamfer and the heri keeps its edge
            uv.setXY(i, 0.5 + x / length, 0.5 - z / size);
        } else if (Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i))) {
            // short sides: tracing v (the short axis) puts the heri at both ends; u stays just inside the seam,
            // tilted slightly along the thickness so the normal map keeps a valid tangent frame
            const u = normal.getX(i) > 0 ? 0.97 - 0.02 * depth : 0.03 + 0.02 * depth;
            uv.setXY(i, u, 0.5 - z / size);
        } else {
            // long sides: run along the length inside the heri band (where v is 0 / 1)
            const v = normal.getZ(i) > 0 ? 0.006 + 0.01 * depth : 0.994 - 0.01 * depth;
            uv.setXY(i, 0.5 + x / length, v);
        }
    }
    uv.needsUpdate = true;
}
