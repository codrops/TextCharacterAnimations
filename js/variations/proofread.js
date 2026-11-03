// 02 Proofread. The lines are typed fast, each led by a thin caret, with the
// slips a fast typist makes: a wrong key, two letters the wrong way round, a
// letter left out, a letter typed twice. Then one caret goes back through
// the text in reading order and mends each one: a wrong letter drops out as
// the right one comes down, swapped letters trade places over and under each
// other, the letters after a missing one part to let it in, and a doubled
// letter slides into its twin as the line closes up.

// The keys next to each letter on a QWERTY keyboard, the same row first:
// where a fast finger lands instead
const NEIGHBOURS = {
    q: 'wa',
    w: 'qeas',
    e: 'wrsd',
    r: 'etdf',
    t: 'ryfg',
    y: 'tugh',
    u: 'yihj',
    i: 'uojk',
    o: 'ipkl',
    p: 'ol',
    a: 'sqwz',
    s: 'adwezx',
    d: 'sferxc',
    f: 'dgrtcv',
    g: 'fhtyvb',
    h: 'gjyubn',
    j: 'hkuinm',
    k: 'jliom',
    l: 'kop',
    z: 'xas',
    x: 'zcsd',
    c: 'xvdf',
    v: 'cbfg',
    b: 'vngh',
    n: 'bmhj',
    m: 'njk',
};

const settings = {
    // mistakes across the lines
    mistakes: 5,
    // seconds per glyph typed
    letter: 0.016,
    // seconds between the starts of two lines
    stagger: 0.18,
    // seconds between the last glyph typed and the caret going back
    pause: 0.2,
    // seconds the caret takes to reach a mistake
    move: 0.2,
    // seconds the caret rests at a mistake before it blinks, and after
    rest: 0.03,
    // seconds the caret is off as it blinks
    off: 0.08,
    // seconds a mended letter takes to go from the accent back to the text colour
    settle: 0.6,
};

const isLetter = text => /^\p{L}$/u.test(text);

// Where an element sits in the text block, leaving out the transform it may be animating
const getBox = (el, origin) => {
    const rect = el.getBoundingClientRect();
    return {
        x: rect.left - origin.left - gsap.getProperty(el, 'x'),
        y: rect.top - origin.top - gsap.getProperty(el, 'y'),
        width: rect.width,
    };
};

// The point just after an element, where the caret stands
const getEnd = (el, origin) => {
    const box = getBox(el, origin);
    return {x: box.x + box.width, y: box.y};
};

// Records where the glyphs after an element in its line are, and returns a
// function that slides them from there to wherever they end up
const recordGlyphsAfter = el => {
    const glyphs = [...el.closest('[data-line]').querySelectorAll('.char, .slip')];
    const after = glyphs.slice(glyphs.indexOf(el) + 1).filter(glyph => !glyph.classList.contains('is-out'));
    const state = Flip.getState(after);
    // transforms only: the glyphs keep their size
    return vars => (after.length ? Flip.from(state, {scale: true, simple: true, ...vars}) : gsap.timeline());
};

// Takes a letter typed by mistake out of the line, leaving it where it stands
const liftOut = el => {
    const rect = el.getBoundingClientRect();
    const parent = el.offsetParent.getBoundingClientRect();
    gsap.set(el, {position: 'absolute', left: rect.left - parent.left, top: rect.top - parent.top});
};

// A letter that is only in the typed line
const createSlip = text => {
    const slip = document.createElement('span');
    slip.className = 'slip';
    slip.setAttribute('aria-hidden', 'true');
    slip.textContent = text;
    return slip;
};

// A wrong key: a neighbour of the right letter, typed in its place
class Typo {
    constructor(char, wrong) {
        // the right letter, out of the line while the wrong one stands in
        this.char = char;
        this.slip = createSlip(wrong);
        // the caret stops after the wrong letter, which lights up as it blinks
        this.anchor = this.slip;
        this.marked = [this.slip];
    }

    apply() {
        this.char.before(this.slip);
        this.char.classList.add('is-out');
    }

    restore() {
        this.slip.remove();
        gsap.set(this.slip, {clearProps: 'all'});
        this.char.classList.remove('is-out');
    }

    // The wrong letter drops out as the right one comes down into its place,
    // lit, and the rest of the line takes up the difference in width
    mend(caret, origin, em, colors) {
        const slide = recordGlyphsAfter(this.char);
        liftOut(this.slip);
        this.char.classList.remove('is-out');
        const end = getEnd(this.char, origin);

        return gsap
            .timeline()
            .to(this.slip, {y: 0.35 * em, opacity: 0, duration: 0.25, ease: 'power2.in'}, 0)
            .fromTo(this.char, {y: -0.35 * em, opacity: 0}, {y: 0, opacity: 1, duration: 0.3, ease: 'power3.out'}, 0)
            .fromTo(
                this.char,
                {color: colors.accent},
                {color: colors.text, duration: settings.settle, ease: 'power1.in', clearProps: 'color'},
                0.3,
            )
            .add(slide({duration: 0.3, ease: 'power3.out'}), 0)
            .to(caret, {x: end.x, y: end.y, duration: 0.3, ease: 'power3.out'}, 0)
            .call(() => this.slip.remove(), null, 0.3)
            .addLabel('mended', 0.3);
    }
}

// Two letters typed the wrong way round
class Swap {
    constructor(first, second) {
        // the two letters in their true order
        this.first = first;
        this.second = second;
        // the caret stops after the pair, and both light up as it blinks
        this.anchor = first;
        this.marked = [second, first];
    }

    apply() {
        this.first.before(this.second);
    }

    restore() {
        this.second.before(this.first);
    }

    // The letter on the left arcs over to the right as the other one passes
    // under it to the left, both going from the accent back to the text colour
    mend(caret, origin, em, colors) {
        const left = getBox(this.second, origin).x;
        const right = getBox(this.first, origin).x;
        this.restore();
        const toLeft = getBox(this.first, origin).x;
        const toRight = getBox(this.second, origin).x;
        const end = getEnd(this.second, origin);

        return gsap
            .timeline()
            .fromTo(this.second, {x: left - toRight}, {x: 0, duration: 0.38, ease: 'power2.inOut'}, 0)
            .to(this.second, {y: -0.45 * em, duration: 0.19, ease: 'sine.out', yoyo: true, repeat: 1}, 0)
            .fromTo(this.first, {x: right - toLeft}, {x: 0, duration: 0.38, ease: 'power2.inOut'}, 0)
            .to(this.first, {y: 0.15 * em, duration: 0.19, ease: 'sine.out', yoyo: true, repeat: 1}, 0)
            .to(
                this.marked,
                {color: colors.text, duration: settings.settle, ease: 'power1.in', clearProps: 'color'},
                0.3,
            )
            .to(caret, {x: end.x, y: end.y, duration: 0.38, ease: 'power2.inOut'}, 0)
            .addLabel('mended', 0.38);
    }
}

// A letter left out
class Missing {
    constructor(char) {
        // the letter, out of the line until it's mended
        this.char = char;
        // the caret stops in the gap, after the letter before
        this.anchor = char.previousElementSibling;
        this.marked = [];
    }

    apply() {
        this.char.classList.add('is-out');
    }

    restore() {
        this.char.classList.remove('is-out');
    }

    // The letters after the gap part to make room, the letter drops into it,
    // lit, and the caret steps past it
    mend(caret, origin, em, colors) {
        const slide = recordGlyphsAfter(this.char);
        this.restore();
        const end = getEnd(this.char, origin);

        return gsap
            .timeline()
            .add(slide({duration: 0.32, ease: 'power3.inOut'}), 0)
            .fromTo(this.char, {y: -0.5 * em, opacity: 0}, {y: 0, opacity: 1, duration: 0.32, ease: 'power3.out'}, 0.05)
            .fromTo(
                this.char,
                {color: colors.accent},
                {color: colors.text, duration: settings.settle, ease: 'power1.in', clearProps: 'color'},
                0.37,
            )
            .to(caret, {x: end.x, y: end.y, duration: 0.32, ease: 'power3.inOut'}, 0)
            .addLabel('mended', 0.37);
    }
}

// A letter typed twice
class Double {
    constructor(char) {
        // the letter, and the extra one typed after it
        this.char = char;
        this.slip = createSlip(char.textContent);
        // the caret stops after the extra letter, which lights up as it blinks
        this.anchor = this.slip;
        this.marked = [this.slip];
    }

    apply() {
        this.char.after(this.slip);
    }

    restore() {
        this.slip.remove();
        gsap.set(this.slip, {clearProps: 'all'});
    }

    // The extra letter slides into its twin and fades as the rest of the
    // line closes the gap behind it
    mend(caret, origin) {
        const slide = recordGlyphsAfter(this.slip);
        const from = getBox(this.slip, origin);
        const twin = getBox(this.char, origin);
        liftOut(this.slip);

        return gsap
            .timeline()
            .to(this.slip, {x: twin.x - from.x, duration: 0.3, ease: 'power2.inOut'}, 0)
            .to(this.slip, {opacity: 0, duration: 0.3, ease: 'power2.in'}, 0)
            .add(slide({duration: 0.3, ease: 'power2.inOut'}), 0)
            .to(caret, {x: twin.x + twin.width, y: twin.y, duration: 0.3, ease: 'power2.inOut'}, 0)
            .call(() => this.slip.remove())
            .addLabel('mended', 0.3);
    }
}

// Each kind of mistake, made at the letter in a word a fast typist would get
// wrong; handed out in this order to the words picked
const MISTAKES = {
    // the two letters before the last, or further in if those are the same
    swap: letters => {
        for (let i = letters.length - 3; i >= 1; i--) {
            if (letters[i].textContent.toLowerCase() !== letters[i + 1].textContent.toLowerCase()) {
                return new Swap(letters[i], letters[i + 1]);
            }
        }
        return null;
    },
    // a letter near the middle
    double: letters => new Double(letters[Math.floor((letters.length - 1) / 2)]),
    // the third letter
    missing: letters => new Missing(letters[2]),
    // the letter before the last, or further in if it has no neighbours on the keyboard
    typo: letters => {
        for (let i = letters.length - 2; i >= 1; i--) {
            const letter = letters[i].textContent;
            const neighbour = NEIGHBOURS[letter.toLowerCase()]?.[0];
            if (neighbour) {
                return new Typo(letters[i], letter === letter.toLowerCase() ? neighbour : neighbour.toUpperCase());
            }
        }
        return null;
    },
};
const KINDS = Object.keys(MISTAKES);

// A word's letters, without the punctuation at its end; none if it has anything but letters
const getLetters = word => {
    const chars = [...word.querySelectorAll('.char')];
    let end = chars.length;
    while (end > 0 && /^[^\p{L}\p{N}]$/u.test(chars[end - 1].textContent)) end--;
    const letters = chars.slice(0, end);
    return letters.every(char => isLetter(char.textContent)) ? letters : [];
};

// Picks where the typist slips, the same every time: words of four letters
// or more, spread evenly through the text in reading order, one mistake per
// word, the kinds in turn
const pickMistakes = lines => {
    const words = lines
        .flatMap(line => line.DOM.words)
        .map(getLetters)
        .filter(letters => letters.length >= 4);
    const count = Math.min(settings.mistakes, words.length);
    const mistakes = [];
    for (let i = 0; i < count; i++) {
        const letters = words[Math.floor(((i + 0.5) * words.length) / count)];
        const mistake = MISTAKES[KINDS[i % KINDS.length]](letters);
        if (mistake) mistakes.push(mistake);
    }
    return mistakes;
};

// One line of text, split into characters, with its own caret
class Line {
    DOM = {
        // the line element
        el: null,
        // its words and characters, in the true text
        words: [],
        chars: [],
        // its caret, kept in the text block so it can travel to other lines
        caret: null,
        bar: null,
    };
    // the glyphs in the order they're typed, mistakes included
    typed = [];
    // where the caret stands before the first glyph and after each one,
    // in the text block; measured when the line plays
    stops = [];
    // tweened from 0 to the number of glyphs
    progress = {head: 0};
    // how many glyphs are on screen
    head = 0;
    // while the line is being typed, a resize moves its caret too
    isTyping = false;

    constructor(el, block) {
        this.DOM.el = el;
        const split = SplitText.create(el, {
            type: 'words, chars',
            wordsClass: 'word',
            charsClass: 'char',
        });
        this.DOM.words = split.words;
        this.DOM.chars = split.chars;

        this.DOM.caret = document.createElement('span');
        this.DOM.caret.className = 'caret';
        this.DOM.caret.setAttribute('aria-hidden', 'true');
        this.DOM.bar = document.createElement('span');
        this.DOM.bar.className = 'caret__bar';
        this.DOM.caret.append(this.DOM.bar);
        block.append(this.DOM.caret);

        el.classList.add('is-ready');
    }

    // Lists the glyphs as typed, once the mistakes are in
    collect() {
        this.typed = [...this.DOM.el.querySelectorAll('.char, .slip')].filter(
            glyph => !glyph.classList.contains('is-out'),
        );
    }

    // Measures where the caret goes before the first glyph and after each one
    measure(origin) {
        if (!this.typed.length) return;
        const first = getBox(this.typed[0], origin);
        this.stops = [{x: first.x, y: first.y}, ...this.typed.map(glyph => getEnd(glyph, origin))];
    }

    // Shows the glyphs typed so far, at once, with the caret after them
    render() {
        const head = Math.min(Math.floor(this.progress.head), this.typed.length);
        if (head === this.head) return;
        for (let i = this.head; i < head; i++) {
            this.typed[i].style.opacity = 1;
        }
        this.head = head;
        this.placeCaret();
    }

    // The whole typed line on screen, the caret after it
    finish() {
        this.typed.forEach(glyph => (glyph.style.opacity = 1));
        this.head = this.typed.length;
        this.placeCaret();
        this.isTyping = false;
    }

    placeCaret() {
        const {x, y} = this.stops[this.head] ?? {x: 0, y: 0};
        gsap.set(this.DOM.caret, {x, y});
    }

    // Back to nothing typed and no caret
    reset() {
        this.typed = [];
        this.stops = [];
        this.progress.head = 0;
        this.head = 0;
        this.isTyping = false;
        gsap.set(this.DOM.caret, {autoAlpha: 0, x: 0, y: 0});
        gsap.set(this.DOM.bar, {opacity: 1});
    }
}

export class Proofread {
    DOM = {
        // the element holding the lines and their carets
        el: null,
    };
    lines = [];
    // every character of the true text
    chars = [];
    // the mistakes, in reading order
    mistakes = [];
    // the line whose caret stays to proofread: the one typed last
    reader = null;
    // the typing
    timeline = null;
    // the accent a mistake lights up in, and the text colour it settles to; read when the text plays
    colors = null;
    // the proofreading step running now, built as it starts so it measures the text as it is
    chain = null;
    // the mends played so far, whose accents may still be fading
    mends = [];

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'proofread';
        this.DOM.el = el;
        this.fitCarets();
        this.lines = [...el.querySelectorAll('[data-line]')].map(lineEl => new Line(lineEl, el));
        this.chars = this.lines.flatMap(line => line.DOM.chars);
        this.mistakes = pickMistakes(this.lines);
        this.reset();
    }

    // The carets reach as high and as low as the text's own letters do in
    // its font, kept as a share of the font size
    fitCarets() {
        const style = getComputedStyle(this.DOM.el);
        const context = document.createElement('canvas').getContext('2d');
        context.font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;
        const metrics = context.measureText(this.DOM.el.textContent.replace(/\s+/g, ' ').trim());
        const ascent = metrics.actualBoundingBoxAscent / 100;
        const descent = metrics.actualBoundingBoxDescent / 100;
        if (ascent > 0) this.DOM.el.style.setProperty('--caret-ascent', `${ascent}em`);
        this.DOM.el.style.setProperty('--caret-descent', `${Math.max(0, descent)}em`);
    }

    // Measures again after a resize and moves the carets still typing to match
    refresh() {
        const origin = this.DOM.el.getBoundingClientRect();
        this.lines
            .filter(line => line.isTyping)
            .forEach(line => {
                line.measure(origin);
                line.placeCaret();
            });
    }

    play() {
        this.reset();
        this.mistakes.forEach(mistake => mistake.apply());

        // the accent that marks a mistake, and the text colour a mended letter settles to
        const style = getComputedStyle(this.DOM.el);
        this.colors = {accent: style.getPropertyValue('--color-accent').trim() || '#e23e1d', text: style.color};

        const origin = this.DOM.el.getBoundingClientRect();
        this.lines.forEach(line => {
            line.collect();
            line.measure(origin);
            line.placeCaret();
            line.isTyping = true;
        });

        const ends = this.lines.map((line, index) => index * settings.stagger + line.typed.length * settings.letter);
        const last = ends.lastIndexOf(Math.max(...ends));
        this.reader = this.lines[last];
        this.timeline = gsap.timeline();

        this.lines.forEach((line, index) => {
            const start = index * settings.stagger;

            this.timeline.set(line.DOM.caret, {autoAlpha: 1}, start).to(
                line.progress,
                {
                    head: line.typed.length,
                    duration: line.typed.length * settings.letter,
                    ease: 'none',
                    onUpdate: () => line.render(),
                    onComplete: () => line.finish(),
                },
                start,
            );

            // The other carets go once their line is typed
            if (index !== last) {
                this.timeline.to(line.DOM.caret, {autoAlpha: 0, duration: 0.15, ease: 'power1.out'}, ends[index] + 0.1);
            }
        });

        this.timeline.call(() => this.proofread(0), null, ends[last] + settings.pause);
    }

    // Takes the caret to a mistake and blinks it there as the letters in
    // question light up in the accent, then mends it; after the last one the
    // caret fades out
    proofread(index) {
        const mistake = this.mistakes[index];
        const {caret, bar} = this.reader.DOM;

        if (!mistake) {
            this.chain = gsap.to(caret, {autoAlpha: 0, duration: 0.3, delay: 0.15, ease: 'power1.out'});
            return;
        }

        const spot = getEnd(mistake.anchor, this.DOM.el.getBoundingClientRect());
        const off = settings.move + settings.rest;
        const on = off + settings.off;

        this.chain = gsap
            .timeline()
            .to(caret, {x: spot.x, y: spot.y, duration: settings.move, ease: 'power3.inOut'})
            .set(bar, {opacity: 0}, off)
            .set(bar, {opacity: 1}, on)
            .call(() => this.mend(index), null, on + settings.rest);

        if (mistake.marked.length) {
            this.chain.to(mistake.marked, {color: this.colors.accent, duration: settings.off, ease: 'power1.out'}, off);
        }
    }

    // Mends a mistake, measured as the text stands now, then goes on to the next
    mend(index) {
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        // the caret goes on to the next mistake as soon as the letters are in
        // place, while the mended ones fade from the accent on their own
        this.chain = this.mistakes[index]
            .mend(this.reader.DOM.caret, this.DOM.el.getBoundingClientRect(), em, this.colors)
            .call(() => this.proofread(index + 1), null, 'mended');
        this.mends.push(this.chain);
    }

    reset() {
        this.timeline?.kill();
        this.chain?.kill();
        this.mends.forEach(mend => mend.kill());
        this.mends = [];
        this.mistakes.forEach(mistake => mistake.restore());
        gsap.set(this.chars, {clearProps: 'transform,opacity,color'});
        this.lines.forEach(line => line.reset());
    }

    // The true text at once, for reduced motion
    show() {
        this.reset();
        gsap.set(this.chars, {opacity: 1});
    }
}
