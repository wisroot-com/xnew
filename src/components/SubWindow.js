import { xnew, xnest } from '../core/xnew';

export function SubWindow(xnode) {
    xnest({ style: 'position: absolute;' });
    xnest({ style: 'position: relative;' });

    return {
        locate() {
            console.log(xnode.element.parentElement.clientWidth);
            console.log(xnode.element.parentElement.clientHeight);
        }
    }
}
