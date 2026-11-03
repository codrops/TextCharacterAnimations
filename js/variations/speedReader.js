// 14 Speed Reader. The words flash one at a time at a fixed point just right
// of the text, the way speed-reading apps show a text, with one letter of each
// word marked in the accent so the eye never has to move: every word is
// placed so that its marked letter falls on the same spot, however long the
// word is. A word holds there for a blink, then flies left along its row into
// its place as the next one flashes in, its marked letter fading to the text
// colour as it lands. Lines start one after another from the top and build up
// at the same time, each at the reading point on its own row.

const settings = {
    // seconds a word holds at the reading point, plus seconds per letter, and
    // seconds it takes to fly into its place: quicker on small text, slower on
    // big text, where the words fly further; in between for sizes in between (px)
    small: {size: 20, hold: 0.06, letter: 0.014, fly: 0.4},
    big: {size: 80, hold: 0.15, letter: 0.033, fly: 0.5},
    // seconds between the starts of two lines
    line: 0.3,
    // how far past the right end of the longest row the reading point sits, in em
    gap: 1,
};

// A letter or a digit; punctuation doesn't count towards a word's length
const LETTER = /[\p{L}\p{N}]/u;

// Which of a word's letters is marked, by how many it has: the first of a
// one-letter word, the second up to five letters, the third up to nine, the
// fourth up to thirteen and the fifth after that. It's the letter the eye
// recognises a word by, a little left of its middle.
const markAt = length => (length < 2 ? 0 : length < 6 ? 1 : length < 10 ? 2 : length < 14 ? 3 : 4);

export class SpeedReader {
    DOM = {
        // the element holding the lines
        el: null,
    };
    // each word: its element, the line it's on, how many letters it has, its
    // marked letter, and how far it sits from its place while it's at the
    // reading point, measured when the text plays
    words = [];
    // the text's size, and the colour a marked letter fades to as its word lands
    em = 0;
    color = '';
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'speed-reader';
        this.DOM.el = el;

        el.querySelectorAll('[data-line]').forEach((line, lineIndex) => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => {
                const chars = split.chars.filter(char => wordEl.contains(char));
                // a word made only of punctuation counts all its characters
                const letters = chars.filter(char => LETTER.test(char.textContent));
                const counted = letters.length ? letters : chars;
                const mark = counted[markAt(counted.length)];
                mark.classList.add('char--mark');
                this.words.push({el: wordEl, line: lineIndex, letters: counted.length, mark, offset: 0});
            });
            line.classList.add('is-ready');
        });

        this.reset();
    }

    // Finds the reading point, a little past the longest row (or in just enough
    // for every word to fit on a narrow screen), and how far each word moves
    // sideways from its place for its marked letter to sit on it
    measure() {
        const style = getComputedStyle(this.DOM.el);
        this.em = parseFloat(style.fontSize);
        this.color = style.color;

        const places = this.words.map(word => {
            const x = gsap.getProperty(word.el, 'x');
            const mark = word.mark.getBoundingClientRect();
            return {
                right: word.el.getBoundingClientRect().right - x,
                mark: mark.left + mark.width / 2 - x,
            };
        });
        // as far right as a word at the point may reach: the screen's edge, less
        // the room the text has on its left, or an em if that's more
        const box = this.DOM.el.getBoundingClientRect();
        const edge = document.documentElement.clientWidth - Math.min(box.left, this.em);
        const reach = Math.max(...places.map(place => place.right - place.mark));
        const point = Math.min(Math.max(...places.map(place => place.right)) + settings.gap * this.em, edge - reach);
        this.words.forEach((word, index) => (word.offset = point - places[index].mark));
    }

    // Measures again after a resize, for the words still to come; the words
    // already out finish with the values they set off with
    refresh() {
        if (!this.timeline?.isActive()) return;
        this.measure();
    }

    play() {
        this.reset();
        this.measure();

        // the pace for the text's size
        const {small, big} = settings;
        const pace = key =>
            gsap.utils.mapRange(
                small.size,
                big.size,
                small[key],
                big[key],
                gsap.utils.clamp(small.size, big.size, this.em),
            );
        const [hold, letter, fly] = ['hold', 'letter', 'fly'].map(pace);

        this.timeline = gsap.timeline();
        let time = 0;
        let line = -1;
        this.words.forEach(word => {
            // each line starts a moment after the one above
            if (word.line !== line) {
                line = word.line;
                time = line * settings.line;
            }
            const leave = time + hold + word.letters * letter;

            this.timeline
                // The word flashes at the reading point, its marked letter on it
                .set(word.el, {x: () => word.offset, opacity: 1}, time)
                // and holds for a blink, longer for a longer word, then flies
                // left into its place
                .to(word.el, {x: 0, duration: fly, ease: 'expo.out'}, leave)
                // as its marked letter fades from the accent to the text colour
                .to(
                    word.mark,
                    {
                        color: () => this.color,
                        duration: fly,
                        ease: 'power1.out',
                        clearProps: 'color',
                        onComplete: () => word.el.classList.add('is-placed'),
                    },
                    leave,
                );

            // the next word flashes in as this one leaves
            time = leave;
        });
    }

    reset() {
        this.timeline?.kill();
        this.words.forEach(word => word.el.classList.remove('is-placed'));
        gsap.set(
            this.words.map(word => word.el),
            {clearProps: 'transform,opacity'},
        );
        gsap.set(
            this.words.map(word => word.mark),
            {clearProps: 'color'},
        );
    }

    // The whole text at once, for reduced motion
    show() {
        this.reset();
        this.words.forEach(word => word.el.classList.add('is-placed'));
        gsap.set(
            this.words.map(word => word.el),
            {opacity: 1},
        );
    }
}
