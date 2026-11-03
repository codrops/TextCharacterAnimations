// 05 Overtype. Typing in overwrite mode, with the Insert key on: the new hour
// is typed over the old one. The old lines wait in place, dimmer. In each
// line an underscore cursor types the new text; every new letter strikes
// down into place at full strength, and every old letter the cursor passes
// is knocked out, falling and tipping as it fades. Where the old line runs
// longer, the cursor carries on over the rest of it, deleting faster, then
// blinks twice and goes. Lines start one after another.

const settings = {
    // seconds per character typed, spaces included
    letter: 0.045,
    // seconds per old character deleted past the end of the new text
    erase: 0.018,
    // seconds from the cursor appearing to the first key
    lead: 0.2,
    // how far above its place a new letter strikes, in em, and the seconds it takes to drop in
    strike: 0.08,
    drop: 0.15,
    // how far a knocked out letter falls, in em, its largest tilt in degrees, and the seconds it takes
    fall: 1.3,
    tilt: 14,
    knock: 0.75,
    // seconds between the starts of two lines
    stagger: 0.3,
    // seconds the cursor is off, then on, as it blinks out
    blink: 0.25,
    // blinks at the end of a line
    blinks: 2,
};

const dropEase = gsap.parseEase('power2.out');
const knockEase = gsap.parseEase('power2.in');

// How far a move has got at a time: 0 before it starts, 1 once it is over, eased between
const getProgress = (time, start, duration, ease) => ease(gsap.utils.clamp(0, 1, (time - start) / duration));

// A tilt for a knocked out letter, to one side or the other
const getTilt = () => gsap.utils.random([-1, 1]) * gsap.utils.random(0.5, 1) * settings.tilt;

// The inline styles last written to each element, so a frame only writes what changed
const written = new WeakMap();

const setStyles = (el, styles) => {
    let last = written.get(el);
    if (!last) {
        last = {};
        written.set(el, last);
    }
    for (const [prop, value] of Object.entries(styles)) {
        if (last[prop] !== value) {
            el.style[prop] = value;
            last[prop] = value;
        }
    }
};

// One line: the new text, the old text under it, and the cursor typing one over the other
class Line {
    DOM = {
        // the line element
        el: null,
        // the new text's characters, in reading order
        chars: [],
        // the old text, in the same place, and its characters
        old: null,
        oldChars: [],
        // the cursor, moved from stop to stop
        cursor: null,
    };
    // seconds from the start of the play to the start of this line
    start = 0;
    // each old character's tilt as it falls
    tilts = [];
    // measured, in seconds from the start of the line: when each new
    // character is struck and each old one knocked out, and where the cursor
    // rests from each time on ({time, x, y}, x and y in px from the line's top left)
    strikes = [];
    knocks = [];
    stops = [];
    // when the cursor reaches its last stop, and when the line is over
    end = 0;
    duration = 0;
    // a new letter's strike and an old letter's fall, in px
    strikeHeight = 0;
    fallDepth = 0;

    constructor(el, start) {
        this.DOM.el = el;
        this.start = start;
        this.DOM.chars = SplitText.create(el, {
            type: 'words, chars',
            wordsClass: 'word',
            charsClass: 'char',
        }).chars;

        // The new text in a box of its own, so the old text can share its place
        const typed = document.createElement('span');
        typed.className = 'typed';
        typed.setAttribute('aria-hidden', 'true');
        typed.append(...el.childNodes);

        this.DOM.old = document.createElement('span');
        this.DOM.old.className = 'old';
        this.DOM.old.setAttribute('aria-hidden', 'true');
        this.DOM.old.textContent = el.dataset.from;

        this.DOM.cursor = document.createElement('span');
        this.DOM.cursor.className = 'cursor';
        this.DOM.cursor.setAttribute('aria-hidden', 'true');
        const underscore = document.createElement('span');
        underscore.className = 'cursor__underscore';
        this.DOM.cursor.append(underscore);

        // The old text comes first, so the new letters strike over it
        el.append(this.DOM.old, typed, this.DOM.cursor);
        this.DOM.oldChars = SplitText.create(this.DOM.old, {
            type: 'words, chars',
            wordsClass: 'word',
            charsClass: 'char',
        }).chars;
        this.tilts = this.DOM.oldChars.map(getTilt);

        el.classList.add('is-ready');
        this.measure();
    }

    // Measures both texts at rest and works out the typing from them
    measure() {
        const {el, chars, oldChars} = this.DOM;
        [...chars, ...oldChars].forEach(char => setStyles(char, {transform: ''}));

        const box = el.getBoundingClientRect();
        const rowHeight = chars[0].getBoundingClientRect().height;
        const em = parseFloat(getComputedStyle(el).fontSize);
        this.strikeHeight = settings.strike * em;
        this.fallDepth = settings.fall * em;

        // A character's left and right edges, top, and row
        const getPlace = char => {
            const rect = char.getBoundingClientRect();
            const top = rect.top - box.top;
            return {
                left: rect.left - box.left,
                right: rect.right - box.left,
                top,
                row: Math.round(top / rowHeight),
            };
        };
        const typed = chars.map(getPlace);
        const old = oldChars.map(getPlace);

        // The cursor starts before the first character
        const stops = [{time: 0, x: typed[0].left, y: typed[0].top, row: typed[0].row}];
        let time = settings.lead;

        // Typing: a key per character, and per space between two words on a row
        typed.forEach((place, i) => {
            const previous = typed[i - 1];
            if (previous && previous.row === place.row && chars[i].parentNode !== chars[i - 1].parentNode) {
                stops.push({time, x: place.left, y: place.top, row: place.row});
                time += settings.letter;
            }
            this.strikes[i] = time;
            stops.push({time, x: place.right, y: place.top, row: place.row});
            time += settings.letter;
        });

        // An old character is knocked out once the cursor has passed its left edge
        const keys = stops.slice(1);
        this.knocks = old.map(place => {
            const stop = keys.find(key => key.row > place.row || (key.row === place.row && key.x > place.left));
            return stop ? stop.time : null;
        });

        // Whatever is left of the old line, the cursor runs over on its own, faster
        old.forEach((place, i) => {
            if (this.knocks[i] !== null) return;
            this.knocks[i] = time;
            stops.push({time, x: place.right, y: place.top, row: place.row});
            time += settings.erase;
        });

        this.stops = stops;
        this.end = stops[stops.length - 1].time;
        this.duration = Math.max(
            this.end + settings.blink * (2 * settings.blinks + 1),
            Math.max(...this.knocks) + settings.knock,
            this.strikes[this.strikes.length - 1] + settings.drop,
        );
    }

    // Draws the line at a time, in seconds from the start of the play
    render(time) {
        const t = time - this.start;
        const {chars, oldChars, cursor} = this.DOM;

        // New characters: hidden until struck, then dropping the last hair into place
        chars.forEach((char, i) => {
            if (t < this.strikes[i]) {
                setStyles(char, {visibility: 'hidden', transform: ''});
                return;
            }
            const lift = this.strikeHeight * (1 - getProgress(t, this.strikes[i], settings.drop, dropEase));
            setStyles(char, {visibility: '', transform: lift ? `translateY(${-lift}px)` : ''});
        });

        // Old characters: in place until the cursor passes, then falling, tilting and fading
        oldChars.forEach((char, i) => {
            const fall = getProgress(t, this.knocks[i], settings.knock, knockEase);
            if (fall === 0) {
                setStyles(char, {visibility: '', opacity: '', transform: ''});
                return;
            }
            if (fall === 1) {
                setStyles(char, {visibility: 'hidden'});
                return;
            }
            setStyles(char, {
                visibility: '',
                opacity: 1 - fall,
                transform: `translateY(${this.fallDepth * fall}px) rotate(${this.tilts[i] * fall}deg)`,
            });
        });

        // The cursor: at its latest stop, then blinking out after the last one
        const blink = t < this.end ? 0 : Math.floor((t - this.end) / settings.blink);
        const isShown = t >= 0 && blink < 2 * settings.blinks + 1 && blink % 2 === 0;
        const stop = this.stops.findLast(({time: stopTime}) => stopTime <= t) ?? this.stops[0];
        setStyles(cursor, {
            visibility: isShown ? 'visible' : 'hidden',
            transform: `translate(${stop.x}px, ${stop.y}px)`,
        });
    }
}

export class Overtype {
    DOM = {
        // the element holding the lines
        el: null,
    };
    lines = [];
    // the time every line is drawn at, in seconds from the start of the play:
    // below zero before it, Infinity once it is over
    clock = {time: -1};
    tween = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'overtype';
        this.DOM.el = el;
        this.lines = [...el.querySelectorAll('[data-line]')].map(
            (lineEl, index) => new Line(lineEl, index * settings.stagger),
        );
        this.reset();
    }

    // Draws every line at the clock's time
    render() {
        this.lines.forEach(line => line.render(this.clock.time));
    }

    // Runs the clock from a time to the end of the play
    run(from) {
        this.tween?.kill();
        const end = Math.max(...this.lines.map(line => line.start + line.duration));
        this.tween = gsap.fromTo(
            this.clock,
            {time: from},
            {
                time: end,
                duration: Math.max(0, end - from),
                ease: 'none',
                onUpdate: () => this.render(),
                onComplete: () => {
                    this.clock.time = Infinity;
                    this.render();
                },
            },
        );
    }

    // Measures again after a resize; a play in progress carries on from where it is
    refresh() {
        this.lines.forEach(line => line.measure());
        if (this.tween?.isActive()) this.run(this.clock.time);
        this.render();
    }

    play() {
        this.reset();
        this.lines.forEach(line => line.measure());
        this.run(0);
    }

    // The old text in place, the new one hidden, no cursor
    reset() {
        this.tween?.kill();
        this.clock.time = -1;
        this.render();
    }

    // The new text only, for reduced motion
    show() {
        this.tween?.kill();
        this.clock.time = Infinity;
        this.render();
    }
}
