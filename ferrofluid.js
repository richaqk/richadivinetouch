/**
 * Ferrofluid WebGL Effect — zero dependencies, pure vanilla JS + WebGL
 */
(function () {
    'use strict';

    const MAX_COLORS = 8;

    function hexToRGB(hex) {
        const c = hex.replace('#', '').padEnd(6, '0');
        return [
            parseInt(c.slice(0, 2), 16) / 255,
            parseInt(c.slice(2, 4), 16) / 255,
            parseInt(c.slice(4, 6), 16) / 255
        ];
    }

    function prepColors(input) {
        const base = (input && input.length ? input : ['#4F46E5', '#06B6D4', '#E0F2FE']).slice(0, MAX_COLORS);
        const count = base.length;
        const arr = [];
        for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
        const avg = [0, 0, 0];
        for (let i = 0; i < count; i++) {
            avg[0] += arr[i][0];
            avg[1] += arr[i][1];
            avg[2] += arr[i][2];
        }
        avg[0] /= count; avg[1] /= count; avg[2] /= count;
        return { arr: arr, count: count, avg: avg };
    }

    function flowVec(d) {
        switch (d) {
            case 'up': return [0, 1];
            case 'down': return [0, -1];
            case 'left': return [-1, 0];
            case 'right': return [1, 0];
            default: return [0, -1];
        }
    }

    var vertexSrc = [
        'attribute vec2 position;',
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = position * 0.5 + 0.5;',
        '    gl_Position = vec4(position, 0.0, 1.0);',
        '}'
    ].join('\n');

    var fragmentSrc = [
        'precision highp float;',
        '',
        'uniform vec3  iResolution;',
        'uniform vec2  iMouse;',
        'uniform float iTime;',
        '',
        'uniform vec3  uColor0;',
        'uniform vec3  uColor1;',
        'uniform vec3  uColor2;',
        'uniform vec3  uColor3;',
        'uniform vec3  uColor4;',
        'uniform vec3  uColor5;',
        'uniform vec3  uColor6;',
        'uniform vec3  uColor7;',
        'uniform int   uColorCount;',
        '',
        'uniform vec2  uFlow;',
        'uniform float uSpeed;',
        'uniform float uScale;',
        'uniform float uTurbulence;',
        'uniform float uFluidity;',
        'uniform float uRimWidth;',
        'uniform float uSharpness;',
        'uniform float uShimmer;',
        'uniform float uGlow;',
        'uniform float uOpacity;',
        'uniform float uMouseEnabled;',
        'uniform float uMouseStrength;',
        'uniform float uMouseRadius;',
        '',
        'varying vec2 vUv;',
        '',
        '#define PI 3.14159265',
        '',
        'vec3 palette(float h) {',
        '    int count = uColorCount;',
        '    if (count < 1) count = 1;',
        '    int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));',
        '    if (idx <= 0) return uColor0;',
        '    if (idx == 1) return uColor1;',
        '    if (idx == 2) return uColor2;',
        '    if (idx == 3) return uColor3;',
        '    if (idx == 4) return uColor4;',
        '    if (idx == 5) return uColor5;',
        '    if (idx == 6) return uColor6;',
        '    return uColor7;',
        '}',
        '',
        'float hash(vec3 p3) {',
        '    p3 = fract(p3 * 0.1031);',
        '    p3 += dot(p3, p3.zyx + 33.33);',
        '    return fract((p3.x + p3.y) * p3.z);',
        '}',
        '',
        'float smin(float a, float b, float k) {',
        '    float r = exp2(-a / k) + exp2(-b / k);',
        '    return -k * log2(r);',
        '}',
        '',
        'float sinlerp(float a, float b, float w) {',
        '    return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);',
        '}',
        '',
        'float vn(vec2 p, float s, float seed) {',
        '    vec2 cellp = floor(p / s);',
        '    vec2 relp = mod(p, s);',
        '    float g1 = hash(vec3(cellp, seed));',
        '    float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));',
        '    float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));',
        '    float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));',
        '    float bx = sinlerp(g1, g2, relp.x / s);',
        '    float tx = sinlerp(g4, g3, relp.x / s);',
        '    return sinlerp(bx, tx, relp.y / s);',
        '}',
        '',
        'float dbn(vec2 p, float s, float seed) {',
        '    float o = s / 2.0;',
        '    float n0 = vn(p, s, seed);',
        '    float n1 = vn(p + vec2(o, o), s, seed + 0.1);',
        '    float n2 = vn(p + vec2(-o, o), s, seed + 0.2);',
        '    float n3 = vn(p + vec2(o, -o), s, seed + 0.3);',
        '    float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);',
        '    return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;',
        '}',
        '',
        'void main() {',
        '    vec2 fragCoord = vUv * iResolution.xy;',
        '    float ref = 700.0 / max(uScale, 0.05);',
        '    vec2 p = fragCoord / iResolution.y * ref;',
        '    float spd = 200.0 * uSpeed;',
        '    float t = iTime;',
        '    vec2 dir = uFlow;',
        '    vec2 perp = vec2(-dir.y, dir.x);',
        '    float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;',
        '    float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;',
        '    float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);',
        '    float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);',
        '    float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));',
        '    float mGlow = 0.0;',
        '    if (uMouseEnabled > 0.5) {',
        '        vec2 mp = iMouse / iResolution.y * ref;',
        '        float md = length(p - mp) / ref;',
        '        float rr = max(uMouseRadius, 0.02);',
        '        mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;',
        '    }',
        '    float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;',
        '    float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);',
        '    ltn = pow(ltn, uSharpness) * uGlow;',
        '    ltn *= clamp(1.0 - mGlow, 0.0, 1.0);',
        '    float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);',
        '    vec3 col = palette(h);',
        '    vec3 outc = col * ltn;',
        '    float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);',
        '    gl_FragColor = vec4(outc, a * uOpacity);',
        '}'
    ].join('\n');

    function compileShader(gl, type, src) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Ferrofluid shader error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl, vSrc, fSrc) {
        var vs = compileShader(gl, gl.VERTEX_SHADER, vSrc);
        var fs = compileShader(gl, gl.FRAGMENT_SHADER, fSrc);
        if (!vs || !fs) return null;
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('Ferrofluid program link error:', gl.getProgramInfoLog(prog));
            return null;
        }
        return prog;
    }

    window.initFerrofluid = function (container, options) {
        options = options || {};
        var colors = options.colors || ["#dac1af", "#ffffff", "#ffffff"];
        var speed = options.speed != null ? options.speed : 0.5;
        var scale = options.scale != null ? options.scale : 1;
        var turbulence = options.turbulence != null ? options.turbulence : 1;
        var fluidity = options.fluidity != null ? options.fluidity : 0.1;
        var rimWidth = options.rimWidth != null ? options.rimWidth : 0.2;
        var sharpness = options.sharpness != null ? options.sharpness : 3;
        var shimmer = options.shimmer != null ? options.shimmer : 1;
        var glow = options.glow != null ? options.glow : 2;
        var flowDirection = options.flowDirection || "down";
        var opacity = options.opacity != null ? options.opacity : 1;
        var mouseInteraction = options.mouseInteraction != null ? options.mouseInteraction : true;
        var mouseStrength = options.mouseStrength != null ? options.mouseStrength : 1;
        var mouseRadius = options.mouseRadius != null ? options.mouseRadius : 0.3;
        var mouseDampening = options.mouseDampening != null ? options.mouseDampening : 0.15;

        var canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        container.appendChild(canvas);

        var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
        if (!gl) {
            console.error('Ferrofluid: WebGL not supported');
            return function () { };
        }

        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        var program = createProgram(gl, vertexSrc, fragmentSrc);
        if (!program) return function () { };

        // Full-screen triangle
        var posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        var posLoc = gl.getAttribLocation(program, 'position');

        // Get uniform locations
        var uLocs = {};
        var uNames = [
            'iResolution', 'iMouse', 'iTime',
            'uColor0', 'uColor1', 'uColor2', 'uColor3',
            'uColor4', 'uColor5', 'uColor6', 'uColor7',
            'uColorCount', 'uFlow', 'uSpeed', 'uScale',
            'uTurbulence', 'uFluidity', 'uRimWidth', 'uSharpness',
            'uShimmer', 'uGlow', 'uOpacity',
            'uMouseEnabled', 'uMouseStrength', 'uMouseRadius'
        ];
        for (var i = 0; i < uNames.length; i++) {
            uLocs[uNames[i]] = gl.getUniformLocation(program, uNames[i]);
        }

        var colorData = prepColors(colors);
        var flow = flowVec(flowDirection);
        var dpr = window.devicePixelRatio || 1;
        var w = 1, h = 1;

        function resize() {
            var rect = container.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        resize();

        var ro = null;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(resize);
            ro.observe(container);
        } else {
            window.addEventListener('resize', resize);
        }

        var mouseTarget = [0, 0];
        var mouseCurrent = [0, 0];

        function onPointerMove(e) {
            var rect = canvas.getBoundingClientRect();
            var x = (e.clientX - rect.left) * dpr;
            var y = (rect.height - (e.clientY - rect.top)) * dpr;
            mouseTarget = [x, y];
            if (mouseDampening <= 0) {
                mouseCurrent = [x, y];
            }
        }
        if (mouseInteraction) {
            canvas.addEventListener('pointermove', onPointerMove);
        }

        var lastTime = 0;
        var rafId = null;

        function loop(t) {
            rafId = requestAnimationFrame(loop);
            var time = t * 0.001;

            // Mouse smoothing
            if (mouseDampening > 0) {
                if (!lastTime) lastTime = t;
                var dt = (t - lastTime) / 1000;
                lastTime = t;
                var tau = Math.max(1e-4, mouseDampening);
                var factor = 1 - Math.exp(-dt / tau);
                if (factor > 1) factor = 1;
                mouseCurrent[0] += (mouseTarget[0] - mouseCurrent[0]) * factor;
                mouseCurrent[1] += (mouseTarget[1] - mouseCurrent[1]) * factor;
            } else {
                lastTime = t;
            }

            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.uniform3f(uLocs.iResolution, canvas.width, canvas.height, 1);
            gl.uniform2f(uLocs.iMouse, mouseCurrent[0], mouseCurrent[1]);
            gl.uniform1f(uLocs.iTime, time);

            for (var ci = 0; ci < MAX_COLORS; ci++) {
                var loc = uLocs['uColor' + ci];
                if (loc) gl.uniform3fv(loc, colorData.arr[ci]);
            }
            gl.uniform1i(uLocs.uColorCount, colorData.count);

            gl.uniform2fv(uLocs.uFlow, flow);
            gl.uniform1f(uLocs.uSpeed, speed);
            gl.uniform1f(uLocs.uScale, scale);
            gl.uniform1f(uLocs.uTurbulence, turbulence);
            gl.uniform1f(uLocs.uFluidity, fluidity);
            gl.uniform1f(uLocs.uRimWidth, rimWidth);
            gl.uniform1f(uLocs.uSharpness, sharpness);
            gl.uniform1f(uLocs.uShimmer, shimmer);
            gl.uniform1f(uLocs.uGlow, glow);
            gl.uniform1f(uLocs.uOpacity, opacity);
            gl.uniform1f(uLocs.uMouseEnabled, mouseInteraction ? 1 : 0);
            gl.uniform1f(uLocs.uMouseStrength, mouseStrength);
            gl.uniform1f(uLocs.uMouseRadius, mouseRadius);

            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        rafId = requestAnimationFrame(loop);

        // Return cleanup function
        return function () {
            if (rafId) cancelAnimationFrame(rafId);
            if (mouseInteraction) canvas.removeEventListener('pointermove', onPointerMove);
            if (ro) ro.disconnect();
            if (canvas.parentElement === container) container.removeChild(canvas);
        };
    };
})();
