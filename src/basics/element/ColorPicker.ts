//----------------------------------------------------------------------------------------------------
// ColorPicker — Sketch-style color picker: saturation map + preset row + hue / alpha bars + hex / RGBA fields
// Color state is held as HSVA in JS (no native control); hosts read / write `.value` (hex string)
// and observe edits like a native input: `input` streams while a bar is dragged, `change` once it settles.
// The chrome follows the theme (currentColor + surfaceColor); only the color space itself is fixed rgb.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchChange, dispatchCommit, dispatchInput, surfaceColor } from '../../utils/dom';
import { Hsva, formatHex, hasHexAlpha, hsvaToRgba, parseHex, rgbaToHsva } from '../../utils/color';
import { clamp } from '../../utils/math';

const PRESETS = [
    '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321', '#417505', '#BD10E0', '#9013FE',
    '#4A90E2', '#50E3C2', '#B8E986',
];

const CHECKERBOARD = 'conic-gradient(#ccc 0% 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75% 100%)';

export function ColorPicker(unit: xnew.Unit,
    { value = '#4A90E2', presets = PRESETS, alpha = true, disabled = false, className = '', style = '', ...others }:
    { value?: string, presets?: string[], alpha?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            box-sizing: content-box; width: 200px;
            padding: 10px 10px 0;
            border-radius: 4px;
            box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 25%, transparent), 0 8px 16px rgba(0, 0, 0, 0.15);
            user-select: none;
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
        saturation: `
            position: relative; height: 150px;
            background-image: linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
            touch-action: none;
        `,
        circle: `
            position: absolute; width: 4px; height: 4px;
            border-radius: 50%;
            box-shadow: 0 0 0 1.5px #fff, inset 0 0 1px 1px rgba(0, 0, 0, 0.3), 0 0 1px 2px rgba(0, 0, 0, 0.4);
            transform: translate(-2px, -2px);
            pointer-events: none;
        `,
        controls: `display: flex; padding-top: 4px;`,
        bars: `flex: 1 1 0;`,
        bar: `position: relative; height: 10px; touch-action: none;`,
        hue: `background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);`,
        alphaTrack: `
            margin-top: 4px;
            background-image: ${CHECKERBOARD}; background-size: 8px 8px;
        `,
        overlay: `position: absolute; inset: 0; pointer-events: none;`,
        pointer: `
            position: absolute; top: 0; bottom: 0; width: 4px;
            background: #fff; border-radius: 1px;
            box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
            transform: translateX(-2px);
            pointer-events: none;
        `,
        swatch: `
            position: relative; width: 24px; margin-right: 4px;
            border-radius: 3px; overflow: hidden;
            background-image: ${CHECKERBOARD}; background-size: 8px 8px;
            &::after { content: ''; position: absolute; inset: 0; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
        `,
        fields: `display: flex; padding: 4px 0 10px;`,
        field: `
            flex: 1 1 0; padding-left: 6px;
            &:first-child { flex: 2 2 0; padding-left: 0; }
        `,
        fieldInput: `
            box-sizing: border-box; width: 100%;
            margin: 0; padding: 4px 0 3px;
            border: none; outline: none;
            box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);
            background: transparent; color: inherit;
            font: inherit; font-size: 11px; text-align: center;
            user-select: text;
        `,
        fieldLabel: `
            padding-top: 3px;
            font-size: 11px; text-align: center; opacity: 0.7;
        `,
        // 4px bottom margin + the controls row's 4px top padding = the same 8px gap as above
        presets: `
            display: flex; gap: 3px;
            margin: 8px 0 4px;
        `,
        preset: `
            flex: 1 1 0; height: 16px;
            border-radius: 3px;
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
            cursor: pointer;
        `,
    });

    let hsva = rgbaToHsva(parseHex(value) ?? { r: 74, g: 144, b: 226, a: 1 });
    if (alpha === false) {
        hsva = { ...hsva, a: 1 };
    }

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined, ...others }) as HTMLElement;
    container.style.background = surfaceColor(container);
    unit.on('pointerdown', ({ event }: { event: PointerEvent }) => event.stopPropagation());

    // the element is captured, so these need no xnew.scope even though apply() runs in the drag zones' scopes
    function notify(kind: 'input' | 'change' | 'commit') {
        const hex = formatHex(hsvaToRgba(hsva));
        if (kind === 'input') {
            dispatchInput(container, hex);
        } else if (kind === 'change') {
            dispatchChange(container, hex);
        } else {
            dispatchCommit(container, hex);
        }
    }

    let saturationElement: HTMLElement;
    let circleElement: HTMLElement;
    let huePointer: HTMLElement;
    let alphaOverlay: HTMLElement | null = null;
    let alphaPointer: HTMLElement | null = null;
    let swatchOverlay: HTMLElement;
    let fieldHex: xnew.Unit;
    let fieldR: xnew.Unit;
    let fieldG: xnew.Unit;
    let fieldB: xnew.Unit;
    let fieldA: xnew.Unit | null = null;

    // saturation map: x = saturation, y = value (bright at the top)
    xnew((zone: xnew.Unit) => {
        saturationElement = xnew.nest({ tag: 'div', className: css.saturation }) as HTMLElement;
        circleElement = xnew({ tag: 'div', className: css.circle }).current as HTMLElement;
        zone.on('dragstart dragmove', ({ position }: { position: { x: number, y: number } }) => {
            const rect = zone.current.getBoundingClientRect();
            // a picker hidden mid-drag reports a 0 rect: apply() clamps out-of-range offsets, but a 0 / 0 NaN would slip through it into hsva
            const x = rect.width > 0 ? position.x / rect.width : 0;
            const y = rect.height > 0 ? position.y / rect.height : 0;
            apply({ ...hsva, s: x, v: 1 - y }, 'input');
        });
        zone.on('dragend', () => notify('change'));
    });

    // one preset swatch row under the saturation map
    if (presets.length > 0) {
        xnew(() => {
            xnew.nest({ tag: 'div', className: css.presets });
            for (const preset of presets) {
                const rgba = parseHex(preset);
                if (rgba !== null) {
                    xnew((swatch: xnew.Unit) => {
                        xnew.nest({ tag: 'div', className: css.preset, style: `background: ${formatHex(rgba)};`, title: preset });
                        swatch.on('click', () => apply(rgbaToHsva(rgba), 'commit'));
                    });
                }
            }
        });
    }

    // the preview swatch beside the hue / alpha bars
    xnew(() => {
        xnew.nest({ tag: 'div', className: css.controls });
        xnew(() => {
            xnew.nest({ tag: 'div', className: css.swatch });
            swatchOverlay = xnew({ tag: 'div', className: css.overlay }).current as HTMLElement;
        });
        xnew(() => {
            xnew.nest({ tag: 'div', className: css.bars });
            xnew((zone: xnew.Unit) => {
                xnew.nest({ tag: 'div', className: `${css.bar} ${css.hue}` });
                huePointer = xnew({ tag: 'div', className: css.pointer }).current as HTMLElement;
                zone.on('dragstart dragmove', ({ position }: { position: { x: number, y: number } }) => {
                    const rect = zone.current.getBoundingClientRect();
                    const x = rect.width > 0 ? position.x / rect.width : 0;
                    apply({ ...hsva, h: x * 360 }, 'input');
                });
                zone.on('dragend', () => notify('change'));
            });
            if (alpha === true) {
                xnew((zone: xnew.Unit) => {
                    xnew.nest({ tag: 'div', className: `${css.bar} ${css.alphaTrack}` });
                    alphaOverlay = xnew({ tag: 'div', className: css.overlay }).current as HTMLElement;
                    alphaPointer = xnew({ tag: 'div', className: css.pointer }).current as HTMLElement;
                    zone.on('dragstart dragmove', ({ position }: { position: { x: number, y: number } }) => {
                        const rect = zone.current.getBoundingClientRect();
                        const x = rect.width > 0 ? position.x / rect.width : 0;
                        apply({ ...hsva, a: x }, 'input');
                    });
                    zone.on('dragend', () => notify('change'));
                });
            }
        });
    });

    // hex / RGBA readouts: commit on change, restore the display when the text does not parse
    xnew(() => {
        xnew.nest({ tag: 'div', className: css.fields });
        fieldHex = xnew(Field, { label: 'Hex', commit: commitHex });
        fieldR = xnew(Field, { label: 'R', commit: (text: string) => commitChannel('r', text) });
        fieldG = xnew(Field, { label: 'G', commit: (text: string) => commitChannel('g', text) });
        fieldB = xnew(Field, { label: 'B', commit: (text: string) => commitChannel('b', text) });
        if (alpha === true) {
            fieldA = xnew(Field, { label: 'A', commit: commitAlpha });
        }
    });

    function Field(sub: xnew.Unit, { label, commit }: { label: string, commit: (text: string) => void }) {
        xnew.nest({ tag: 'div', className: css.field });
        // disabled too: pointer-events: none on the container still leaves these fields reachable by Tab
        const input = xnew({ tag: 'input', type: 'text', spellcheck: false, disabled, className: css.fieldInput }).current as HTMLInputElement;
        xnew({ tag: 'div', className: css.fieldLabel, textContent: label });
        // keep the fields' own events inside the picker so hosts only see the picker's canonical pair:
        // half-typed text is not a color, so partial input never surfaces as the picker's value
        sub.on('input', ({ event }: { event: Event }) => event.stopPropagation());
        sub.on('change', ({ event, value }: { event: Event, value: string }) => {
            event.stopPropagation();
            commit(String(value));
        });
        return {
            set(text: string) {
                input.value = text;
            },
        };
    }

    function commitHex(text: string) {
        const rgba = parseHex(text);
        if (rgba === null) {
            render();
        } else {
            // 3 / 6-digit hex keeps the current alpha; only 4 / 8-digit text carries its own
            const merged = hasHexAlpha(text) === true ? rgba : { ...rgba, a: hsva.a };
            apply(rgbaToHsva(merged), 'commit');
        }
    }

    function commitChannel(key: 'r' | 'g' | 'b', text: string) {
        const parsed = Number.parseInt(text, 10);
        if (Number.isNaN(parsed) === true) {
            render();
        } else {
            apply(rgbaToHsva({ ...hsvaToRgba(hsva), [key]: clamp(parsed, 0, 255) }), 'commit');
        }
    }

    function commitAlpha(text: string) {
        const parsed = Number.parseFloat(text);
        if (Number.isNaN(parsed) === true) {
            render();
        } else {
            apply({ ...hsva, a: clamp(parsed, 0, 100) / 100 }, 'commit');
        }
    }

    function apply(next: Hsva, kind: 'none' | 'input' | 'change' | 'commit') {
        hsva = {
            h: clamp(next.h, 0, 360),
            s: clamp(next.s, 0, 1),
            v: clamp(next.v, 0, 1),
            a: alpha === true ? clamp(next.a, 0, 1) : 1,
        };
        render();
        if (kind !== 'none') {
            notify(kind);
        }
    }

    function render() {
        const rgba = hsvaToRgba(hsva);
        saturationElement.style.backgroundColor = `hsl(${hsva.h}, 100%, 50%)`;
        circleElement.style.left = `${hsva.s * 100}%`;
        circleElement.style.top = `${(1 - hsva.v) * 100}%`;
        huePointer.style.left = `${hsva.h / 360 * 100}%`;
        if (alphaOverlay !== null && alphaPointer !== null) {
            alphaOverlay.style.background = `linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0), rgb(${rgba.r}, ${rgba.g}, ${rgba.b}))`;
            alphaPointer.style.left = `${hsva.a * 100}%`;
        }
        swatchOverlay.style.background = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${hsva.a})`;
        fieldHex.set(formatHex({ ...rgba, a: 1 }).replace('#', '').toUpperCase());
        fieldR.set(String(rgba.r));
        fieldG.set(String(rgba.g));
        fieldB.set(String(rgba.b));
        if (fieldA !== null) {
            fieldA.set(String(Math.round(hsva.a * 100)));
        }
    }

    render();

    return {
        get value() {
            return formatHex(hsvaToRgba(hsva));
        },
        set value(text: string) {
            const rgba = parseHex(text);
            if (rgba !== null) {
                apply(rgbaToHsva(rgba), 'commit');
            }
        },
    };
}
