// 10 Find All. The text is found rather than typed, one character at a time,
// the way an editor highlights every match of a search: every place the
// character occurs lights up at once, quickly in reading order, and the
// character stays as its highlight fades. The most common characters in the
// text are searched for first, so it fills in from scattered e's and t's,
// faster and faster, until the rare ones complete it.

// The letters of English, most common first, to settle ties
const ORDER = 'etaoinshrdlucmfwypvbgkjqxz';

const settings = {
    // seconds between two searches, at the start and, quicker, at the end;
    // slower on big text, which has fewer characters to find; in between for
    // sizes in between (px)
    small: {size: 20, first: 0.12, last: 0.04},
    big: {size: 80, first: 0.22, last: 0.1},
    // seconds between two matches of one search lighting up, in reading order
    scan: 0.006,
    // seconds a match stays highlighted before its highlight fades
    hold: 0.08,
};

export class FindAll {
    DOM = {
        // the element holding the lines
        el: null,
        // every character of the text, line after line
        chars: [],
    };
    // the searches: each character the text holds, with every place it
    // occurs, most common first
    searches = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'find-all';
        this.DOM.el = el;

        el.querySelectorAll('[data-line]').forEach(line => {
            this.DOM.chars.push(
                ...SplitText.create(line, {
                    type: 'words, chars',
                    wordsClass: 'word',
                    charsClass: 'char',
                }).chars,
            );
            line.classList.add('is-ready');
        });

        // Every place each character occurs, capitals with their small letters
        const matches = new Map();
        this.DOM.chars.forEach(char => {
            const key = char.textContent.toLowerCase();
            if (!matches.has(key)) matches.set(key, []);
            matches.get(key).push(char);
        });
        // the most common first; on a tie, the more common letter of English,
        // then letters before other characters
        const rank = key => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
        this.searches = [...matches.values()].sort((a, b) => {
            return b.length - a.length || rank(a[0].textContent.toLowerCase()) - rank(b[0].textContent.toLowerCase());
        });

        this.reset();
    }

    play() {
        this.reset();
        this.timeline = gsap.timeline();

        // the searches' pace for the text's size
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        const {small, big} = settings;
        const pace = key =>
            gsap.utils.mapRange(small.size, big.size, small[key], big[key], gsap.utils.clamp(small.size, big.size, em));
        const first = pace('first');
        const last = pace('last');

        let time = 0;
        this.searches.forEach((chars, index) => {
            // every match of the search lights up, quickly in reading order
            chars.forEach((char, order) => {
                const at = time + order * settings.scan;
                this.timeline
                    .call(
                        () => {
                            char.style.opacity = 1;
                            char.classList.add('is-match');
                        },
                        null,
                        at,
                    )
                    .call(() => char.classList.remove('is-match'), null, at + settings.hold);
            });
            // and the next search comes a little sooner than this one did
            const share = this.searches.length > 1 ? index / (this.searches.length - 1) : 1;
            time += first + (last - first) * share;
        });
    }

    reset() {
        this.timeline?.kill();
        this.DOM.chars.forEach(char => {
            char.classList.remove('is-match');
            char.style.opacity = '';
        });
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        this.DOM.chars.forEach(char => {
            char.classList.remove('is-match');
            char.style.opacity = 1;
        });
    }

    // Nothing to measure
    refresh() {}
}
