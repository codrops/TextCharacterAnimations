// 19 Caustics. The letters arrive as caustic light, the bright shifting
// network a moving water surface throws onto the bottom of a pool, one after
// another in reading order, the lines overlapping. Each letter's light comes
// only through its own shape, refracted by the rippling surface into soft,
// wandering bands and bright filaments. Then the water calms, the ripples
// slow and flatten, and the light gathers into the crisp letter. Drawn in
// WebGL over the DOM text (see glText.js).

import {GLText} from './glText.js';

const settings = {
    // seconds the water over a letter takes to calm
    duration: 1.2,
    // seconds between two letters starting, and between the starts of two lines
    letter: 0.035,
    line: 0.3,
    // em the letters' starts are blended over, so the water calms smoothly across the text
    smoothStart: 0.35,
    // how far the canvas reaches past the text, in em, room for the light that lands off the letters
    pad: '1.2em',
    // the water: plane waves at these angles (radians) and lengths (em), with these phases
    waves: [
        {angle: 0.35, length: 1.3, phase: 0},
        {angle: 1.25, length: 1, phase: 2.1},
        {angle: 2.05, length: 0.85, phase: 4.4},
        {angle: 2.9, length: 0.72, phase: 1.3},
        {angle: 3.95, length: 0.62, phase: 5.6},
        {angle: 5.1, length: 0.55, phase: 3.7},
    ],
    // how fast the waves run: longer waves run slower, as on real water
    flow: 1.4,
};

const glsl = values => values.map(value => value.toFixed(4)).join(', ');
const {waves} = settings;

const fragment = `
// The water: plane waves, each with its direction, its wavenumber per em,
// its speed (radians per second) and its phase
const int WAVES = ${waves.length};
const vec2 DIRECTION[WAVES] = vec2[WAVES](${waves.map(({angle}) => `vec2(${glsl([Math.cos(angle), Math.sin(angle)])})`).join(', ')});
const float NUMBER[WAVES] = float[WAVES](${glsl(waves.map(({length}) => (2 * Math.PI) / length))});
const float SPEED[WAVES] = float[WAVES](${glsl(waves.map(({length}) => settings.flow * Math.sqrt((2 * Math.PI) / length)))});
const float OFFSET[WAVES] = float[WAVES](${glsl(waves.map(({phase}) => phase))});
// em the light is thrown, at most, while the water is rough
const float STRENGTH = 0.28;
// The water's speed once calm, as a share of its speed while rough
const float SLOW = 0.3;
// How sharp the bright filaments get: the lower, the brighter and finer
const float SOFTEN = 0.45;
// The brightest the light gets
const float PEAK = 1.15;
// s a letter's light takes to come in
const float APPEAR = 0.15;

// The surface's slope at q, at the water's time tau
vec2 slope(vec2 q, float tau) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < WAVES; i++) {
        float phase = NUMBER[i] / uFontSize * dot(DIRECTION[i], q) - SPEED[i] * tau + OFFSET[i];
        g += DIRECTION[i] * cos(phase);
    }
    return g / sqrt(float(WAVES));
}

// How the surface curves at q: its second derivatives xx, yy and xy, per px
vec3 bend(vec2 q, float tau) {
    vec3 c = vec3(0.0);
    for (int i = 0; i < WAVES; i++) {
        float n = NUMBER[i] / uFontSize;
        float phase = n * dot(DIRECTION[i], q) - SPEED[i] * tau + OFFSET[i];
        vec2 d = DIRECTION[i];
        c -= n * sin(phase) * vec3(d.x * d.x, d.y * d.y, d.x * d.y);
    }
    return c / sqrt(float(WAVES));
}

// The water's own clock where the letters around started at s, t s ago:
// full speed until then, slowing to SLOW over uDuration
float flowTime(float s, float t) {
    float during = clamp(t, 0.0, uDuration);
    return s + min(t, 0.0) + during - (1.0 - SLOW) * during * during / (2.0 * uDuration) + SLOW * max(t - uDuration, 0.0);
}

void main() {
    vec4 here = texel();
    if ( !hasLetter(here) ) {
        fragColor = vec4(0.0);
        return;
    }

    // This patch of water calms as the letters around it come in: rough at
    // first, flattening out, easing into stillness
    float around = nearbyStart(here);
    float t = uTime - around;
    float u = clamp(t / uDuration, 0.0, 1.0);
    float rough = (1.0 - u * u) * (1.0 - u * u);
    float k = STRENGTH * uFontSize * rough;
    float tau = flowTime(around, t);

    // Where the light landing here came through the surface: the point q
    // the surface throws onto this pixel, p = q + k * slope(q)
    vec2 p = pixel();
    vec2 q = p - k * slope(p, tau);
    q = p - k * slope(q, tau);

    // How much the surface gathers that light here, or spreads it thin
    vec3 c = bend(q, tau);
    float det = (1.0 + k * c.x) * (1.0 + k * c.y) - k * k * c.z * c.z;
    float gather = sqrt(1.0 + SOFTEN * SOFTEN) / sqrt(det * det + SOFTEN * SOFTEN);

    // The light comes only through the letters' own shapes, and only from
    // letters whose turn has come
    vec4 source = texelAt(q - p);
    float since = uTime - letterStart(source);
    if ( !hasLetter(source) || since < 0.0 ) {
        fragColor = vec4(0.0);
        return;
    }
    float light = source.r * gather * smoothstep(0.0, APPEAR, since);
    fragColor = paint(min(light, PEAK) * uColor.a);
}
`;

export class Caustics extends GLText {
    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'caustics';
        super(el, {
            fragment,
            duration: settings.duration,
            letter: settings.letter,
            line: settings.line,
            overlap: true,
            pad: settings.pad,
            smoothStart: settings.smoothStart,
        });
    }
}
