// 01 Cursor Scramble. Lines start one after another from the top. In each
// one a block cursor appears and types the line out, with a few dim guesses
// running ahead of it; the letters it leaves behind brighten over the next
// few letters. At the end of its line the cursor blinks twice and goes.
// The cursor led by random glyphs comes from the help panel of SQNCR by
// halfof8 (seq.halfof8.com).

// The glyphs the guesses are drawn from
const GLYPHS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>=+*';

// Picks one of the glyphs at random
const getRandomGlyph = gsap.utils.random([...GLYPHS], true);

const settings = {
    // seconds per letter
    letter: 0.035,
    // seconds between new guesses
    shuffle: 0.05,
    // guesses running ahead of the cursor
    guesses: 3,
    // letters a new letter takes to reach full brightness
    fade: 4,
    // seconds between the starts of two lines
    stagger: 0.18,
    // seconds the cursor is off, then on, as it blinks out
    blink: 0.25,
    // blinks at the end of a line
    blinks: 2,
};

// One line of text, split into characters, with its own cursor
class Line {
    DOM = {
        // the line element
        el: null,
        // its characters
        chars: [],
        // the guesses and the cursor, moved together to the next letter
        typer: null,
        guesses: null,
        cursor: null,
    };
    // where the typer sits before each character, and after the last one,
    // relative to the line; measured when the line plays
    stops = [];
    // tweened past the last character, so the last letters finish brightening
    progress = {head: 0};
    // how many letters the cursor has passed
    head = 0;
    // the guesses, and when they were last picked
    glyphs = Array.from({length: settings.guesses}, getRandomGlyph);
    lastShuffle = 0;

    constructor(el) {
        this.DOM.el = el;
        this.DOM.chars = SplitText.create(el, {
            type: 'words, chars',
            wordsClass: 'word',
            charsClass: 'char',
        }).chars;

        this.DOM.typer = document.createElement('span');
        this.DOM.typer.className = 'typer';
        this.DOM.typer.setAttribute('aria-hidden', 'true');
        this.DOM.guesses = document.createElement('span');
        this.DOM.guesses.className = 'typer__guesses';
        this.DOM.cursor = document.createElement('span');
        this.DOM.cursor.className = 'typer__cursor';
        this.DOM.typer.append(this.DOM.guesses, this.DOM.cursor);
        el.append(this.DOM.typer);

        el.classList.add('is-ready');
    }

    // Measures where the typer goes before each character, and after the last
    measure() {
        const lineRect = this.DOM.el.getBoundingClientRect();
        const rects = this.DOM.chars.map(char => char.getBoundingClientRect());
        const last = rects[rects.length - 1];
        this.stops = rects.map(rect => ({x: rect.left - lineRect.left, y: rect.top - lineRect.top}));
        this.stops.push({x: last.right - lineRect.left, y: last.top - lineRect.top});
    }

    // Shows the letters, the guesses and the cursor for the current progress
    render() {
        const total = this.DOM.chars.length;
        const head = Math.floor(this.progress.head);
        const now = gsap.ticker.time;
        const isShuffleDue = now - this.lastShuffle >= settings.shuffle;

        if (head === this.head && !isShuffleDue) return;

        // Each letter brightens as the cursor moves away from it
        for (let i = Math.max(0, this.head - settings.fade); i < Math.min(head, total); i++) {
            this.DOM.chars[i].style.opacity = Math.min(1, (head - i) / settings.fade);
        }

        if (isShuffleDue) {
            this.glyphs = this.glyphs.map(() => getRandomGlyph());
            this.lastShuffle = now;
        }

        // Fewer guesses as the line runs out of letters
        const left = Math.max(0, total - head);
        this.DOM.guesses.textContent = this.glyphs.slice(0, Math.min(settings.guesses, left)).join('');

        this.head = head;
        this.placeTyper();
    }

    // Puts the guesses and the cursor where the next letter goes
    placeTyper() {
        const next = Math.min(this.head, this.DOM.chars.length);
        const {x, y} = this.stops[next] ?? {x: 0, y: 0};
        gsap.set(this.DOM.typer, {x, y});
    }

    // Every letter at full brightness, no guesses
    finish() {
        this.DOM.chars.forEach(char => (char.style.opacity = 1));
        this.DOM.guesses.textContent = '';
        this.head = this.DOM.chars.length;
        this.placeTyper();
    }

    // Back to nothing: no letters, no cursor
    reset() {
        this.DOM.chars.forEach(char => (char.style.opacity = ''));
        this.DOM.guesses.textContent = '';
        this.progress.head = 0;
        this.head = 0;
        gsap.set(this.DOM.typer, {autoAlpha: 0});
        gsap.set(this.DOM.cursor, {opacity: 1});
        this.placeTyper();
    }
}

export class CursorScramble {
    DOM = {
        // the element holding the lines
        el: null,
    };
    lines = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'cursor-scramble';
        this.DOM.el = el;
        this.lines = [...el.querySelectorAll('[data-line]')].map(lineEl => new Line(lineEl));
        this.reset();
    }

    // Measures again after a resize and moves the cursors to match
    refresh() {
        this.lines.forEach(line => {
            line.measure();
            line.placeTyper();
        });
    }

    play() {
        this.reset();
        this.timeline = gsap.timeline();

        this.lines.forEach((line, index) => {
            line.measure();
            const total = line.DOM.chars.length;
            const start = index * settings.stagger;
            const end = start + total * settings.letter;

            this.timeline.set(line.DOM.typer, {autoAlpha: 1}, start).to(
                line.progress,
                {
                    head: total + settings.fade,
                    duration: (total + settings.fade) * settings.letter,
                    ease: 'none',
                    onUpdate: () => line.render(),
                    onComplete: () => line.finish(),
                },
                start,
            );

            // The cursor blinks out at the end of its line
            for (let i = 0; i < settings.blinks; i++) {
                this.timeline
                    .set(line.DOM.cursor, {opacity: 0}, end + settings.blink * (2 * i + 1))
                    .set(line.DOM.cursor, {opacity: 1}, end + settings.blink * (2 * i + 2));
            }
            this.timeline.set(line.DOM.typer, {autoAlpha: 0}, end + settings.blink * (2 * settings.blinks + 1));
        });
    }

    reset() {
        this.timeline?.kill();
        this.lines.forEach(line => line.reset());
    }

    // Every line at once, for reduced motion
    show() {
        this.timeline?.kill();
        this.lines.forEach(line => {
            line.finish();
            gsap.set(line.DOM.typer, {autoAlpha: 0});
        });
    }
}
