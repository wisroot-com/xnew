//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration: ties the Three scene graph to the xnew unit tree
// The facade only assembles the pieces: the scene graph lives in ./graph, the texture-backed materials
// in ./material, and the ready-made model components in ./models.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import type * as THREE from 'three';
import { initialize, nest, add, Root } from './graph';
import { material } from './material';
import { models } from './models/models';

export const xthree = {
    initialize,
    // create a group Object3D and move the current parent into it (stateful); options set its transform only — never an existing object.
    nest,
    // attach a display object to the current parent; the current parent stays unchanged
    add,
    // build a three material from an xtextures texture object (see material.ts)
    material,
    // ready-made model components: xnew(xthree.models.Chabudai, { … })
    models,
    get renderer() {
        return xnew.context(Root)?.renderer;
    },
    get camera(): THREE.Camera {
        return xnew.context(Root)?.camera;
    },
    get scene(): THREE.Scene {
        return xnew.context(Root)?.scene;
    },
    get canvas(): HTMLCanvasElement {
        return xnew.context(Root)?.canvas;
    },
};
