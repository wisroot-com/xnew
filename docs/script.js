
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
        console.log(markdown, data);
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