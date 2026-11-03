// 03 Telegram. Each line first shows only its content words, packed together
// with single spaces like a telegram: "09:30 tide out boats". As soon as
// they are in, the line opens out: the content words slide apart to where
// they belong while the small words rise into the gaps, and the punctuation
// drops in last. The lines follow one another, each opening while the next
// is still coming in.

// The small words a telegram leaves out, compared lowercase
const SMALL_WORDS = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'of',
    'to',
    'in',
    'on',
    'at',
    'by',
    'for',
    'as',
    'if',
    'is',
    'are',
    'was',
    'were',
    'be',
    'it',
    'its',
    'they',
    'their',
    'them',
    'with',
    'from',
    'into',
    'onto',
    'so',
    'no',
    'not',
    'that',
    'this',
    'then',
]);

// Punctuation at the end of a word, held back until last
const PUNCTUATION = /^[.,;:!?]$/;

const settings = {
    // seconds between two letters of a word, two words of a line and two lines, as the telegram comes in
    letter: 0.015,
    word: 0.09,
    line: 0.3,
    // seconds a content word's letters take to come in
    enter: 0.35,
    // seconds after its last content word starts coming in that a line opens out
    open: 0.12,
    // seconds the content words take to slide apart, and between one word and the next
    slide: 0.65,
    slideStagger: 0.025,
    // seconds into the slide when the small words' letters start rising, and between two letters
    rise: 0.15,
    riseStagger: 0.015,
    // seconds after the small words start that the line's punctuation drops in, and between two marks
    punctuate: 0.3,
    drop: 0.1,
    // seconds a small word's letter or a punctuation mark takes to land
    land: 0.45,
};

// A word's letters, the punctuation at its end, and whether a telegram leaves it out
const createWord = el => {
    const chars = [...el.querySelectorAll('.char')];
    let end = chars.length;
    while (end > 0 && PUNCTUATION.test(chars[end - 1].textContent)) end--;
    const letters = chars.slice(0, end);
    const punctuation = chars.slice(end);
    const isSmall = SMALL_WORDS.has(
        letters
            .map(char => char.textContent)
            .join('')
            .toLowerCase(),
    );

    el.classList.toggle('word--small', isSmall);
    punctuation.forEach(char => char.classList.add('char--punctuation'));
    return {el, letters, punctuation, isSmall};
};

export class Telegram {
    DOM = {
        // the element holding the lines
        el: null,
    };
    // each line's element and its words, in reading order
    lines = [];
    // every character, in reading order
    chars = [];
    // the position in its line of the content word each content letter belongs to
    wordOrder = new Map();
    timeline = null;
    // the lines' content words sliding apart, each measured as its line opens
    slides = [];

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'telegram';
        this.DOM.el = el;
        this.lines = [...el.querySelectorAll('[data-line]')].map(lineEl => {
            const split = SplitText.create(lineEl, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            lineEl.classList.add('is-ready');
            this.chars.push(...split.chars);
            const words = split.words.map(createWord);
            words
                .filter(word => !word.isSmall)
                .forEach((word, index) => {
                    word.letters.forEach(letter => this.wordOrder.set(letter, index));
                });
            return {el: lineEl, words};
        });

        this.reset();
    }

    // Nothing to measure ahead: the slide measures the words as it starts
    refresh() {}

    play() {
        this.reset();
        this.timeline = gsap.timeline();

        this.lines.forEach((line, lineIndex) => {
            const start = lineIndex * settings.line;
            const content = line.words.filter(word => !word.isSmall && word.letters.length);
            const small = line.words.filter(word => word.isSmall).flatMap(word => word.letters);
            const punctuation = line.words.flatMap(word => word.punctuation);

            // The telegram: the line's content words come in letter by letter,
            // word by word, closed up over the small words and the punctuation
            line.el.classList.add('is-packed');
            content.forEach((word, wordIndex) => {
                this.timeline.fromTo(
                    word.letters,
                    {opacity: 0, yPercent: 40},
                    {
                        opacity: 1,
                        yPercent: 0,
                        duration: settings.enter,
                        ease: 'expo.out',
                        stagger: settings.letter,
                    },
                    start + wordIndex * settings.word,
                );
            });

            // The line opens out as its last content word comes in: the content
            // words slide apart, and the small words' letters rise into the gaps
            const open = start + Math.max(0, content.length - 1) * settings.word + settings.open;
            this.timeline.call(() => this.unpack(line), null, open);
            if (small.length) {
                this.timeline.fromTo(
                    small,
                    {opacity: 0, yPercent: 40},
                    {
                        opacity: 1,
                        yPercent: 0,
                        duration: settings.land,
                        ease: 'power3.out',
                        stagger: settings.riseStagger,
                    },
                    open + settings.rise,
                );
            }

            // Its punctuation drops in last, mark after mark
            if (punctuation.length) {
                this.timeline.fromTo(
                    punctuation,
                    {opacity: 0, yPercent: -60},
                    {
                        opacity: 1,
                        yPercent: 0,
                        duration: settings.land,
                        ease: 'power3.out',
                        stagger: settings.drop,
                    },
                    open + settings.rise + settings.punctuate,
                );
            }
        });
    }

    // A line's small words and punctuation take their places again, still
    // unseen, and its content words slide apart from the telegram to make room.
    // The slide moves the letters sideways (x, and y if a word changes row),
    // apart from the rise they may still be finishing (yPercent), so the two
    // never fight over the same property.
    unpack(line) {
        const letters = line.words.filter(word => !word.isSmall).flatMap(word => word.letters);
        const measure = () =>
            letters.map(letter => ({
                x: letter.getBoundingClientRect().left - gsap.getProperty(letter, 'x'),
                y: letter.parentElement.getBoundingClientRect().top,
            }));
        const before = measure();
        line.el.classList.remove('is-packed');
        const after = measure();

        const slide = gsap.timeline();
        letters.forEach((letter, i) => {
            slide.fromTo(
                letter,
                {x: before[i].x - after[i].x, y: before[i].y - after[i].y},
                {
                    x: 0,
                    y: 0,
                    duration: settings.slide,
                    ease: 'power3.inOut',
                },
                this.wordOrder.get(letter) * settings.slideStagger,
            );
        });
        this.slides.push(slide);
    }

    reset() {
        this.timeline?.kill();
        this.slides.forEach(slide => slide.kill());
        this.slides = [];
        this.lines.forEach(line => line.el.classList.remove('is-packed'));
        gsap.set(this.chars, {clearProps: 'transform,opacity'});
    }

    // The whole text at once, for reduced motion
    show() {
        this.reset();
        gsap.set(this.chars, {opacity: 1});
    }
}
