// 07 Multi-cursor. A caret lands at the start of every word, one word after
// another in reading order, quickly, the way a code editor adds a caret with
// each click. Every caret starts typing its own word as soon as it lands, and
// they all type on the same keystrokes, at a human, uneven pace, so letters
// appear in many places at once. A caret that finishes its word fades; the
// last one blinks twice first.

const settings = {
    // seconds before the first caret lands
    lead: 0.15,
    // seconds between two carets landing
    land: 0.035,
    // seconds a caret takes to grow to its full height as it lands
    grow: 0.15,
    // seconds between two keystrokes, on average
    key: 0.065,
    // how much a keystroke can come early or late, as a share of that
    jitter: 0.35,
    // seconds a caret waits at the end of its word, then takes to fade
    hold: 0.08,
    fade: 0.25,
    // seconds the last caret is off, then on, as it blinks at the end
    blink: 0.16,
    // blinks at the end
    blinks: 2,
};

// Where a caret sits: before or after a character, by its index among all
// the characters of the text
const before = index => index * 2;
const after = index => index * 2 + 1;

export class MultiCursor {
    DOM = {
        // the element holding the lines
        el: null,
        // every character of the text, line after line
        chars: [],
        // the layer over the text holding the carets
        layer: null,
    };
    // each word of the text: the index of its first character, how many it
    // has, and its caret, with the bar that grows as it lands and its spot
    words = [];
    // where a caret can sit, before and after each character, relative to
    // the text; measured when the text plays
    spots = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'multi-cursor';
        this.DOM.el = el;

        this.DOM.layer = document.createElement('div');
        this.DOM.layer.className = 'cursors';
        this.DOM.layer.setAttribute('aria-hidden', 'true');

        el.querySelectorAll('[data-line]').forEach(line => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => {
                const chars = split.chars.filter(char => wordEl.contains(char));
                const cursor = document.createElement('span');
                cursor.className = 'cursor';
                const bar = document.createElement('span');
                bar.className = 'cursor__bar';
                cursor.append(bar);
                this.DOM.layer.append(cursor);
                const start = this.DOM.chars.length;
                this.words.push({start, count: chars.length, cursor, bar, spot: before(start)});
                this.DOM.chars.push(...chars);
            });
            line.classList.add('is-ready');
        });

        el.append(this.DOM.layer);
        this.reset();
    }

    // Measures where a caret can sit, before and after each character
    measure() {
        const textRect = this.DOM.el.getBoundingClientRect();
        this.spots = this.DOM.chars.flatMap(char => {
            const rect = char.getBoundingClientRect();
            const y = rect.top - textRect.top;
            return [
                {x: rect.left - textRect.left, y},
                {x: rect.right - textRect.left, y},
            ];
        });
    }

    // Puts a word's caret at one of its spots
    place(word, spot) {
        const {x, y} = this.spots[spot] ?? {x: 0, y: 0};
        word.spot = spot;
        gsap.set(word.cursor, {x, y});
    }

    // Measures again after a resize and moves the carets to match
    refresh() {
        this.measure();
        this.words.forEach(word => this.place(word, word.spot));
    }

    play() {
        this.reset();
        this.measure();
        this.words.forEach(word => this.place(word, before(word.start)));
        this.timeline = gsap.timeline();

        // The keystrokes, unevenly spaced, made as they're needed
        const vary = gsap.utils.random(1 - settings.jitter, 1 + settings.jitter, true);
        const keys = [];
        let clock = settings.lead;
        const keyAt = index => {
            while (keys.length <= index) {
                clock += settings.key * vary();
                keys.push(clock);
            }
            return keys[index];
        };
        // the first keystroke after a time
        const firstKeyAfter = time => {
            let index = 0;
            while (keyAt(index) < time) index++;
            return index;
        };

        // when each word's last letter is typed
        const ends = this.words.map((word, wordIndex) => {
            // The caret lands, growing up from the baseline
            const land = settings.lead + wordIndex * settings.land;
            this.timeline
                .set(word.cursor, {autoAlpha: 1}, land)
                .fromTo(word.bar, {scaleY: 0}, {scaleY: 1, duration: settings.grow, ease: 'expo.out'}, land);

            // and types its word on the keystrokes that follow
            const first = firstKeyAfter(land + settings.grow * 0.5);
            for (let i = 0; i < word.count; i++) {
                const index = word.start + i;
                const time = keyAt(first + i);
                this.timeline
                    .set(this.DOM.chars[index], {opacity: 1}, time)
                    .call(() => this.place(word, after(index)), null, time);
            }
            return keyAt(first + word.count - 1);
        });

        // Each caret fades once its word is typed; the last one blinks twice first
        const end = Math.max(...ends);
        this.words.forEach((word, wordIndex) => {
            if (ends[wordIndex] < end) {
                this.timeline.to(
                    word.cursor,
                    {autoAlpha: 0, duration: settings.fade, ease: 'power1.out'},
                    ends[wordIndex] + settings.hold,
                );
                return;
            }
            for (let i = 0; i < settings.blinks; i++) {
                this.timeline
                    .set(word.cursor, {opacity: 0}, end + settings.blink * (2 * i + 1))
                    .set(word.cursor, {opacity: 1}, end + settings.blink * (2 * i + 2));
            }
            this.timeline.set(word.cursor, {autoAlpha: 0}, end + settings.blink * (2 * settings.blinks + 1));
        });
    }

    reset() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {clearProps: 'opacity'});
        this.words.forEach(word => {
            gsap.set(word.cursor, {autoAlpha: 0});
            gsap.set(word.bar, {scaleY: 0});
            word.spot = before(word.start);
        });
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {opacity: 1});
        gsap.set(
            this.words.map(word => word.cursor),
            {autoAlpha: 0},
        );
    }
}
