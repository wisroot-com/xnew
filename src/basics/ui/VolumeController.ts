//----------------------------------------------------------------------------------------------------
// VolumeController — speaker icon that reveals a master-volume slider on click
// Extends xbasics.Volume for the master gain and slides an InputRange out toward `placement`
// (top / bottom use the vertical InputRange); Aspect makes the icon square so cqw / cqh track its size.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Volume } from '../audio/Volume';
import { Aspect } from '../view/Aspect';
import { InputRange } from '../element/InputRange';
import { Gate } from './Gate';
import { xicons } from '../../icons/xicons';

type Placement = 'left' | 'right' | 'top' | 'bottom';

// per-placement geometry: the slider grows along `grow` from the icon edge; the cross axis is pinned
// full-length by its two insets, so only the grow axis carries the initial 0 (setting both collapses it)
const placements: Record<Placement, { vertical: boolean, grow: 'width' | 'height', outer: string }> = {
    left: { vertical: false, grow: 'width', outer: 'top: 0; bottom: 0; right: calc(100% + 4cqw); width: 0;' },
    right: { vertical: false, grow: 'width', outer: 'top: 0; bottom: 0; left: calc(100% + 4cqw); width: 0;' },
    top: { vertical: true, grow: 'height', outer: 'left: 0; right: 0; bottom: calc(100% + 4cqh); height: 0;' },
    bottom: { vertical: true, grow: 'height', outer: 'left: 0; right: 0; top: calc(100% + 4cqh); height: 0;' },
};

// swaps between the on / muted glyph; recreated on change so the icon component picks the right paths
function SpeakerIcon(unit: xnew.Unit, { muted = false }: { muted?: boolean } = {}) {
    xnew.extend(muted ? xicons.SpeakerXMark : xicons.SpeakerWave, { style: 'display: block; width: 100%; height: 100%;' });
}

export function VolumeController(unit: xnew.Unit,
    { placement = 'left', className = '', style = '' }:
    { placement?: Placement, className?: string, style?: string } = {}
) {
    const config = placements[placement] ?? placements.left;

    const css = xnew.css({
        container: {
            layer: 'base',
            body: `position: relative;`,
        },
        button: {
            layer: 'base',
            body: `width: 100%; height: 100%; cursor: pointer;`,
        },
        // slider holder anchored to an icon edge; the growth axis animates from 0, cross axis is centered
        outer: {
            layer: 'base',
            body: `
                position: absolute;
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none;
            `,
        },
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });
    const volume = xnew.extend(Volume);
    xnew.extend(Aspect, { aspect: 1.0, fit: 'contain' });
    unit.on('pointerdown', ({ event }: { event: PointerEvent }) => event.stopPropagation());

    const system = xnew(Gate, { open: false, duration: 250, easing: 'ease' });

    const button = xnew((unit: xnew.Unit) => {
        xnew.nest({ tag: 'div', className: css.button });
        unit.on('click', () => system.toggle());
        let icon = xnew(SpeakerIcon, { muted: volume.volume === 0 });
        return {
            update() {
                icon?.finalize();
                icon = xnew(SpeakerIcon, { muted: volume.volume === 0 });
            },
        };
    });

    xnew(() => {
        const outer = xnew.nest({ tag: 'div', className: css.outer, style: config.outer });

        // AudioParam is float32, so round the read-back to a clean integer for the display
        xnew(InputRange, config.vertical
            ? { value: Math.round(volume.volume * 100), vertical: true, style: 'height: 100%;' }
            : { value: Math.round(volume.volume * 100), style: 'width: 100%;' }
        ).on('input', ({ value }: { value: number }) => {
            volume.volume = value / 100;
            button.update();
        });

        system.on('-transition', ({ value }: { value: number }) => {
            const length = value * 400;
            outer.style[config.grow] = config.vertical ? `${length}cqh` : `${length}cqw`;
            outer.style.opacity = value.toString();
            outer.style.pointerEvents = value < 0.9 ? 'none' : 'auto';
        });
    });

    unit.on('click.outside', () => system.close());
}
