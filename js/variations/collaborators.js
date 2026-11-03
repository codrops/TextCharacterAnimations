// 11 Collaborators. Three people write the text together, at once, as in a
// shared document. Each has a caret in their own colour with a small flag on
// top, and takes different lines: the first, fourth and so on for the first
// person, the second and fifth for the next. A single line is split between
// them at its words. Each types at their own uneven pace, with the odd pause
// between words; their fresh letters show in their colour and fade to the
// text's. When someone finishes a line, their caret glides over to the next
// one they're writing. Once they're done, their caret blinks and goes.

const settings = {
    // the people writing: when each starts, how fast they type, as a share of
    // the pace, and their colour unless --color-person-1, -2, -3 sets it
    people: [
        {start: 0, speed: 1, color: '#ff5d8f'},
        {start: 0.12, speed: 1.15, color: '#4aa3ff'},
        {start: 0.24, speed: 0.9, color: '#ffb020'},
    ],
    // seconds per letter, quicker on small text and slower on big text; in
    // between for sizes in between (px)
    small: {size: 20, letter: 0.026},
    big: {size: 80, letter: 0.075},
    // how much a key can come early or late, as a share of a letter's time
    jitter: 0.35,
    // the longest pause between two words, in letters
    pause: 2,
    // seconds a caret takes to glide to its next line
    move: 0.4,
    // seconds a fresh letter keeps its writer's colour before fading
    fresh: 0.12,
    // seconds a caret is off, then on, as it blinks once done, and takes to go
    blink: 0.16,
    fade: 0.25,
};

// Where a caret sits: before or after a character, by its index among all
// the characters of the text
const before = index => index * 2;
const after = index => index * 2 + 1;

export class Collaborators {
    DOM = {
        // the element holding the lines
        el: null,
        // every character of the text, line after line
        chars: [],
        // the layer over the text holding the carets
        layer: null,
    };
    // the stretches of text one person writes in one go: the index of their
    // first character, how many there are, and where words end among them
    runs = [];
    // the people writing: their caret, and the runs they write in order
    people = [];
    // where a caret can sit, before and after each character, relative to
    // the text; measured when the text plays
    spots = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'collaborators';
        this.DOM.el = el;
        this.fitCarets();

        // Each line, split into words and characters
        const lines = [...el.querySelectorAll('[data-line]')].map(line => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            line.classList.add('is-ready');
            const start = this.DOM.chars.length;
            const words = split.words.map(wordEl => split.chars.filter(char => wordEl.contains(char)).length);
            this.DOM.chars.push(...split.chars);
            return {start, words};
        });

        // One run per line; with fewer lines than people, the lines are split at their words
        const count = settings.people.length;
        lines.forEach(line => {
            const parts = lines.length >= count ? 1 : Math.min(line.words.length, Math.ceil(count / lines.length));
            const total = line.words.reduce((sum, length) => sum + length, 0);
            let start = line.start;
            let words = [];
            line.words.forEach((length, index) => {
                words.push(length);
                const written = start - line.start + words.reduce((sum, n) => sum + n, 0);
                const isLast = index === line.words.length - 1;
                if (isLast || written >= (total * (this.runs.filter(run => run.line === line).length + 1)) / parts) {
                    this.runs.push({line, start, words});
                    start += words.reduce((sum, n) => sum + n, 0);
                    words = [];
                }
            });
        });

        // The people, each with a caret, taking the runs in turn
        this.DOM.layer = document.createElement('div');
        this.DOM.layer.className = 'collabs';
        this.DOM.layer.setAttribute('aria-hidden', 'true');
        this.people = settings.people
            .map((person, index) => {
                const caret = document.createElement('span');
                caret.className = 'collab';
                caret.style.setProperty('--person', `var(--color-person-${index + 1}, ${person.color})`);
                caret.innerHTML = '<span class="collab__bar"><span class="collab__flag"></span></span>';
                this.DOM.layer.append(caret);
                return {
                    ...person,
                    index,
                    caret,
                    runs: this.runs.filter((run, runIndex) => runIndex % count === index),
                    spot: 0,
                };
            })
            .filter(person => person.runs.length);
        el.append(this.DOM.layer);

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

    // Measures where a caret can sit, before and after each character
    measure() {
        const box = this.DOM.el.getBoundingClientRect();
        this.spots = this.DOM.chars.flatMap(char => {
            const rect = char.getBoundingClientRect();
            const y = rect.top - box.top;
            return [
                {x: rect.left - box.left, y},
                {x: rect.right - box.left, y},
            ];
        });
    }

    // Puts a person's caret at one of its spots
    place(person, spot) {
        const {x, y} = this.spots[spot] ?? {x: 0, y: 0};
        person.spot = spot;
        gsap.set(person.caret, {x, y});
    }

    // Measures again after a resize and moves the carets to match
    refresh() {
        this.measure();
        this.people.forEach(person => this.place(person, person.spot));
    }

    play() {
        this.reset();
        this.measure();
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        const {small, big} = settings;
        const letter = gsap.utils.mapRange(
            small.size,
            big.size,
            small.letter,
            big.letter,
            gsap.utils.clamp(small.size, big.size, em),
        );
        const vary = gsap.utils.random(1 - settings.jitter, 1 + settings.jitter, true);
        this.timeline = gsap.timeline();

        this.people.forEach(person => {
            const key = letter / person.speed;
            let time = person.start;
            this.place(person, before(person.runs[0].start));
            this.timeline.set(person.caret, {autoAlpha: 1}, time);

            person.runs.forEach((run, runIndex) => {
                // the caret glides to the start of its next run
                if (runIndex > 0) {
                    const spot = before(run.start);
                    this.timeline.to(
                        person.caret,
                        {
                            x: () => this.spots[spot].x,
                            y: () => this.spots[spot].y,
                            duration: settings.move,
                            ease: 'power3.inOut',
                            onStart: () => (person.spot = spot),
                        },
                        time,
                    );
                    time += settings.move;
                }
                // and types it, word by word, with the odd pause between words
                let index = run.start;
                run.words.forEach((length, wordIndex) => {
                    if (wordIndex > 0) time += key * (1 + Math.random() * settings.pause);
                    for (let i = 0; i < length; i++, index++) {
                        const char = this.DOM.chars[index];
                        const spot = after(index);
                        time += key * vary();
                        this.timeline
                            .call(
                                () => {
                                    char.style.setProperty('--person', person.caret.style.getPropertyValue('--person'));
                                    char.style.opacity = 1;
                                    char.classList.add('is-fresh');
                                    this.place(person, spot);
                                },
                                null,
                                time,
                            )
                            .call(() => char.classList.remove('is-fresh'), null, time + settings.fresh);
                    }
                });
            });

            // done: the caret blinks once and goes
            this.timeline
                .set(person.caret, {opacity: 0}, time + settings.blink)
                .set(person.caret, {opacity: 1}, time + settings.blink * 2)
                .to(
                    person.caret,
                    {autoAlpha: 0, duration: settings.fade, ease: 'power1.inOut'},
                    time + settings.blink * 3,
                );
        });
    }

    reset() {
        this.timeline?.kill();
        this.DOM.chars.forEach(char => {
            char.classList.remove('is-fresh');
            char.style.opacity = '';
        });
        this.people.forEach(person => gsap.set(person.caret, {autoAlpha: 0}));
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        this.DOM.chars.forEach(char => {
            char.classList.remove('is-fresh');
            char.style.opacity = 1;
        });
        this.people.forEach(person => gsap.set(person.caret, {autoAlpha: 0}));
    }
}
