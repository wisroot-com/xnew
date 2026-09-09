//----------------------------------------------------------------------------------------------------
// Plane — a DOM element laid flat into the 3D scene of the canvas under it
// The placement arrives as an object-to-view matrix, so whoever owns the scene does the viewing
// (xthree.Plane) and this stays plain DOM: it only turns that matrix into the CSS projection.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export interface PlaneProps {
    // where the element sits, as a column-major object-to-view matrix (y up, camera at the origin looking down -z); null while it cannot be placed
    matrix: () => number[] | null;
    // the camera's vertical field of view in degrees, which is what makes one unit of `matrix` one CSS pixel
    fov: () => number;
    // the element the projection lands on (the canvas on screen); omit it when the plane sits in that very box
    frame?: HTMLElement;
    className?: string;
    style?: string;
    [key: string]: any;
}

// CSS measures y downward, so the matrix is conjugated with a y flip: row 1 and column 1 change sign (their crossing twice, so not at all)
const FLIP = [1, -1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1];

// CSS has no exponent notation, so a value that lands on 1e-15 is rejected outright and leaves the last frame's transform in place
function fixed(value: number): string {
    return value.toFixed(6);
}

// Create it inside a positioned box, as Pin wants — left / top are percentages of that box, and it is the canvas box unless `frame` names another (what fit: 'cover' needs, where the canvas runs past the box it is seen through). Unlike Pin the element keeps its pointer events, since a plane carries content to press.
export function Plane(unit: xnew.Unit, { matrix, fov, frame, className = '', style = '', ...others }: PlaneProps): void {
    const css = xnew.css('base', {
        // the corner origin is what lets left / top alone put the projection's center on the frame's center
        plane: `
                position: absolute; left: 0; top: 0;
                transform-origin: 0 0;
                user-select: none;
            `,
    });

    xnew.nest({ tag: 'div', className: `${css.plane} ${className}`, style, ...others });

    // content added afterwards moves unit.current onto itself, so the element to place is caught here
    const element = unit.current as HTMLElement;

    let height = 0;   // the frame, in CSS pixels — the one length the projection is built from

    // the frame only moves and resizes with the layout around it, so this stays out of the per-frame path
    function measure(): void {
        const box = element.parentElement;

        if (box === null || box.clientWidth === 0 || box.clientHeight === 0) {
            return;
        }

        const outer = box.getBoundingClientRect();
        const inner = frame !== undefined && frame !== box ? frame.getBoundingClientRect() : outer;

        height = inner.height;

        // the vanishing point is the frame's center, so that is where the element's own origin goes
        element.style.left = `${(((inner.left + inner.width / 2) - outer.left) / outer.width * 100).toFixed(3)}%`;
        element.style.top = `${(((inner.top + inner.height / 2) - outer.top) / outer.height * 100).toFixed(3)}%`;
    }
    measure();

    unit.on('resize', measure);
    unit.on('window.resize', measure);   // the box can move without this element changing size

    function place(): void {
        const view = matrix();
        // the eye distance that makes the CSS projection agree with the camera's; it is also what fixes one unit at one pixel
        const eye = height / 2 / Math.tan(fov() * Math.PI / 360);

        // an object at or behind the eye projects to garbage rather than to nothing, so it is dropped here
        const placeable = view !== null && view[14] < 0 && eye > 0 && Number.isFinite(eye);

        // hidden rather than removed, so the frame keeps being measurable while the object is unplaceable
        element.style.visibility = placeable ? 'visible' : 'hidden';

        if (placeable) {
            const css = (view as number[]).map((value, index) => fixed(value * FLIP[index])).join(',');
            // perspective / translateZ put the eye where the camera is; translate centers the element on the object's origin
            element.style.transform = `perspective(${fixed(eye)}px) translateZ(${fixed(eye)}px) matrix3d(${css}) translate(-50%, -50%)`;
        }
    }
    place();   // so the first frame is not spent flat against the box

    unit.on('update', place);
}
