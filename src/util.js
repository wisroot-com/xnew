import { isString, isNumber, isObject, isFunction, clamp } from './common';
import { xnew, XNode } from './core';

//----------------------------------------------------------------------------------------------------
// input 
//----------------------------------------------------------------------------------------------------

export const input = (() => {

    const keyState = {};
    window.addEventListener('keydown', (event) => {
        if (event.repeat === true) return;
        keyState[event.code] = { down: XNode.updateCounter, up: null };
    }, true);
    window.addEventListener('keyup', (event) => {
        if (keyState[event.code]) keyState[event.code].up = XNode.updateCounter;
    }, true);
    
    return {
        getKey(code) {
            if (isString(code) === false) return false;

            let ret = false;
            code.split(' ').forEach((c) => {
                if (isString(c) && keyState[c]?.up === null) ret = true;
            })
            return ret;
        },
        getKeyDown(code) {
            if (isString(code) === false) return false;

            let ret = false;
            code.split(' ').forEach((c) => {
                if (isString(c) && keyState[c]?.down === XNode.updateCounter) ret = true;
            })
            return ret;
        },
        getKeyUp(code) {
            if (isString(code) === false) return false;

            let ret = false;
            code.split(' ').forEach((c) => {
                if (isString(c) && keyState[c]?.up === XNode.updateCounter) ret = true;
            })
            return ret;
        },

        // hasTouch() {
        //     return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
        // },
    };
})();


