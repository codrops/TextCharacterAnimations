// 15 Screen Reader. The text is read out the way a screen reader reads a
// page, one thing at a time. A focus box in the accent colour, like the one
// VoiceOver draws around whatever it's reading, shows up around the first
// word, shrinking in to fit it, and moves through the text word by word, line
// after line. As it lands on a word, the word's letters appear quickly from
// left to right; the box stays as long as the word takes to say, then glides
// on to the next one, stretching or shrinking to fit it, and down to the start
// of the next row at the end of a line. After the last word, it fades.

const settings = {
    // seconds the box takes to show up around the first word, fading in as it
    // shrinks to fit, and how much larger it starts, in em on each side
    appear: 0.2,
    grow: 0.2,
    // the pace, quicker on small text and slower on big text; in between for
    // sizes in between (px): seconds the box stays on a word, plus more for
    // each of its letters, about as long as the word takes to say; seconds it
    // takes to glide to the next word; and seconds apart the word's letters
    // start to appear as it lands, and each one takes to appear
    small: {size: 20, word: 0.01, letter: 0.0055, move: 0.035, stagger: 0.004, reveal: 0.04},
    big: {size: 80, word: 0.045, letter: 0.022, move: 0.14, stagger: 0.012, reveal: 0.08},
    // room between a word and the outline on either side, in em; above and
    // below, the outline sits just outside the word's line
    room: 0.12,
    // the outline's thickness, in em, never thinner than 2px, and its corner radius, in em
    stroke: 0.05,
    thinnest: 2,
    radius: 0.18,
    // seconds the box takes to fade once the last word is read
    fade: 0.25,
};

// How long the box's straight sides are before they're stretched to fit, as
// in the CSS (px)
const SIDE = 100;
// How far each side reaches into the corners at its ends, under their
// straight part, so no seam shows where they meet (px)
const OVERLAP = 1;

export class ScreenReader {
    DOM = {
        // the element holding the lines
        el: null,
        // every character of the text, line after line
        chars: [],
        // the layer over the text holding the focus box
        layer: null,
        // the box's four rounded corners and four straight sides
        corners: {},
        sides: {},
    };
    // each word of the text: its element and its characters
    words = [];
    // the box around each word, relative to the text; measured when the text plays
    boxes = [];
    // where the box is drawn now, tweened from word to word
    box = {x: 0, y: 0, width: 0, height: 0};
    // the outline's thickness and corner radius for the text's size (px)
    outline = {stroke: 2, radius: 4};
    // the word the box is on, by its index
    reading = 0;
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'screen-reader';
        this.DOM.el = el;

        el.querySelectorAll('[data-line]').forEach(line => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => {
                this.words.push({el: wordEl, chars: split.chars.filter(char => wordEl.contains(char))});
            });
            this.DOM.chars.push(...split.chars);
            line.classList.add('is-ready');
        });

        // The focus box, drawn from eight pieces so its outline keeps one thickness (see the CSS)
        this.DOM.layer = document.createElement('div');
        this.DOM.layer.className = 'focus';
        this.DOM.layer.setAttribute('aria-hidden', 'true');
        const piece = (kind, name) => {
            const span = document.createElement('span');
            span.className = `focus__${kind} focus__${kind}--${name}`;
            this.DOM.layer.append(span);
            return span;
        };
        this.DOM.corners = {
            topLeft: piece('corner', 'top-left'),
            topRight: piece('corner', 'top-right'),
            bottomLeft: piece('corner', 'bottom-left'),
            bottomRight: piece('corner', 'bottom-right'),
        };
        this.DOM.sides = {
            top: piece('side', 'top'),
            bottom: piece('side', 'bottom'),
            left: piece('side', 'left'),
            right: piece('side', 'right'),
        };
        el.append(this.DOM.layer);

        this.reset();
    }

    // Measures the outline for the text's size, and the box around each
    // word: its line, with room either side, and the outline outside that
    measure() {
        const textRect = this.DOM.el.getBoundingClientRect();
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        // a whole number of pixels, so the straight sides are as thick as the corners
        const stroke = Math.round(Math.max(settings.thinnest, em * settings.stroke));
        const radius = Math.max(stroke, em * settings.radius);
        this.outline = {stroke, radius};
        this.DOM.layer.style.setProperty('--stroke', `${stroke}px`);
        this.DOM.layer.style.setProperty('--radius', `${radius}px`);

        const side = em * settings.room + stroke;
        this.boxes = this.words.map(word => {
            const rect = word.el.getBoundingClientRect();
            return {
                x: rect.left - textRect.left - side,
                y: rect.top - textRect.top - stroke,
                width: rect.width + side * 2,
                height: rect.height + stroke * 2,
            };
        });
    }

    // Where the box goes to sit around a word, read as it sets off, so it
    // fits the word as the text is laid out then
    fit(index) {
        return {
            x: () => this.boxes[index].x,
            y: () => this.boxes[index].y,
            width: () => this.boxes[index].width,
            height: () => this.boxes[index].height,
        };
    }

    // Draws the box where it is now: the corners move to its corners and the
    // sides stretch between them
    draw() {
        const {x, y, width, height} = this.box;
        const {stroke, radius} = this.outline;
        const {corners, sides} = this.DOM;
        const right = x + width;
        const bottom = y + height;
        const set = (piece, left, top, stretch = '') => {
            piece.style.transform = `translate(${left}px, ${top}px)${stretch}`;
        };

        set(corners.topLeft, x, y);
        set(corners.topRight, right - radius, y);
        set(corners.bottomLeft, x, bottom - radius);
        set(corners.bottomRight, right - radius, bottom - radius);

        const across = ` scaleX(${Math.max(0, width - radius * 2 + OVERLAP * 2) / SIDE})`;
        const down = ` scaleY(${Math.max(0, height - radius * 2 + OVERLAP * 2) / SIDE})`;
        set(sides.top, x + radius - OVERLAP, y, across);
        set(sides.bottom, x + radius - OVERLAP, bottom - stroke, across);
        set(sides.left, x, y + radius - OVERLAP, down);
        set(sides.right, right - stroke, y + radius - OVERLAP, down);
    }

    // Measures again after a resize and puts the box back around the word it's on
    refresh() {
        this.measure();
        const box = this.boxes[this.reading];
        if (!box) return;
        Object.assign(this.box, box);
        this.draw();
    }

    play() {
        this.reset();
        if (!this.words.length) return;
        this.measure();

        // the pace for the text's size
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        const {small, big} = settings;
        const pace = key =>
            gsap.utils.mapRange(small.size, big.size, small[key], big[key], gsap.utils.clamp(small.size, big.size, em));
        const [word, letter, move, stagger, reveal] = ['word', 'letter', 'move', 'stagger', 'reveal'].map(pace);

        // The box shows up around the first word, a little larger, and fades
        // in as it shrinks to fit
        const grow = em * settings.grow;
        const first = this.boxes[0];
        Object.assign(this.box, {
            x: first.x - grow,
            y: first.y - grow,
            width: first.width + grow * 2,
            height: first.height + grow * 2,
        });
        this.draw();
        this.timeline = gsap
            .timeline()
            .to(this.DOM.layer, {autoAlpha: 1, duration: settings.appear, ease: 'power1.out'}, 0)
            .to(
                this.box,
                {...this.fit(0), duration: settings.appear, ease: 'power2.out', onUpdate: () => this.draw()},
                0,
            );

        // Then reads the text, a word at a time
        let time = settings.appear;
        this.words.forEach(({chars}, index) => {
            // it glides on to the next word, stretching or shrinking to fit it
            if (index > 0) {
                this.timeline.to(
                    this.box,
                    {
                        ...this.fit(index),
                        duration: move,
                        ease: 'power2.inOut',
                        onStart: () => (this.reading = index),
                        onUpdate: () => this.draw(),
                    },
                    time,
                );
                time += move;
            }
            // as it lands, the word's letters appear quickly from left to right
            this.timeline.to(chars, {opacity: 1, duration: reveal, stagger, ease: 'power1.out'}, time);
            // and it stays as long as the word takes to say
            time += word + letter * chars.length;
        });

        // After the last word, the box fades
        this.timeline.to(this.DOM.layer, {autoAlpha: 0, duration: settings.fade, ease: 'power1.inOut'}, time);
    }

    reset() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {clearProps: 'opacity'});
        gsap.set(this.DOM.layer, {autoAlpha: 0});
        this.reading = 0;
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {opacity: 1});
        gsap.set(this.DOM.layer, {autoAlpha: 0});
    }
}
