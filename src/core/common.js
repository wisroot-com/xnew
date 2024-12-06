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
    console.error(name + (target !== undefined ? ` [${target}]` : '') + ': ' + text);
}