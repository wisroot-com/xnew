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

export function isKeyName(value) {
    return isString(value) === true && value.match(/^[A-Za-z0-9_.#]*$/) !== null;
}

export function isEventType(type) {
    const types = type.split(' ').filter((type) => type !== '');
    return types.find((type) => isKeyName(type) === false) === undefined;
}
