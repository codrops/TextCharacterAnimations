// 04 Loupe. A lens passes along each line, from before its first letter to
// past its last, and the line appears inside it. The lens isn't drawn: it is
// the magnification. Letters swell up from their baseline as it comes, the
// way icons do in the macOS Dock, and their neighbours move aside so none
// overlap. Letters ahead of the lens aren't there yet: they fade in as its
// front reaches them, in the accent colour at its centre, and settle behind
// it to their normal size, place and colour. Lines start one after another
// and overlap; at the end of each line the lens shrinks away.

const settings = {
    // seconds the lens takes per letter of the line
    letter: 0.04,
    // seconds between the starts of two lines
    stagger: 0.45,
    // magnification at the centre of the lens
    magnify: 1.9,
    // how quickly the magnification falls off around the centre, in em
    radius: 1.6,
    // how far before the first letter the lens starts, and past the last one
    // it stops, in radii
    before: 1.5,
    after: 1,
    // letters ahead of the centre start to fade in this far from it, and are
    // fully in this much closer, in radii
    front: 1.2,
    fadeIn: 0.7,
    // letters behind the centre lose the accent within this many letters
    accent: 2,
    // seconds for the lens to shrink away at the end of a line
    shrink: 0.3,
};

// The error function, close enough for moving letters (Abramowitz and Stegun 7.1.26)
const erf = x => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const tail = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return Math.sign(x) * (1 - tail * Math.exp(-x * x));
};

// Half the square root of pi: with it, the push adds up the room the
// magnified letters take
const HALF_ROOT_PI = Math.sqrt(Math.PI) / 2;

// Eases a 0 to 1 value in and out
const smooth = t => t * t * (3 - 2 * t);

// Whether a drawn value has moved enough to draw again; reaching 0 or 1 always counts
const hasMoved = (from, to, tolerance) => from !== to && (Math.abs(from - to) >= tolerance || to === 0 || to === 1);

// One line of text, split into characters, with its own lens
class Line {
    DOM = {
        // the line element
        el: null,
        // its characters
        chars: [],
    };
    // where each character's centre is along the line, in px, as if the line
    // never wrapped; measured when the line plays
    centres = [];
    // the line's average letter width and the lens radius, in px
    advance = 0;
    radius = 0;
    // the lens: where its centre is along the line, and how much it magnifies
    lens = {position: 0, magnify: 1};
    // what was last drawn for each character, so only the ones that change are touched
    drawn = [];
    // whether the lens is on this line
    isRunning = false;

    constructor(el) {
        this.DOM.el = el;
        this.DOM.chars = SplitText.create(el, {
            type: 'words, chars',
            wordsClass: 'word',
            charsClass: 'char',
        }).chars;
        el.classList.add('is-ready');
    }

    // Measures where every character sits, at its normal size and place
    measure() {
        this.DOM.chars.forEach(char => (char.style.transform = ''));
        this.drawn = [];

        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        const lineLeft = this.DOM.el.getBoundingClientRect().left;
        const rects = this.DOM.chars.map(char => char.getBoundingClientRect());
        let offset = 0;

        this.centres = rects.map((rect, i) => {
            const previous = rects[i - 1];
            // a line that wraps carries on along its next row, a space further
            if (previous && rect.top > previous.top + rect.height / 2) {
                offset += previous.right - rect.left + 0.25 * em;
            }
            return rect.left + rect.width / 2 - lineLeft + offset;
        });

        const span = this.centres[this.centres.length - 1] - this.centres[0];
        this.advance = span / Math.max(1, this.DOM.el.textContent.length - 1);
        this.radius = settings.radius * em;
    }

    // Where the lens starts and stops, and the seconds it takes in between
    getPath() {
        const from = this.centres[0] - settings.before * this.radius;
        const to = this.centres[this.centres.length - 1] + settings.after * this.radius;
        return {from, to, duration: (settings.letter * (to - from)) / this.advance};
    }

    // Shows every letter for where the lens is and how much it magnifies
    render() {
        const {position, magnify} = this.lens;
        const grow = magnify - 1;
        // letters behind the lens stay in place, the ones in it and ahead are
        // pushed on by the room the magnified ones take
        const push = grow * this.radius * HALF_ROOT_PI;
        // the accent shrinks away with the lens
        const strength = grow / (settings.magnify - 1);
        const accentReach = (settings.accent * this.advance) / this.radius;

        this.centres.forEach((centre, i) => {
            // distance from the lens centre, in radii; ahead of it is positive
            const distance = (centre - position) / this.radius;
            const opacity = smooth(gsap.utils.clamp(0, 1, (settings.front - distance) / settings.fadeIn));
            const scale = 1 + grow * Math.exp(-distance * distance);
            const x = push * (1 + erf(distance));
            const accent = strength * (distance >= 0 ? 1 : gsap.utils.clamp(0, 1, 1 + distance / accentReach));
            this.draw(i, {x, scale, opacity, accent});
        });
    }

    // Puts one letter where the lens has it, if it has moved enough to see
    draw(i, values) {
        const last = this.drawn[i];
        if (last) {
            // letters still out of sight don't need drawing
            if (last.opacity === 0 && values.opacity === 0) return;
            if (
                Math.abs(last.x - values.x) < 0.05 &&
                Math.abs(last.scale - values.scale) < 0.0005 &&
                !hasMoved(last.opacity, values.opacity, 0.005) &&
                !hasMoved(last.accent, values.accent, 0.005)
            )
                return;
        }

        const {style} = this.DOM.chars[i];
        style.transform = `translateX(${values.x}px) scale(${values.scale})`;
        style.opacity = values.opacity;
        style.setProperty('--lens', values.accent);
        this.drawn[i] = values;
    }

    // Every letter in its normal size, place and colour
    finish() {
        this.isRunning = false;
        this.drawn = [];
        this.DOM.chars.forEach(char => {
            char.style.transform = '';
            char.style.opacity = 1;
            char.style.removeProperty('--lens');
        });
    }

    // Back to nothing: no letters, no lens
    reset() {
        this.isRunning = false;
        this.drawn = [];
        this.lens.position = 0;
        this.lens.magnify = 1;
        this.DOM.chars.forEach(char => {
            char.style.transform = '';
            char.style.opacity = '';
            char.style.removeProperty('--lens');
        });
    }
}

export class Loupe {
    DOM = {
        // the element holding the lines
        el: null,
    };
    lines = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'loupe';
        this.DOM.el = el;
        this.lines = [...el.querySelectorAll('[data-line]')].map(lineEl => new Line(lineEl));
        this.measureBaseline();
        this.reset();
    }

    // Finds where the baseline sits in a character, from a mark of no size
    // sitting on it: the letters swell from there
    measureBaseline() {
        const char = this.lines[0].DOM.chars[0];
        const probe = document.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'display: inline-block; width: 0; height: 0; vertical-align: baseline;';
        char.append(probe);
        const baseline = probe.getBoundingClientRect().top - char.getBoundingClientRect().top;
        probe.remove();
        this.DOM.el.style.setProperty('--baseline', `${baseline}px`);
    }

    // Measures again after a resize, and redraws the lines the lens is on
    refresh() {
        this.lines.forEach(line => line.measure());
        this.measureBaseline();
        this.lines.forEach(line => {
            if (line.isRunning) line.render();
        });
    }

    play() {
        this.reset();
        this.timeline = gsap.timeline();

        this.lines.forEach((line, index) => {
            line.measure();
            const {from, to, duration} = line.getPath();
            const start = index * settings.stagger;

            this.timeline
                // the lens passes along the line
                .fromTo(
                    line.lens,
                    {position: from, magnify: settings.magnify},
                    {
                        position: to,
                        duration,
                        ease: 'sine.inOut',
                        onStart: () => (line.isRunning = true),
                        onUpdate: () => line.render(),
                    },
                    start,
                )
                // and shrinks away past its end
                .to(
                    line.lens,
                    {
                        magnify: 1,
                        duration: settings.shrink,
                        ease: 'power2.out',
                        onUpdate: () => line.render(),
                        onComplete: () => line.finish(),
                    },
                    start + duration,
                );
        });
    }

    reset() {
        this.timeline?.kill();
        this.lines.forEach(line => line.reset());
    }

    // Every line at once, for reduced motion
    show() {
        this.timeline?.kill();
        this.lines.forEach(line => line.finish());
    }
}
