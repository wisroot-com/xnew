//----------------------------------------------------------------------------------------------------
// models / Chabudai — a round low table: a rounded-edge top plus straight legs
// The top is a lathed side + two discs rather than one cylinder, so the face keeps its flat (growth
// ring) UV while the side gets a horizontally flowing grain — three bakes of the same wood params.
//----------------------------------------------------------------------------------------------------

import { xnew, xtextures } from '@mulsense/xnew';
import * as THREE from 'three';
import { nest, add, type Transform } from '../graph';
import { standard } from '../material';
import type { TexturePreset } from '../../../textures/xtextures';

export interface ChabudaiProps extends Transform {
    radius?: number;
    thickness?: number;
    height?: number;
    legs?: number;
    legRadius?: number;
    // xtextures.wood params, merged over the hinoki preset the model is tuned for
    texture?: TexturePreset;
}

export function Chabudai(unit: xnew.Unit,
    {
        radius = 0.7, thickness = 0.07, height = 0.25, legs = 4, legRadius = 0.03,
        texture = {}, position, rotation, scale,
    }: ChabudaiProps = {}
) {
    nest({ position, rotation, scale });

    const wood = { ...xtextures.wood.presets.hinoki, ...texture };
    const edge = thickness * 0.35;              // the radius the top / bottom rim is rounded with
    const capRadius = radius - edge;            // where the rounded rim ends and the flat face begins

    const side = add(new THREE.Mesh(makeSideGeometry(radius, thickness, edge), standard(xtextures.wood, {
        // a wide canvas makes the grain flow horizontally; tiling it 3 times around keeps it fine
        size: { width: 512, height: 64 }, worldSize: 1.5, params: wood,
        tile: true, repeat: { x: 3, y: 1 }, roughness: 0.65,
    })));
    side.position.y = height;
    side.castShadow = true;
    side.receiveShadow = true;

    const top = add(new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), standard(xtextures.wood, {
        size: { width: 512, height: 512 }, worldSize: 1.5, params: wood, roughness: 0.55,
    })));
    top.rotation.x = -Math.PI / 2;
    top.position.y = height + thickness / 2;
    top.castShadow = true;
    top.receiveShadow = true;

    const bottom = add(new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 })));
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = height - thickness / 2;
    bottom.castShadow = true;

    // +90 turns the grain upright without losing the preset's own slant
    const legMaterial = standard(xtextures.wood, {
        size: { width: 128, height: 256 }, worldSize: 1, params: { ...wood, angle: (wood.angle as number) + 90 }, roughness: 0.6,
    });
    const legHeight = height - thickness / 2;   // floor up to the underside of the top
    for (let i = 0; i < legs; i++) {
        const angle = Math.PI / legs + i * 2 * Math.PI / legs;
        const leg = add(new THREE.Mesh(makeLegGeometry(legRadius, legRadius * 1.2, legHeight), legMaterial));
        const r = radius * 0.85;                // just inside the rim
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.castShadow = true;
    }
}

// the side profile revolved around y: a quarter circle at each rim, straight in between. Lathe spreads v
// by point index, so the rims are subdivided at the same rate as the straight part to keep the grain even.
function makeSideGeometry(radius: number, thickness: number, edge: number): THREE.LatheGeometry {
    const capRadius = radius - edge;
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 4; i++) {                   // bottom rim (-90° → 0°)
        const t = -Math.PI / 2 + Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + edge * Math.cos(t), -thickness / 2 + edge + edge * Math.sin(t)));
    }
    profile.push(new THREE.Vector2(radius, 0));
    for (let i = 0; i <= 4; i++) {                   // top rim (0° → 90°)
        const t = Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + edge * Math.cos(t), thickness / 2 - edge + edge * Math.sin(t)));
    }
    return new THREE.LatheGeometry(profile, 64);
}

// a tapered leg with both rims chamfered; the straight run is subdivided because Lathe spreads v by point index — otherwise the chamfers would eat most of the grain
function makeLegGeometry(radiusTop: number, radiusBottom: number, height: number, segments = 8): THREE.LatheGeometry {
    const chamfer = Math.min(radiusTop, radiusBottom) * 0.25;
    const half = height / 2;
    const profile: THREE.Vector2[] = [new THREE.Vector2(0, -half), new THREE.Vector2(radiusBottom - chamfer, -half)];
    for (let i = 0; i <= segments; i++) {            // the straight side, chamfer to chamfer
        const t = i / segments;
        profile.push(new THREE.Vector2(radiusBottom + (radiusTop - radiusBottom) * t, -half + chamfer + (height - 2 * chamfer) * t));
    }
    profile.push(new THREE.Vector2(radiusTop - chamfer, half), new THREE.Vector2(0, half));
    return new THREE.LatheGeometry(profile, 16);
}
