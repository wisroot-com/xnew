import { xnew } from '../core/xnew';

export function ResizeEvent() {
    const xnode = xnew.self;

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            xnode.emit('resize');
            break;
        }
    });

    if (xnode.element) {
        observer.observe(xnode.element);
    }
    return {
        finalize() {
            if (xnode.element) {
                observer.unobserve(xnode.element);
            }
        }
    }
}
