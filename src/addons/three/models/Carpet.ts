//----------------------------------------------------------------------------------------------------
// models / Carpet — a square carpet on the xz plane, one baked tile repeated over it
// fade lets the outer ring dissolve on an alphaMap, so a floor can run past the camera without ever showing its edge.
//----------------------------------------------------------------------------------------------------

import { xnew, xtextures } from '@mulsense/xnew';
import * as THREE from 'three';
import { nest, add, type Transform } from '../graph';
import { standard } from '../material';
import type { TexturePreset } from '../../../textures/xtextures';

export interface CarpetProps extends Transform {
    // the side of the square, in world units
    size?: number;
    // the world size of one baked tile; the map repeats size / tile times per axis
    tile?: number;
    // opaque up to the solid radius, fully transparent from the clear radius out
    fade?: { solid: number, clear: number };
    // xtextures.carpet params; the tile size is the model's own (it drives worldSize / repeat)
    texture?: TexturePreset;
}

export function Carpet(unit: xnew.Unit,
    {
        size = 12, tile = 2, fade, texture = {},
        position, rotation, scale,
    }: CarpetProps = {}
) {
    nest({ position, rotation, scale });

    const mesh = add(new THREE.Mesh(new THREE.PlaneGeometry(size, size), standard(xtextures.carpet, {
        size: { width: 1024, height: 1024 }, worldSize: tile, params: texture,
        tile: true, repeat: { x: size / tile, y: size / tile },
        roughness: 1,
        ...(fade === undefined ? {} : { transparent: true, alphaMap: makeFadeAlpha(size, fade) }),
    })));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
}

// a radial gradient, opaque at the center and clear at the rim; unlike the tiled map this is drawn once over the whole plane
function makeFadeAlpha(size: number, { solid, clear }: { solid: number, clear: number }, resolution = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = resolution;
    const context = canvas.getContext('2d')!;
    const half = size / 2;
    const gradient = context.createRadialGradient(resolution / 2, resolution / 2, 0, resolution / 2, resolution / 2, resolution / 2);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(Math.min(solid / half, 1), '#fff');
    gradient.addColorStop(Math.min(clear / half, 1), '#000');
    gradient.addColorStop(1, '#000');
    context.fillStyle = gradient;
    context.fillRect(0, 0, resolution, resolution);
    return new THREE.CanvasTexture(canvas);
}
