// 18 Photon. The letters come out of the dark like a photo taken in very
// low light, one after another in reading order, the lines overlapping.
// Where each letter is about to be, the sensor's noise shows first: a dim,
// flickering field of fine specks, mostly dark, in the text's colour. The
// letter then rises out of it as its exposure builds, a smooth brightening
// with the noise riding on top, grainier while it's still faint. As the
// exposure completes the noise fades away and the crisp letter is left.
// Drawn in WebGL over the DOM text (see glText.js).

import {GLText} from './glText.js';

const settings = {
    // seconds each letter takes, from the first noise to the crisp letter
    duration: 1.4,
    // seconds between two letters starting, and between the starts of two lines
    letter: 0.04,
    line: 0.35,
    // how far the noise field reaches around the letters: the letters blurred this much, in em
    blur: 0.35,
    // em the letters' starts are blended over, so the noise field travels smoothly across the text
    smoothStart: 0.4,
    // how far the canvas reaches past the text, in em, room for the noise around the letters
    pad: '1.2em',
};

const fragment = `
// The sensor's noise: its brightest specks, and how many times a second each pixel changes
const float NOISE = 0.18;
const float RATE = 7.0;
// Shot noise on the letters while they're exposed
const float SHOT = 0.35;
// CSS px of one sensor pixel
const float PIXEL = 1.0;
// The noise field lies where the blurred letters are above FIELD_LOW, fully above FIELD_HIGH
const float FIELD_LOW = 0.03;
const float FIELD_HIGH = 0.12;
// s, for each letter: the noise comes in, the exposure builds, the noise clears until uDuration
const float NOISE_IN = 0.3;
const float EXPOSE_FROM = 0.2;
const float EXPOSE_TO = 1.05;
const float CLEAR_FROM = 0.85;

// A random number from 0 to 1 for a point in space
float hash3(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

// A random number for a sensor cell that changes a few times a second,
// each cell at its own moment, so the field flickers without pulsing
float flicker(vec2 cell, float salt) {
    float frame = floor(uTime * RATE + hash3(vec3(cell, salt)));
    return hash3(vec3(cell, frame * 7.13 + salt));
}

void main() {
    vec4 here = texel();
    if ( !hasLetter(here) ) {
        fragColor = vec4(0.0);
        return;
    }

    // The letter's own time, and the noise field's, which follows the letters around
    float own = uTime - letterStart(here);
    float field = uTime - nearbyStart(here);
    float crisp = here.r;

    // Exposed and cleared: the letter as the page draws it
    if ( own >= uDuration && field >= uDuration ) {
        fragColor = paint(crisp * uColor.a);
        return;
    }

    // How noisy the frame is here: coming in before the letter, gone once it's exposed
    float noisy = smoothstep(0.0, NOISE_IN, field) * (1.0 - smoothstep(CLEAR_FROM, uDuration, field));
    float area = smoothstep(FIELD_LOW, FIELD_HIGH, here.g);

    // The dark frame: mostly black, a few faint specks
    vec2 cell = floor(pixel() / PIXEL);
    vec3 dark = uColor.rgb * pow(flicker(cell, 1.0), 4.0) * NOISE * noisy * area;

    // The letter's signal, brightening smoothly as its exposure builds, with
    // shot noise riding on it, strongest while the signal is faint
    float signal = crisp * smoothstep(EXPOSE_FROM, EXPOSE_TO, own);
    float shot = SHOT * sqrt(signal) * (flicker(cell, 3.0) * 2.0 - 1.0) * noisy;
    float lit = clamp(signal + shot, 0.0, 1.0) * uColor.a;
    vec3 letter = uColor.rgb * lit;

    // The letter over the dark frame
    vec3 rgb = letter + dark * (1.0 - lit);
    float alpha = max(lit + max(dark.r, max(dark.g, dark.b)) * (1.0 - lit), max(rgb.r, max(rgb.g, rgb.b)));
    fragColor = vec4(rgb, clamp(alpha, 0.0, 1.0));
}
`;

export class Photon extends GLText {
    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'photon';
        super(el, {
            fragment,
            duration: settings.duration,
            blur: settings.blur,
            letter: settings.letter,
            line: settings.line,
            overlap: true,
            pad: settings.pad,
            smoothStart: settings.smoothStart,
        });
    }
}
