// 17 Photocopy. The letters arrive one by one, in reading order, each as
// a copy of a copy of a copy: strokes swollen, counters filling in, toner
// specks scattered around it, holes broken into it, sitting a pixel or two
// out of place, its soft edges gone hard. It then comes back through the
// generations in steps, every step a cleaner copy with a new pattern of
// wear, until it's the crisp letter. Each letter steps at its own pace, so
// a line clears unevenly. Drawn in WebGL over the DOM text (see glText.js).

import {GLText} from './glText.js';

const settings = {
    // copies a letter comes back through, from the worst to the crisp letter
    generations: 6,
    // seconds each copy lasts for the slowest letters
    generation: 0.15,
    // the quickest letters take this share of that
    fastest: 0.55,
    // px the worst copy lands out of place
    slip: 1.4,
    // how soft the blurred letters the strokes swell from are, in em
    blur: 0.06,
};

const fragment = `
// Copies a letter comes back through, and the quickest letters' share of the slowest one's time
const float GENERATIONS = ${settings.generations.toFixed(1)};
const float FASTEST = ${settings.fastest.toFixed(3)};
// px the worst copy lands out of place
const float SLIP = ${settings.slip.toFixed(2)};
// Level the blurred letter is cut at, in the first copy and in the worst:
// the lower, the thicker the strokes
const float CUT_FIRST = 0.36;
const float CUT_WORST = 0.17;
// px between the places a speck of toner can land
const float CELL = 1.6;

void main() {
    vec4 here = texel();
    float time = uTime - letterStart(here);

    // Nothing far from the letters, or before the letter's turn
    if ( !hasLetter(here) || time < 0.0 ) {
        fragColor = vec4(0.0);
        return;
    }

    // The copy the letter is at: the worst when it arrives, one better at
    // every step, 0 once it's the crisp letter
    float seed = letterSeed(here);
    float pace = uDuration * mix(FASTEST, 1.0, seed) / GENERATIONS;
    float generation = max(0.0, GENERATIONS - floor(time / pace));
    if ( generation == 0.0 ) {
        fragColor = paint(here.r * uColor.a);
        return;
    }
    float worn = generation / GENERATIONS;
    // every copy of every letter wears in its own pattern
    vec2 copy = vec2(generation * 7.31, seed * 113.7);
    vec2 p = pixel();

    // Misregistration: the copy lands a pixel or two out of place
    vec2 slip = (vec2(hash(copy), hash(copy + 19.1)) - 0.5) * 2.0 * SLIP * worn;
    vec4 original = texelAt(-slip);

    // Swollen strokes: the blurred letter cut lower with every copy
    float cut = mix(CUT_FIRST, CUT_WORST, worn);
    float toner = max(original.r, smoothstep(cut - 0.03, cut + 0.03, original.g));
    // Crushed contrast: the soft edges go hard
    float hard = mix(0.3, 0.05, worn);
    toner = smoothstep(0.5 - hard, 0.5 + hard, toner);
    // Broken strokes: the toner drops out in small streaks along the page
    float holes = 0.4 * worn;
    toner *= smoothstep(holes - 0.05, holes + 0.05, noise(p * vec2(0.6, 1.2) + copy));

    // Toner speckle: stray dots around the letter, more of them close to it
    vec2 cell = floor(p / CELL);
    vec2 key = cell + copy;
    float near = smoothstep(0.02, 0.25, original.g);
    float speck = 0.0;
    if ( hash(key) < worn * (0.015 + 0.35 * near) ) {
        vec2 centre = (cell + 0.35 + 0.3 * vec2(hash(key + 3.7), hash(key + 5.3))) * CELL;
        float radius = mix(0.25, 0.55, hash(key + 9.1));
        float edge = 0.5 / uPixelRatio;
        speck = 1.0 - smoothstep(radius - edge, radius + edge, distance(p, centre));
    }

    // Uneven toner, patchier the worse the copy
    float density = mix(1.0, 0.8 + 0.2 * noise(p * 0.3 + copy), worn);
    fragColor = paint(max(toner, speck) * density * uColor.a);
}
`;

export class Photocopy extends GLText {
    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'photocopy';
        super(el, {
            fragment,
            duration: settings.generations * settings.generation,
            blur: settings.blur,
        });
    }
}
