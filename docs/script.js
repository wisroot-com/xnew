
function _anchor() {
    const i = window.location.href.indexOf('#');
    return i > 0 ? decodeURIComponent(window.location.href.substring(i + 1)) : '';
}

function main() {
    window.addEventListener('hashchange', (event) => {
        update();
    })
    const items = document.querySelectorAll('[name="example-items"]>p');
    for (let i = 0; i < items.length; i++) {
        items[i].addEventListener('click', (event) => {
            setFrame(items[i].getAttribute('name'));
        })
    }
    update();
}

function update() {
    $('.section').hide();
    const name = ['manual', 'examples', 'xutil'].includes(_anchor()) ? _anchor() : 'getstart';
    $(`.section[name=${name}]`).show();
    window.scroll({ top: 0, });
    
    if (name === 'examples') {
        setFrame('element');
    } else if (name === 'getstart') {
        fetch('getstart.md').then((response) => response.text()).then((data) => {
            convert(document.querySelector('.section[name=getstart] .markdown'), data);
        });
    } else if (name === 'manual') {
        fetch('manual.md').then((response) => response.text()).then((data) => {
            convert(document.querySelector('.section[name=manual] .markdown'), data);
        });
    } else if (name === 'xutil') {
        fetch('xutil.md').then((response) => response.text()).then((data) => {
            convert(document.querySelector('.section[name=xutil] .markdown'), data);
        });
    }

    function convert(markdown, data) {
        markdown.innerHTML = marked.parse(data);
        updatePretty(markdown, 'prettyprint lang-javascript')
    }
}

function setFrame(path) {
    $('[name="example-items"]').children().css({ color: '#02A', fontWeight: 'normal' });
    $(`[name="example-items"] [name="${path}"]`).css({ color: '#000', fontWeight: 'bold' });

    $('#iframe').attr('src', 'examples/' + path + '.html');
    $.get('examples/' + path + '.html').done((data) => {
        data = data.replace('../matter.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.18.0/matter.min.js');
        data = data.replace('../three.min.js', 'https://unpkg.com/three@0.142.x/build/three.min.js');
        data = data.replace('../pixi.min.js', 'https://pixijs.download/v7.0.5/pixi.min.js');
        data = data.replace('../xnew.js', 'https://unpkg.com/xnew@1.x/dist/xnew.js');

        $('#code').empty();
        const $pre = $('<pre>');
        $pre.addClass('prettyprint lang-html');
        $pre.text(data);
        $('#code').append($pre);
        PR.prettyPrint();
    })
}

function updatePretty(markdown, className) {
    markdown.querySelectorAll('pre').forEach((element) => {
        element.className = className;
    });
    PR.prettyPrint();
}

function createSynth(element) {
    let incId = 0;
    xnew(element, (xnode) => {
        const div1 = xnew({ style: 'display: flex; width: 100%; flex-wrap: wrap;' });
        const code = xnew({ style: 'border: 1px solid #AAA; border-radius: 4px;' });
        const code1 = xnew(code, { tag: 'pre', style: 'max-width: 1200px; user-select: text; white-space: pre-wrap; padding: 1px; margin: 1px;' });
        const code2 = xnew(code, { tag: 'pre', style: 'max-width: 1200px; user-select: text; white-space: pre-wrap; padding: 1px; margin: 1px;' });
        const div2 = xnew({ style: 'display: flex; margin: 12px 0;' });
        const div3 = xnew({ style: 'display: flex; margin: 12px 0;' });
        const oscillator = xnew(div2, (xnode) => {
            xnode.extend(Block, 'oscillator');

            const data = {};
            const waveform = xnew(Waveform, 2);
            const envelope = xnew(Envelope, { value: 0.0, min: -36.0, max: +36.0, step: 1}, true);
            const lfo = xnew(LFO, { value: 4, min: 0, max: 36, step: 1 });

            return {
                get value() { return { type: waveform.value, ...(envelope.value ? { envelope: envelope.value } : {}), ...(lfo.value ? { LFO: lfo.value } : {}) }; },
                get json() { return `oscillator: { type: '${waveform.value}', ${envelope.json}${lfo.json}}, `; },
            }
        });

        const filter = xnew(div2, (xnode) => {
            xnode.extend(Block, 'filter', true);

            const type = xnew(Radio, { name: 'type', labels: ['lowpass', 'highpass', 'bandpass'] });
            const cutoff = xnew(Slider, { name: 'cutoff', value: 1000, min: 100, max: 4000, step: 10 });
            const envelope = xnew(Envelope, { value: 0, min: -36, max: 36, step: 1 }, true);
            const lfo = xnew(LFO, { value: 4, min: 0, max: 36, step: 1 });

            return {
                get value() { return xnode.checked ? { type: type.value, cutoff: cutoff.value, ...(envelope.value ? { envelope: envelope.value } : {}), ...(lfo.value ? { LFO: lfo.value } : {}) } : null; },
                get json() { return xnode.checked ? `filter: { type: '${type.value}', cutoff: ${cutoff.value}, ${envelope.json}${lfo.json}}, ` : ''; },
            }
        });

        const amp = xnew(div3, (xnode) => {
            xnode.extend(Block, 'amp');

            const envelope = xnew(Envelope, { value: 0.1, min: 0.0, max: 1.0, step: 0.1 });
            const lfo = xnew(LFO, { value: 0.1, min: 0.0, max: 1.0, step: 0.1 });

            return {
                get value() { return { ...(envelope.value ? { envelope: envelope.value } : {}), ...(lfo.value ? { LFO: lfo.value } : {}), }; },
                get json() { return `amp: { ${envelope.json}${lfo.json}}, `; },
            }
        });

        const options = xnew(div3, (xnode) => {
            xnode.extend(Block, 'effect');

            const reverb = xnew((xnode) => {
                xnode.extend(Section, 'reverb', true);

                const time = xnew(Slider, { name: 'time', value: 1000, min: 0.0, max: 2000, step: 100 });
                const mix = xnew(Slider, { name: 'mix', value: 0.5, min: 0.0, max: 1.0, step: 0.1 });
                return {
                    get value() { return xnode.checked ? { time: time.value, mix: mix.value } : null; },
                    get json() { return xnode.checked ? `reverb: { time: ${time.value}, mix: ${mix.value}, }, ` : ''; }
                };
            });

            const delay = xnew((xnode) => {
                xnode.extend(Section, 'delay', true);

                const time = xnew(Slider, { name: 'time', value: 500, min: 0, max: 2000, step: 100 });
                const feedback = xnew(Slider, { name: 'feedback', value: 0.5, min: 0.0, max: 0.9, step: 0.1 });
                const mix = xnew(Slider, { name: 'mix', value: 0.5, min: 0.0, max: 1.0, step: 0.1 });

                return {
                    get value() { return xnode.checked ? { time: time.value, feedback: feedback.value, mix: mix.value } : null; },
                    get json() { return xnode.checked ? `delay: { time: ${time.value}, feedback: ${feedback.value}, mix: ${mix.value}, }, ` : ''; }
                };
            });
            return {
                get value() { return { ...(reverb.value ? { reverb: reverb.value } : {}), ...(delay.value ? { delay: delay.value } : {}), }; },
                get json() { return (reverb.value || delay.value) ? `, { ${reverb.json}${delay.json}}` : ''; },
            }
        });

        for (let i = 2; i < 7; i++) {
            xnew(div1, Keyset, i);
        }
        
        function Keyset(xnode, number) {
            xnode.nestElement({});
            xnode.nestElement({ style: 'display: flex; position: relative;' });

            for (let i = 0; i < 12; i++) {
                xnew(Key, i, number);
            }

            function Key(xnode, key, number) {
                const list = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', ];
                const offset = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
                const w = 24, h = 128;

                xnode.nestElement({
                    style: 'word-break: normal; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column-reverse; font-size: 0.7em; align-items: center; ' + 
                    (list[key].indexOf('#') > 0 ? 
                    `width: ${w * 5 / 7}px; height: ${h * 9 / 16}px; color: #FFFFFF; background: #000000; position: absolute; left: ${offset[list[key][0]] * w + w * 6 / 10}px;` :
                    `width: ${w}px; height: ${h}px; border: 1px solid #000000;`)
                });
                xnode.element.textContent = list[key] + number;

                let press = null;
                let startTime = 0;
                xnode.on('touchstart mousedown mouseover', (event) => {
                    if (event.buttons === 1 || event.type === 'touchstart') {
                        startTime = Date.now();
                        const param = { oscillator: oscillator.value, ...(filter.value ? { filter: filter.value } : {}), amp: amp.value, };
                        code1.element.textContent = ` `
                        code2.element.textContent = `const synth = xutil.audio.create({ ${oscillator.json}${filter.json}${amp.json}}${options.json});\nsynth.press('${list[key] + number}', duration); `;
                        const synth = xutil.audio.create(param, options.value);
                        press = synth.press(list[key] + number);
                    }
                });
                xnode.on('touchend mouseup mouseout ', () => {
                    if (press) {
                        code1.element.textContent = `const duration = ${Date.now() - startTime};`
                        press.release();
                    }
                    press = null;
                });
            }
        }
    });

    function Waveform(xnode, value = 0) {
        xnode.extend(Param, 'type');
        const labels = ['sine', 'triangle', 'square', 'sawtooth'];
        const id = incId++;
        labels.forEach((label, i) => {
            xnew({ tag: 'label', style: 'display: inline-block; ' }, (xnode) => {
                xnode.nestElement({ style: 'display: flex; flex-direction: column; align-items: center;'})
                const input = xnew({ tag: 'input', name: id, type: 'radio', value: i, style: 'display: block;' });
                const svg = xnew({ tag: 'svg', style: `display: block; width: 30px; height: 20px; margin: 8px; stroke-linejoin: round;`, viewBox: '0 0 20 20' });
                if (label === 'sine') {
                    svg.element.innerHTML = `<polyline stroke="#000" fill="none" stroke-width="2" points="0 10 2 3 5 0 8 3 10 10 12 17 15 20 18 17 20 10" />`;
                } else if(label === 'triangle') {
                    svg.element.innerHTML = `<polyline stroke="#000" fill="none" stroke-width="2" points="0 10 5 0 10 10 15 20 20 10" />`;
                } else if(label === 'square') {
                    svg.element.innerHTML = `<polyline stroke="#000" fill="none" stroke-width="2" points="0 10 0 0 10 0 10 20 20 20 20 10" />`;
                } else if(label === 'sawtooth') {
                    svg.element.innerHTML = `<polyline stroke="#000" fill="none" stroke-width="2" points="0 20 0 0 20 20" />`;
                }
                input.on('change', () => {
                    if (input.element.checked) value = i;
                });
                if (i === value) {
                    input.element.checked = true;
                }
            });
        });
        return {
            get value() { return labels[value]; },
        }
    }
    function Envelope(xnode, { value, min, max, step }, checkable = false) {
        xnode.extend(Section, 'envelope', checkable);

        const svg = xnew({ tag: 'svg', style: `width: 300px; height: 150px; margin: 8px; background: #000; stroke-linejoin: round;`, viewBox: '0 0 300 150' });
        const amount = xnew(Slider, { name: 'amount', value, min, max, step });
        const attack = xnew(Slider, { name: 'attack', value: 200, min: 0, max: 500, step: 20 });
        const decay = xnew(Slider, { name: 'decay', value: 200, min: 0, max: 500, step: 20 });
        const sustain = xnew(Slider, { name: 'sustain', value: 0.2, min: 0.0, max: 1.0, step: 0.1 });
        const release = xnew(Slider, { name: 'release', value: 200, min: 0, max: 500, step: 20 });

        render();
        attack.input.on('change input', () => { render(); });
        decay.input.on('change input', () => { render(); });
        sustain.input.on('change input', () => { render(); });
        release.input.on('change input', () => { render(); });

        function render() {
            const [A, D, S, R] = [attack.value, decay.value, sustain.value, release.value];
            svg.element.innerHTML = `
                <polyline stroke="#2B2" stroke-width="2" points="0 150 ${0.1 * A} ${10} ${0.1 * (A + D)} ${150 - 140 * S} ${0.1 * (A + D + 500)} ${150 - 140 * S} ${0.1 * (A + D + 500 + R)} 150" />
            `;
        }
        return {
            get value() { return xnode.checked ? { amount: amount.value, ADSR: [attack.value, decay.value, sustain.value, release.value] } : null; },
            get json() { return xnode.checked ? `envelope: { amount: ${amount.value}, ADSR: [${attack.value}, ${decay.value}, ${sustain.value}, ${release.value}], }, ` : ''; }
        };
    }

    function LFO(xnode, { value, min, max, step }) {
        xnode.extend(Section, 'LFO', true);

        const waveform = xnew(Waveform, 2);
        const amount = xnew(Slider, { name: 'amount', value, min, max, step });
        const rate = xnew(Slider, { name: 'rate', value: 8, min: 2, max: 36, step: 1 });

        return {
            get value() { return xnode.checked ? { type: waveform.value, amount: amount.value, rate: rate.value } : null; },
            get json() { return xnode.checked ? `LFO: { type: '${waveform.value}', amount: ${amount.value}, rate: ${rate.value}, }, ` : ''; }
        };
    }

    function Slider(xnode, { name, value, max, min, step }) {
        xnode.extend(Param, name);
        const input = xnew({ tag: 'input', type: 'range',  style: 'width: 160px;', min: `${min}`, max: `${max}`, step: `${step}`, value });
        const span = xnew({ tag: 'span' }, `${value}`);
        input.on('change input', () => span.element.textContent = input.element.value);
        return {
            get value() { return Number(input.element.value); },
            get input() { return input; },
        }
    }

    function Radio(xnode, { name, labels, value = 0 }) {
        xnode.extend(Param, name);
        const id = incId++;
        labels.forEach((label, i) => {
            xnew({ tag: 'label', style: 'display: inline-block;' }, () => {
                const input = xnew({ tag: 'input', name: id, type: 'radio', value: i });
                xnew({ tag: 'span' }, label);
                input.on('change', () => {
                    if (input.element.checked) value = i;
                });
                if (i === value) {
                    input.element.checked = true;
                }
            });
        });
        return {
            get value() { return labels[value]; },
        }
    }

    function Block(xnode, name, checkable = false) {
        xnode.nestElement({ tag: 'div', style: 'width: 320px; margin: 2px; border: 1px solid #000000; border-radius: 4px;' });
        xnode.extend(Check, 'font-size: 1.5em;', name, checkable);
    }

    function Section(xnode, name, checkable = false) {
        xnode.extend(Check, 'font-size: 1.2em;', name, checkable);
    }

    function Check(xnode, style, name, checkable = false) {
        const header = xnew({});
        xnew(header, { tag: 'span', style }, name);

        xnode.nestElement({ style: checkable ? 'display: none;' : ''});
        let check = null;

        if (checkable) {
            check = xnew(header, { tag: 'input', type: 'checkbox', checked: false });
            check.on('change', () => {
                xnode.element.style.display = check.element.checked ? 'block' : 'none';
            })
        }
        return {
            get checked() { return check ? check.element.checked : true; },
        }
    }

    function Param(xnode, name) {
        xnode.nestElement({ style: 'margin: 4px; display: flex' });
        xnew({ style: 'width: 100px' }, `${name}`);

        xnode.nestElement({ style: 'flex: 1 1 auto;' });
    }
}


function createTop(element) {
    xnew(element, (xnode) => {
        // create a screen (xcomponents.Screen is a component function that defines a canvas)
        const screen = xnew(xcomponents.Screen, { width: 1200, height: 400 });

        // setting for three.js
        const three = {};
        three.renderer = new THREE.WebGLRenderer({ canvas: screen.canvas, alpha: true, });
        three.renderer.setClearColor(0x000000, 0);
        
        three.camera = new THREE.PerspectiveCamera(45, screen.width / screen.height);
        three.camera.position.set(0, 0, +100);

        three.scene = new THREE.Scene();
        xnode.extend(ThreeObject, three.scene);

        xnew(Light);
        xnew(Content);

        return {
            update() {
                three.renderer.render(three.scene, three.camera);
            },
        };
    });

    function Light(xnode) {
        const light = new THREE.PointLight(0xFFFFFF, 1);
        xnode.extend(ThreeObject, light);

        light.position.set(0, 0, +100);
    }

    function Content(xnode) {
        // call iteratively (100ms)
        xtimer(() => {
            xnew(Cube, 100 * (Math.random() - 0.5), 100 * (Math.random() - 0.5), 100 * (Math.random() - 0.5), 0xFFFFFF * Math.random());
            return true; // loop
        }, 100);
    }

    // create a cube and update
    function Cube(xnode, x, y, z, color) {
        // create a cube object
        const size = 10 * Math.random() + 5;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshLambertMaterial({ color });
        const object = new THREE.Mesh(geometry, material);
        xnode.extend(ThreeObject, object);

        object.position.x = x;
        object.position.y = y;
        object.position.z = z;

        const velocity = {};
        velocity.x = Math.random() - 0.5;
        velocity.y = Math.random() - 0.5;
        velocity.z = Math.random() - 0.5;

        // finalize after 5000ms
        xtimer(() => xnode.finalize(), 5 * 1000);

        return {
            update() {
                // move cube
                object.position.x += velocity.x;
                object.position.y += velocity.y;
                object.position.z += velocity.z;
                object.rotation.y += 0.01;
                object.rotation.x += 0.01;
            },
        };
    }

    //----------------------------------------------------------------------
    // base component
    //----------------------------------------------------------------------
    
    function ThreeObject(xnode, object) {
        const parent = xnode.context('THREE.Object3D');
        xnode.context('THREE.Object3D', object);

        // if the parent object exists
        if (parent) {
            parent.add(object);

            return {
                finalize() {
                    parent.remove(object);
                },
            }
        }
    }
}