// 13 Voice Note. The text comes in the way a voice message records in a chat
// app, transcribed as it goes. Lines start one after another from the top; in
// each, a live waveform grows at the front as the line is spoken: a small bar
// in the accent colour for every letter, taller on vowels and in the middle of
// a word, shorter on consonants and at its ends, with a silent gap between
// words. While they wait, the bars keep moving a little, like a level meter.
// A few letters behind the front the transcription catches up: each bar
// shrinks back into its centre as its letter fades in, so the sound arrives
// first and turns into text right behind it.

const settings = {
    // seconds per letter as a line is spoken, a space between two words
    // taking as long in silence: quicker on small text, slower on big text;
    // in between for sizes in between (px)
    small: {size: 20, letter: 0.035},
    big: {size: 80, letter: 0.06},
    // seconds between the starts of two lines
    line: 0.3,
    // how many letters behind the front the transcription follows
    lag: 5,
    // the shortest and the tallest bar, in em
    levels: [0.2, 0.8],
    // how loud a character sounds, as a share of the loudest: vowels, other
    // letters, and digits or punctuation
    loudness: {vowel: 1, consonant: 0.5, other: 0.05},
    // how much softer a word sounds at its ends than in its middle, as a share
    envelope: 0.6,
    // how much a bar's height can vary at random, as a share of it
    variance: 0.25,
    // how high the middle of the bars sits, in em above the baseline: about
    // the middle of the lowercase letters
    middle: 0.35,
    // seconds a bar takes to grow as the front reaches its letter
    grow: 0.1,
    // seconds between two changes in a waiting bar's height, and the range
    // its height moves in, as a share of its own
    flicker: 0.08,
    range: [0.7, 1.1],
    // seconds a bar takes to shrink back into its centre, and its letter to fade in
    shrink: 0.18,
    fade: 0.15,
};

// The letters said loudest, compared lowercase and without accents
const VOWELS = 'aeiouy';

// How loud a character sounds: vowels loudest, other letters softer, digits and punctuation barely
const loudnessOf = text => {
    const key = text.normalize('NFD').charAt(0).toLowerCase();
    if (VOWELS.includes(key)) return settings.loudness.vowel;
    if (/\p{L}/u.test(key)) return settings.loudness.consonant;
    return settings.loudness.other;
};

// How loud a word sounds at one of its characters: fullest in the middle, softer towards the ends
const shapeAt = (index, count) => 1 - settings.envelope * (1 - Math.sin((Math.PI * (index + 0.5)) / count));

// The offset of a character's baseline from its top
const getBaseline = char => {
    const probe = document.createElement('span');
    probe.style.cssText = 'display: inline-block; width: 0; height: 0; vertical-align: baseline;';
    char.before(probe);
    const offset = probe.getBoundingClientRect().top - char.getBoundingClientRect().top;
    probe.remove();
    return offset;
};

export class VoiceNote {
    DOM = {
        // the element holding the lines
        el: null,
        // every character of the text, line after line, and the bar for each
        chars: [],
        bars: [],
        // the layer over the text holding the bars
        layer: null,
    };
    // each character: its bar, the line it's on, its place in the line
    // counting the spaces between words, how loud it sounds before any
    // randomness, and where its bar goes, measured when the text plays
    letters = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'voice-note';
        this.DOM.el = el;

        this.DOM.layer = document.createElement('div');
        this.DOM.layer.className = 'bars';
        this.DOM.layer.setAttribute('aria-hidden', 'true');

        el.querySelectorAll('[data-line]').forEach((line, lineIndex) => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            let place = 0;
            split.words.forEach(wordEl => {
                const chars = split.chars.filter(char => wordEl.contains(char));
                chars.forEach((char, index) => {
                    const bar = document.createElement('span');
                    bar.className = 'bar';
                    this.DOM.layer.append(bar);
                    this.DOM.bars.push(bar);
                    this.letters.push({
                        char,
                        bar,
                        line: lineIndex,
                        place: place++,
                        voice: loudnessOf(char.textContent) * shapeAt(index, chars.length),
                        x: 0,
                        y: 0,
                    });
                });
                // the space after the word, said in silence
                place++;
            });
            this.DOM.chars.push(...split.chars);
            line.classList.add('is-ready');
        });

        el.append(this.DOM.layer);
        this.reset();
    }

    // Puts each bar centred on its letter, at the middle of the lowercase letters
    measure() {
        if (!this.letters.length) return;
        const box = this.DOM.el.getBoundingClientRect();
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        // each line's baseline, measured once from its first letter
        const baselines = new Map();
        this.letters.forEach(letter => {
            if (!baselines.has(letter.line)) baselines.set(letter.line, getBaseline(letter.char));
            const rect = letter.char.getBoundingClientRect();
            letter.x = rect.left - box.left + rect.width / 2;
            letter.y = rect.top - box.top + baselines.get(letter.line) - settings.middle * em;
            gsap.set(letter.bar, {x: letter.x, y: letter.y});
        });
    }

    // Measures again after a resize and moves the bars to match
    refresh() {
        this.measure();
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
        // seconds between the front reaching a letter and the transcription catching up
        const lag = Math.max(settings.grow, settings.lag * letter);
        const [low, high] = settings.levels;
        this.timeline = gsap.timeline();

        this.letters.forEach(({char, bar, line, place, voice}) => {
            // a fresh take each time: the bar's height, from the voice and some chance
            const share = gsap.utils.clamp(
                0,
                1,
                voice * gsap.utils.random(1 - settings.variance, 1 + settings.variance),
            );
            bar.style.setProperty('--level', `${low + (high - low) * share}em`);

            // when the front reaches the letter, each line a moment after the
            // one above, and when the transcription catches up with it
            const said = line * settings.line + place * letter;
            const heard = said + lag;

            // The bar grows from its centre as the letter is said
            this.timeline.to(bar, {scaleY: 1, duration: settings.grow, ease: 'power2.out'}, said);

            // and moves a little while it waits, like a level meter
            const wait = heard - said - settings.grow;
            if (wait > 0) {
                const steps = Math.max(1, Math.round(wait / settings.flicker));
                const keyframes = Array.from({length: steps}, () => ({
                    scaleY: gsap.utils.random(settings.range[0], settings.range[1]),
                    duration: wait / steps,
                    ease: 'sine.inOut',
                }));
                this.timeline.to(bar, {keyframes}, said + settings.grow);
            }

            // Then the transcription catches up: the bar shrinks back into its
            // centre as its letter fades in
            this.timeline
                .to(bar, {scaleY: 0, duration: settings.shrink, ease: 'power2.inOut'}, heard)
                .to(char, {opacity: 1, duration: settings.fade, ease: 'power1.out'}, heard);
        });
    }

    reset() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {clearProps: 'opacity'});
        gsap.set(this.DOM.bars, {scaleY: 0});
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        gsap.set(this.DOM.chars, {opacity: 1});
        gsap.set(this.DOM.bars, {scaleY: 0});
    }
}
