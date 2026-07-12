//----------------------------------------------------------------------------------------------------
// Accordion — collapses height + opacity to follow a Gate progress value
// Presentation layer over Gate: requires an ancestor (or same-unit extend) Gate,
// found via xnew.context.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Accordion(unit: xnew.Unit) {
    const gate = xnew.context(Gate);

    const css = xnew.css({
        // clips the inner content while height animates; height and opacity are progress-driven, so they stay inline
        container: {
            layer: 'base',
            body: `
                overflow: hidden;
            `,
        },
        // measured column whose natural offsetHeight sets the open target
        inner: {
            layer: 'base',
            body: `
                display: flex; flex-direction: column;
                box-sizing: border-box;
            `,
        },
    });

    const container = xnew.nest({ tag: 'div', className: css.container }) as HTMLElement;
    const inner = xnew.nest({ tag: 'div', className: css.inner }) as HTMLElement;

    gate.on('-transition', ({ value }: { value: number }) => {
        container.style.height = value < 1.0 ? inner.offsetHeight * value + 'px' : 'auto';
        container.style.opacity = value.toString();
    });
}
