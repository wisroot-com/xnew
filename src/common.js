//----------------------------------------------------------------------------------------------------
// errors
//----------------------------------------------------------------------------------------------------

export const ERRORS = {
    ARGUMENT: 'The arguments are invalid.',
    BASIC_STRING: 'The arguments are invalid because it contains characters can not be used. Only [A-Z, a-z, 0-9, _, .] are available.', 
}

//----------------------------------------------------------------------------------------------------
// type check
//----------------------------------------------------------------------------------------------------

export function isString(value) {
    return typeof value === 'string';
}

export function isFunction(value) {
    return typeof value === 'function';
}

export function isNumber(value) {
    return Number.isFinite(value);
}

export function isObject(value) {
    return value !== null && typeof value === 'object' && value.constructor === Object;
}

//----------------------------------------------------------------------------------------------------
// create element
//----------------------------------------------------------------------------------------------------

export function createElement(attributes) {

    const element = (() => {
        if (attributes.tag == 'svg') {
            return document.createElementNS('http://www.w3.org/2000/svg', attributes.tag);
        } else {
            return document.createElement(attributes.tag ?? 'div');
        }
    })();

    Object.keys(attributes).forEach((key) => {
        const value = attributes[key];
        if (key === 'style') {
            if (isString(value) === true) {
                element.style = value;
            } else if (isObject(value) === true){
                Object.assign(element.style, value);
            }
        } else if (key === 'class') {
            if (isString(value) === true) {
                element.classList.add(...value.split(' '));
            }
        } else if (['checked', 'disabled', 'readonly'].includes(key)) {
            const remap = { checked: 'checked', disabled: 'disabled', readonly: 'readOnly', };
            element[remap[key]] = value;
        } else if (key !== 'tag') {
            element.setAttribute(key, value);
        }
    });
    return element;
}