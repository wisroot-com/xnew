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
// error 
//----------------------------------------------------------------------------------------------------

export function error(name, text, target = undefined) {
    console.error(`${name}${target !== undefined ? `[${target}]` : ''}: ` + text);
}

//----------------------------------------------------------------------------------------------------
// element 
//----------------------------------------------------------------------------------------------------

export function createElement(attributes) {

    const { tag, ...others } = attributes;
    const element = tag === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag ?? 'div');
    
    const inputs = [
        'checked',
        'disabled',
        'readOnly',
    ];

    Object.keys(others).forEach((key) => {
        const value = others[key];
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
        } else if (inputs.includes(key)) {
            element[inputs[key]] = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    return element;
}
