// 12 Live Captions. The text comes in the way live captions do on television,
// typed by a captioner a breath behind the speaker: a word or two at a time,
// each burst landing almost at once, letter by letter in a blink, then a
// pause. The lines roll up: each new row is written in the text's bottom row
// and the rows above move up one to make room, until the last row is written
// and every row sits in its place.

const settings = {
    // seconds per letter within a burst, the shortest and longest pause
    // between bursts, and the most words in one burst: quicker and in longer
    // bursts on small text, slower and a word at a time on big text; in
    // between for sizes in between (px)
    small: {size: 20, letter: 0.01, gap: [0.04, 0.1], burst: 3},
    big: {size: 80, letter: 0.045, gap: [0.3, 0.45], burst: 1},
    // seconds the rows take to roll up one row
    roll: 0.22,
};

export class LiveCaptions {
    DOM = {
        // the element holding the lines
        el: null,
        // its lines, and every character of the text, line after line
        lines: [],
        chars: [],
    };
    // each word: its characters
    words = [];
    // the rows of text as laid out, each with its words and how far below
    // the top its characters sit; measured when the text plays
    rows = [];
    // the row being written
    row = 0;
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'live-captions';
        this.DOM.el = el;
        this.DOM.lines = [...el.querySelectorAll('[data-line]')];

        this.DOM.lines.forEach(line => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => this.words.push(split.chars.filter(char => wordEl.contains(char))));
            this.DOM.chars.push(...split.chars);
            line.classList.add('is-ready');
        });

        this.reset();
    }

    // Groups the words into rows as the text lays them out, at their places
    measure() {
        gsap.set(this.DOM.lines, {y: 0});
        const box = this.DOM.el.getBoundingClientRect();
        this.rows = [];
        this.words.forEach(word => {
            const top = word[0].getBoundingClientRect().top - box.top;
            let row = this.rows[this.rows.length - 1];
            if (!row || Math.abs(top - row.top) > 1) {
                row = {top, words: []};
                this.rows.push(row);
            }
            row.words.push(word);
        });
    }

    // How far down the text sits while a row is written, so that row is in the bottom row
    offset(row) {
        const last = this.rows[this.rows.length - 1];
        return last && this.rows[row] ? last.top - this.rows[row].top : 0;
    }

    // Measures again after a resize and keeps the row being written at the bottom
    refresh() {
        if (!this.timeline?.isActive()) return;
        this.measure();
        gsap.set(this.DOM.lines, {y: this.offset(this.row)});
    }

    play() {
        this.reset();
        this.measure();
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        const {small, big} = settings;
        const share = gsap.utils.mapRange(small.size, big.size, 0, 1, gsap.utils.clamp(small.size, big.size, em));
        const letter = small.letter + (big.letter - small.letter) * share;
        const gap = [0, 1].map(i => small.gap[i] + (big.gap[i] - small.gap[i]) * share);
        const burst = Math.round(small.burst + (big.burst - small.burst) * share);

        // the first row is written in the bottom row
        this.row = 0;
        gsap.set(this.DOM.lines, {y: this.offset(0)});
        this.timeline = gsap.timeline();

        let time = 0;
        this.rows.forEach((row, rowIndex) => {
            // the rows roll up one to make room for the next
            if (rowIndex > 0) {
                this.timeline.to(
                    this.DOM.lines,
                    {
                        y: () => this.offset(rowIndex),
                        duration: settings.roll,
                        ease: 'power2.inOut',
                        onStart: () => (this.row = rowIndex),
                    },
                    time,
                );
                time += settings.roll * 0.6;
            }

            // a word or few at a time, each burst landing letter by letter in a blink
            let index = 0;
            while (index < row.words.length) {
                const count = gsap.utils.random(1, burst, 1);
                const chars = row.words.slice(index, index + count).flat();
                index += count;
                chars.forEach((char, i) => {
                    this.timeline.set(char, {opacity: 1}, time + i * letter);
                });
                time += chars.length * letter + gsap.utils.random(gap[0], gap[1]);
            }
        });
    }

    reset() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {clearProps: 'opacity'});
        gsap.set(this.DOM.lines, {clearProps: 'transform'});
        this.row = 0;
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {opacity: 1});
        gsap.set(this.DOM.lines, {clearProps: 'transform'});
    }
}
