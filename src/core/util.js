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

export function createElement(attributes)
{
    const { tagName, ...others } = attributes;
    const element = tagName?.toLowerCase() === 'svg' ? 
        document.createElementNS('http://www.w3.org/2000/svg', tagName) : 
        document.createElement(tagName ?? 'div');
    
    const bools = ['checked', 'disabled', 'readOnly',];

    Object.keys(others).forEach((key) => {
        const value = others[key];
        if (key === 'style') {
            if (isString(value) === true) {
                element.style = value;
            } else if (isObject(value) === true){
                Object.assign(element.style, value);
            }
        } else if (key === 'className') {
            if (isString(value) === true) {
                element.classList.add(...value.trim().split(/\s+/));
            }
        } else if (key === 'class') {
        } else if (bools.includes(key) === true) {
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    return element;
}

//----------------------------------------------------------------------------------------------------
// timer
//----------------------------------------------------------------------------------------------------

export class Timer {
    constructor(callback, delay, loop) {
        this.callback = callback;
        this.delay = delay;
        this.loop = loop;

        this.id = null;
        this.time = null;
        this.offset = 0.0;
    }

    clear() {
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

    static stop() {
        if (this.id !== null) {
            this.offset = Date.now() - this.time + this.offset;
            clearTimeout(this.id);

            this.id = null;
            this.time = null;
        }
    }
}


//----------------------------------------------------------------------------------------------------
// error 
//----------------------------------------------------------------------------------------------------

export function error(name, text, target = undefined) {
    console.error(name + (target !== undefined ? ` [${target}]` : '') + ': ' + text);
}