//----------------------------------------------------------------------------------------------------
// models / Zabuton — a floor cushion: a puffed superellipsoid, piping along the seam, a tuft in the dimple
// The underside sits at y = 0 like the other models, and `top` is the dimpled center = where a sitter goes.
//----------------------------------------------------------------------------------------------------

import { xnew, xtextures } from '@mulsense/xnew';
import * as THREE from 'three';
import { nest, add, type Transform } from '../graph';
import { standard } from '../material';
import type { TexturePreset } from '../../../textures/xtextures';

export interface ZabutonProps extends Transform {
    // the side of the square, in world units
    size?: number;
    thickness?: number;
    // xtextures.carpet params for the cloth, merged over the velvet-ish weave the model is tuned for
    texture?: TexturePreset;
    // the piping around the seam and the tuft in the middle; plain colors, since neither is textured
    piping?: THREE.ColorRepresentation;
    knot?: THREE.ColorRepresentation;
}

// a fine, dense pile reads as velvet at cushion scale (scale follows size, so it stays fine at any size)
const CLOTH: TexturePreset = {
    density: 60, fluff: 0.95, swirl: 0.15, shade: 0.12, bump: 0.25,
    color: [0.30, 0.34, 0.46],
    background: [0.20, 0.23, 0.33],
};

const DIMPLE = 0.3;   // how deep the tie pulls the middle in, as a share of the half thickness

export function Zabuton(unit: xnew.Unit,
    {
        size = 0.4, thickness = 0.06, texture = {}, piping = 0xd8cbb0, knot = 0x232a3d,
        position, rotation, scale,
    }: ZabutonProps = {}
) {
    nest({ position, rotation, scale });

    const cushion = add(new THREE.Mesh(makeCushionGeometry(size, thickness), standard(xtextures.carpet, {
        size: { width: 512, height: 512 }, worldSize: size * 0.2, tile: true, repeat: { x: 3, y: 3 },
        params: { ...CLOTH, scale: size * 0.05, ...texture },
        roughness: 0.95,
    })));
    cushion.position.y = thickness / 2;
    cushion.castShadow = true;
    cushion.receiveShadow = true;

    // the piping runs the seam at the widest line, which is what makes the square read from far away
    const outline: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
        const omega = 2 * Math.PI * (i / 96);
        outline.push(new THREE.Vector3(size / 2 * spow(Math.cos(omega), 0.25), 0, size / 2 * spow(Math.sin(omega), 0.25)));
    }
    const seam = add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 192, size * 0.016, 8, true),
        new THREE.MeshStandardMaterial({ color: piping, roughness: 0.85 })));
    seam.position.y = thickness / 2;
    seam.castShadow = true;

    const tuft = add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.045, 16, 12), new THREE.MeshStandardMaterial({ color: knot, roughness: 0.9 })));
    tuft.scale.y = 0.55;
    tuft.position.y = thickness * (1 - DIMPLE / 2) - size * 0.01;   // sunk into the dimple
    tuft.castShadow = true;

    return {
        // the height of the dimpled center: put whatever sits on the cushion here
        get top() { return thickness * (1 - DIMPLE / 2); },
    };
}

// one closed superellipsoid: the plan is a rounded square, the sides are flat-ish, and the middle dimples where it is tied
function makeCushionGeometry(size: number, thickness: number, segments = 64): THREE.BufferGeometry {
    const half = size / 2, halfThickness = thickness / 2;
    const rows = segments / 2;
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
        const eta = -Math.PI / 2 + Math.PI * (i / rows);
        const ce = spow(Math.cos(eta), 0.6), se = spow(Math.sin(eta), 0.6);
        for (let j = 0; j <= segments; j++) {
            const omega = -Math.PI + 2 * Math.PI * (j / segments);
            const x = half * ce * spow(Math.cos(omega), 0.25);
            const z = half * ce * spow(Math.sin(omega), 0.25);
            const distance = Math.hypot(x, z) / half;
            const y = halfThickness * (se - Math.sign(se) * DIMPLE * Math.exp(-distance * distance / 0.02));
            positions.push(x, y, z);
            uvs.push(0.5 + x / size, 0.5 + z / size);
        }
    }
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j, b = a + segments + 1;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

// signed power — the superellipse outline needs the sign kept through the exponent
function spow(value: number, exponent: number): number {
    return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}
