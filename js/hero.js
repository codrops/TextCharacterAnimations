// The hero: one big word whose letters slide up into view one after another,
// out of a mask. Then the letters it doesn't share with a second word slide
// up and away while the new ones slide up in their place, once: tide, then
// time. It's decoration, so screen readers skip it.

// The two words, which start the same way
const WORDS = ['tide', 'time'];

const settings = {
    // seconds before the first letter
    lead: 0.15,
    // seconds a letter takes to slide in, and seconds between two letters
    reveal: 1.1,
    stagger: 0.07,
    // seconds the first word stands before its ending changes
    hold: 0.5,
    // seconds a letter of the old ending takes to slide away
    leave: 0.6,
    // the most of the screen's height the word may take
    maxHeight: 0.55,
    // how far below and above the mask the letters wait and leave, in percent of their height
    travel: 150,
};

// How many letters two words share at their start
const getSharedStart = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
};

// A letter in its own place, ready to slide
const createLetter = letter => {
    const span = document.createElement('span');
    span.className = 'hero__letter';
    span.textContent = letter;
    return span;
};

export class Hero {
    DOM = {
        // the hero element
        el: null,
        // the word: the shared start, then both endings stacked in one place
        word: null,
        // the letters of the shared start, of the first ending and of the second
        start: [],
        from: [],
        to: [],
    };
    timeline = null;

    constructor(el, {reducedMotion = false} = {}) {
        this.DOM.el = el;
        this.DOM.word = el.querySelector('.hero__word');
        this.build();
        this.fit();
        window.addEventListener('resize', () => this.fit());

        // With reduced motion the second word just stands there
        if (reducedMotion) {
            gsap.set([...this.DOM.start, ...this.DOM.to], {yPercent: 0});
            gsap.set(this.DOM.from, {autoAlpha: 0});
            return;
        }

        this.play();
    }

    // The word's letters: the shared start, then the two endings in one grid
    // cell, so the word takes the room of the longer one and nothing shifts
    build() {
        const shared = getSharedStart(WORDS[0], WORDS[1]);
        this.DOM.start = [...WORDS[0].slice(0, shared)].map(createLetter);
        this.DOM.from = [...WORDS[0].slice(shared)].map(createLetter);
        this.DOM.to = [...WORDS[1].slice(shared)].map(createLetter);

        const ending = document.createElement('span');
        ending.className = 'hero__ending';
        const from = document.createElement('span');
        const to = document.createElement('span');
        from.append(...this.DOM.from);
        to.append(...this.DOM.to);
        ending.append(from, to);
        this.DOM.word.append(...this.DOM.start, ending);

        // every letter waits below the mask
        gsap.set([...this.DOM.start, ...this.DOM.from, ...this.DOM.to], {yPercent: settings.travel});
    }

    // Sets the type size so the longer word fills the hero's width, without
    // the word taking more than part of the screen's height
    fit() {
        const probe = document.createElement('span');
        probe.className = 'hero__probe';
        this.DOM.el.append(probe);
        const widths = WORDS.map(word => {
            probe.textContent = word;
            return probe.getBoundingClientRect().width;
        });
        probe.remove();
        // measured at 100px, with 2px to spare so the word never touches the edge
        const byWidth = (100 * this.DOM.el.clientWidth) / (Math.max(...widths) + 2);
        // the word stands about 0.75 of its font size tall
        const byHeight = (window.innerHeight * settings.maxHeight) / 0.75;
        this.DOM.el.style.fontSize = `${Math.min(byWidth, byHeight)}px`;
        this.DOM.el.classList.add('is-fitted');
    }

    play() {
        const reveal = {yPercent: 0, duration: settings.reveal, ease: 'expo.out', stagger: settings.stagger};
        const first = [...this.DOM.start, ...this.DOM.from];
        // once the first word has risen far enough to read, and held a moment
        const changeAt = settings.lead + (first.length - 1) * settings.stagger + settings.reveal * 0.5 + settings.hold;

        this.timeline = gsap
            .timeline()
            // the first word rises letter by letter
            .to(first, reveal, settings.lead)
            // its ending slides up and away as the new one rises in its place
            .to(
                this.DOM.from,
                {yPercent: -settings.travel, duration: settings.leave, ease: 'power3.in', stagger: settings.stagger},
                changeAt,
            )
            .to(this.DOM.to, reveal, changeAt + settings.leave * 0.55);
    }
}
