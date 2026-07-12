//----------------------------------------------------------------------------------------------------
// Accordion — collapses height + opacity to follow an OpenAndClose progress value
// Presentation layer over OpenAndClose: requires an ancestor (or same-unit extend) OpenAndClose,
// found via xnew.context.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { OpenAndClose } from './OpenAndClose';

export function Accordion(unit: xnew.Unit) {
    const system = xnew.context(OpenAndClose);

    const outer = xnew.nest('<div style="overflow: hidden;">') as HTMLElement;
    const inner = xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box;">') as HTMLElement;

    system.on('-transition', ({ value }: { value: number }) => {
        outer.style.height = value < 1.0 ? inner.offsetHeight * value + 'px' : 'auto';
        outer.style.opacity = value.toString();
    });
}
