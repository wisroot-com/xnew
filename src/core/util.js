//----------------------------------------------------------------------------------------------------
// error 
//----------------------------------------------------------------------------------------------------

export function error(name, text, target = undefined)
{
    console.error(name + (target !== undefined ? ` [${target}]` : '') + ': ' + text);
}

//----------------------------------------------------------------------------------------------------
// type check
//----------------------------------------------------------------------------------------------------

export function isString(value)
{
    return typeof value === 'string';
}

export function isFunction(value)
{
    return typeof value === 'function';
}

export function isNumber(value)
{
    return Number.isFinite(value);
}

export function isObject(value)
{
    return value !== null && typeof value === 'object' && value.constructor === Object;
}

//----------------------------------------------------------------------------------------------------
// create element from attributes
//----------------------------------------------------------------------------------------------------

export function createElement(attributes, parentElement = null)
{
    const tagName = (attributes.tagName ?? 'div').toLowerCase();
    let element = null;

    let nsmode = false;
    if (tagName === 'svg') {
        nsmode = true;
    } else {
        while (parentElement) {
            if (parentElement.tagName.toLowerCase() === 'svg') {
                nsmode = true;
                break;
            }
            parentElement = parentElement.parentElement;
        }
    }

    if (nsmode === true) {
        element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    } else {
        element = document.createElement(tagName);
    }
    
    Object.keys(attributes).forEach((key) => {
        const value = attributes[key];
        if (key === 'tagName') {
        } else if (key === 'class' || key === 'className') {
            if (isString(value) === true) {
                element.classList.add(...value.trim().split(/\s+/));
            }
        } else if (key === 'style') {
            if (isString(value) === true) {
                element.style = value;
            } else if (isObject(value) === true){
                Object.assign(element.style, value);
            }
        } else {
            const snake = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            if (element[key] === true || element[key] === false) {
                element[key] = value;
            } else {
                setAttribute(element, key, value);
            }
            
            function setAttribute(element, key, value) {
                if (nsmode === true) {
                    element.setAttributeNS(null, key, value);
                } else {
                    element.setAttribute(key, value);
                }
            }
        }
    });

    return element;
}

//----------------------------------------------------------------------------------------------------
// map set / map map
//----------------------------------------------------------------------------------------------------

export class MapSet extends Map
{
    has(key, value)
    {
        if (value === undefined) {
            return super.has(key);
        } else {
            return super.has(key) && super.get(key).has(value);
        }
    }

    add(key, value)
    {
        if (this.has(key) === false) {
            this.set(key, new Set());
        }
        this.get(key).add(value);
    }

    delete(key, value)
    {
        if (this.has(key, value) === false) {
            return;
        }
        this.get(key).delete(value);
        if (this.get(key).size === 0) {
            super.delete(key);
        }
    }
}

export class MapMap extends Map
{
    has(key, subkey)
    {
        if (subkey === undefined) {
            return super.has(key);
        } else {
            return super.has(key) && super.get(key).has(subkey);
        }
    }

    set(key, subkey, value)
    {
        if (super.has(key) === false) {
            super.set(key, new Map());
        }
        super.get(key).set(subkey, value);
    }

    get(key, subkey)
    {
        if (subkey === undefined) {
            return super.get(key);
        } else {
            return super.get(key)?.get(subkey);
        }
    }

    delete(key, subkey)
    {
        if (this.has(key) === false) {
            return;
        }
        this.get(key).delete(subkey);
        if (this.get(key).size === 0) {
            super.delete(key);
        }
    }
}

//----------------------------------------------------------------------------------------------------
// timer
//----------------------------------------------------------------------------------------------------

export class Timer
{
    constructor(callback, delay, loop)
    {
        this.callback = callback;
        this.delay = delay;
        this.loop = loop;

        this.id = null;
        this.time = null;
        this.offset = 0.0;
    }

    clear()
    {
        if (this.id === null) {
            clearTimeout(this.id);
            this.id = null;
        }
    }

    static start()
    {
        if (this.id === null) {
            this.id = setTimeout(() => {
                this.callback();

                this.id = null;
                this.time = null;
                this.offset = 0.0;
    
                if (this.loop) {
                    Timer.start.call(this)
                }
            }, this.delay - this.offset);
            this.time = Date.now();
        }
    }

    static stop()
    {
        if (this.id !== null) {
            this.offset = Date.now() - this.time + this.offset;
            clearTimeout(this.id);

            this.id = null;
            this.time = null;
        }
    }
}
