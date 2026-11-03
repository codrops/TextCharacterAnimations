// 08 Swipe. Each word is written in one stroke, the way a phone keyboard lets
// you glide across the keys. Lines start one after another from the top; in
// each, a trail in the accent colour glides along a word, rising and dipping
// to the row of the keyboard each letter sits on: highest for digits, then
// the top row, the middle row and the bottom row. The letters show faintly as
// the trail passes over them. When the stroke lifts at the end of the word,
// the word comes in at full strength, left to right, as the trail shrinks
// into its last letter, and the next word starts.

// The rows of the keyboard, top to bottom; anything else counts as the bottom row
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const settings = {
    // how high each row of keys puts the trail, in em above the baseline
    heights: [0.95, 0.7, 0.42, 0.14],
    // seconds of stroke per letter, the shortest stroke, and seconds between
    // lifting at the end of a word and starting the next: quicker on small
    // text, slower on big text, where the stroke travels further; in between
    // for sizes in between (px)
    small: {size: 20, letter: 0.035, shortest: 0.12, gap: 0.05},
    big: {size: 80, letter: 0.06, shortest: 0.18, gap: 0.07},
    // seconds between the starts of two lines
    line: 0.3,
    // seconds the trail takes to shrink into the last letter after it lifts
    shrink: 0.22,
    // the trail: a short bright head over a longer, thinner, fainter tail; lengths and widths in em
    trail: [
        {length: 0.6, width: 0.14, opacity: 0.95},
        {length: 1.8, width: 0.09, opacity: 0.55},
        {length: 3.6, width: 0.05, opacity: 0.25},
    ],
    // the letters' strength as the trail passes over them
    dim: 0.4,
    // seconds a letter takes to show faintly, and to come in at full strength
    show: 0.1,
    commit: 0.18,
    // seconds between two letters coming in as a word is committed
    stagger: 0.012,
};

const SVG = 'http://www.w3.org/2000/svg';

// The row of the keyboard a character sits on
const rowOf = char => {
    const key = char.toLowerCase();
    const row = ROWS.findIndex(keys => keys.includes(key));
    return row < 0 ? ROWS.length - 1 : row;
};

// A smooth path through points, as cubic curves
const smoothPath = points => {
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const c1 = {x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6};
        const c2 = {x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6};
        d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
    }
    return d;
};

// The share of a power1.inOut stroke's time at which it has covered a share of its length
const timeAt = share => (share < 0.5 ? Math.sqrt(share / 2) : 1 - Math.sqrt((1 - share) / 2));

// The offset of a character's baseline from its top
const getBaseline = char => {
    const probe = document.createElement('span');
    probe.style.cssText = 'display: inline-block; width: 0; height: 0; vertical-align: baseline;';
    char.before(probe);
    const offset = probe.getBoundingClientRect().top - char.getBoundingClientRect().top;
    probe.remove();
    return offset;
};

export class Swipe {
    DOM = {
        // the element holding the lines
        el: null,
        // the drawing over the text holding the trails
        svg: null,
    };
    // each word: its characters, the line it's on, its trail (one path per
    // part of the trail), the trail's length and where each letter falls
    // along it, and how far along the trail's head is
    words = [];
    // the text's font size in px, which the trail's sizes are in em of
    em = 0;
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'swipe';
        this.DOM.el = el;

        this.DOM.svg = document.createElementNS(SVG, 'svg');
        this.DOM.svg.classList.add('trails');
        this.DOM.svg.setAttribute('aria-hidden', 'true');

        el.querySelectorAll('[data-line]').forEach((line, lineIndex) => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => {
                const group = document.createElementNS(SVG, 'g');
                group.classList.add('trail');
                const paths = settings.trail.map(() => {
                    const path = document.createElementNS(SVG, 'path');
                    group.append(path);
                    return path;
                });
                this.DOM.svg.append(group);
                this.words.push({
                    chars: split.chars.filter(char => wordEl.contains(char)),
                    line: lineIndex,
                    group,
                    paths,
                    total: 0,
                    lengths: [],
                    head: 0,
                });
            });
            line.classList.add('is-ready');
        });

        el.append(this.DOM.svg);
        this.reset();
    }

    // Lays each word's trail through its letters, at the height of their keys
    measure() {
        const box = this.DOM.el.getBoundingClientRect();
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        this.em = em;
        this.DOM.svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        this.DOM.svg.setAttribute('width', box.width);
        this.DOM.svg.setAttribute('height', box.height);

        this.words.forEach(word => {
            const baseline = getBaseline(word.chars[0]);
            const points = word.chars.map(char => {
                const rect = char.getBoundingClientRect();
                return {
                    x: rect.left - box.left + rect.width / 2,
                    y: rect.top - box.top + baseline - settings.heights[rowOf(char.textContent)] * em,
                };
            });
            // the stroke starts at the first letter's left edge and ends at the last one's right
            const first = word.chars[0].getBoundingClientRect();
            const last = word.chars[word.chars.length - 1].getBoundingClientRect();
            points.unshift({x: first.left - box.left, y: points[0].y});
            points.push({x: last.right - box.left, y: points[points.length - 1].y});

            // how far along the trail each letter falls
            const [path] = word.paths;
            word.lengths = word.chars.map((char, index) => {
                path.setAttribute('d', smoothPath(points.slice(0, index + 2)));
                return path.getTotalLength();
            });
            const d = smoothPath(points);
            word.paths.forEach(part => part.setAttribute('d', d));
            word.total = path.getTotalLength();
        });
        this.render();
    }

    // Measures again after a resize and redraws the trails to match
    refresh() {
        this.measure();
    }

    // Draws each trail's parts as dashes ending at its head
    render() {
        this.words.forEach(word => {
            word.paths.forEach((path, index) => {
                const {length, width, opacity} = settings.trail[index];
                const dash = length * this.em;
                path.style.strokeWidth = width * this.em;
                path.style.strokeOpacity = opacity;
                // one dash, with a gap long enough that it never comes round again
                path.style.strokeDasharray = `${dash} ${word.total + 5 * this.em}`;
                path.style.strokeDashoffset = dash - word.head;
            });
        });
    }

    play() {
        this.reset();
        this.measure();
        this.timeline = gsap.timeline({onUpdate: () => this.render()});

        // the stroke's pace for the text's size
        const {small, big} = settings;
        const pace = key =>
            gsap.utils.mapRange(
                small.size,
                big.size,
                small[key],
                big[key],
                gsap.utils.clamp(small.size, big.size, this.em),
            );
        const [letter, shortest, gap] = ['letter', 'shortest', 'gap'].map(pace);

        let time = 0;
        let line = -1;
        this.words.forEach(word => {
            // each line starts a moment after the one above
            if (word.line !== line) {
                line = word.line;
                time = line * settings.line;
            }
            const duration = Math.max(shortest, word.chars.length * letter);
            const lift = time + duration;

            this.timeline
                .set(word.group, {visibility: 'visible'}, time)
                .to(word, {head: word.total, duration, ease: 'power1.inOut'}, time)
                .to(
                    word,
                    {
                        head: word.total + settings.trail[settings.trail.length - 1].length * this.em,
                        duration: settings.shrink,
                        ease: 'power2.out',
                    },
                    lift,
                )
                .set(word.group, {visibility: 'hidden'}, lift + settings.shrink);

            // the letters show faintly as the head passes them
            word.chars.forEach((char, index) => {
                const at = time + duration * timeAt(Math.min(1, word.lengths[index] / word.total));
                this.timeline.to(char, {opacity: settings.dim, duration: settings.show, ease: 'power1.out'}, at);
            });
            // and come in at full strength as the stroke lifts
            this.timeline.to(
                word.chars,
                {opacity: 1, duration: settings.commit, ease: 'power1.out', stagger: settings.stagger},
                lift,
            );

            time = lift + gap;
        });
    }

    reset() {
        this.timeline?.kill();
        gsap.set(
            this.words.flatMap(word => word.chars),
            {clearProps: 'opacity'},
        );
        this.words.forEach(word => {
            word.head = 0;
            gsap.set(word.group, {visibility: 'hidden'});
        });
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        gsap.set(
            this.words.flatMap(word => word.chars),
            {opacity: 1},
        );
        this.words.forEach(word => gsap.set(word.group, {visibility: 'hidden'}));
    }
}
