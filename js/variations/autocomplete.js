// 06 Autocomplete. One typist types the lines, one after another, with
// a thin caret leading, and dim text keeps running ahead of it, the way a
// phone keyboard guesses. After each word, a guess at the next one or two
// words shows up past the space. While the typed letters fit the guess it
// stays, each letter landing on its own dim one; once they don't, a guess at
// a longer word starting with those letters takes its place, often wrong and
// changing as more letters arrive. Whenever the guess is the right word, the
// word fills itself in, left to right, faster than typing, and the caret
// jumps to its end. No guess runs past the right edge of the text. After the
// last line the caret blinks twice and fades.

// A few hundred common English words, the most common first. A guess at a
// word is the longest one here that starts with the letters typed so far.
const WORDS = `
    the and that have for not with you this but his from they say her she will
    one all would there their what out about who get which when make can like
    time just him know take people into year your good some could them see
    other than then now look only come its over think also back after use two
    how our work first well way even new want because any these give day most
    find thing tell very here many down should still through great before must
    little world house never place again where every life always under while
    last long might same right around part call city keep start school between
    help during both without each those mean ask show change point play small
    number home hand high turn follow light open near water fire night end
    enough early late best better sure free full real hard easy young old word
    read write story book name family friend group problem fact money power
    order area state country company course common table moment door room face
    head body hour minute week month morning evening game music paper case
    question answer line side voice kind car road street town river island
    coast beach wave wind rain storm cloud summer winter spring autumn design
    bring begin believe build carry catch clear close cover cross dark draw
    drive drop eat fall feel fill fly forget grow happen hear hold hope learn
    leave lose love meet move need offer pay pick pull push put reach remember
    rest return run sell send set sit sleep stand stay stop talk teach travel
    try wait walk watch wear win wish ever everything everyone already almost
    another anything away bad ball bank base become behind below beside big
    black blue board boy brother brown busy buy cold color cost cut deep death
    deal detail degree describe develop different difficult dinner dog doctor
    dream dress earth east edge energy enter enjoy entire event evidence eye
    far farm fast father few field final fine five fish floor flower food foot
    force form forward found four front future garden girl glass gold green
    ground guess guy guard guide gun hair half happy heart heavy hill history
    horse hot huge idea important inside interest iron job journey kitchen
    king lake land large laugh lead leg less letter level list local low main
    market matter middle mile milk mind miss modern mother mountain mouth
    nature neck news next north note nothing ocean office often oil paint park
    party past peace picture piece plan plant plate pocket poor port possible
    present pretty quiet quick quite radio rather ready reason red rich ring
    rock roof round safe salt sand save season seat second seem shape share
    ship shop short shoulder silver simple single sister size sky slow snow
    soft soldier song soon sound south space speak special speed stone strong
    study sudden sugar sun tall tea team ten test thick thin third though
    thought three throw tiny today together tomorrow tonight top toward tree
    trip true twice until upon usual valley village visit wall warm wash
    weather west wheel white whole wide wife wild window wing within wonder
    wood yellow yesterday yet
`
    .trim()
    .split(/\s+/);

// The next words a phone might guess after a word, one or two of them, often
// wrong. '#' stands for a number or a time.
const FOLLOW = {
    '#': 'and the',
    'the': 'same day',
    'fishing': 'trip',
    'boats': 'are in',
    'come': 'back to',
    'back': 'to the',
    'with': 'the same',
    'their': 'own boats',
    'engines': 'running',
    'low': 'tide',
    'and': 'their own',
    'decks': 'and the',
    'wet': 'and cold',
    'followed': 'by the',
    'every': 'day',
    'gull': 'on the',
    'in': 'the morning',
    'first': 'time',
    'fish': 'and chips',
    'because': 'of the',
    'between': 'the',
    'country': 'road',
    'company': 'and',
    'without': 'a',
    'everything': 'is',
    'anything': 'else',
    'together': 'with',
    'little': 'bit',
    'enough': 'to',
    'local': 'news',
    'different': 'from',
    'tomorrow': 'morning',
    'morning': 'and',
    'board': 'the',
    'forward': 'to',
    'through': 'the',
    'there': 'is',
};

// Guessed after the words the table doesn't have, one picked by the word
const COMMON = ['the', 'and', 'to', 'of', 'in', 'a'];

// The words guessed after a word
const guessNext = word => {
    if (FOLLOW[word]) return FOLLOW[word];
    const sum = [...word].reduce((total, letter) => total + letter.charCodeAt(0), 0);
    return COMMON[sum % COMMON.length];
};

const settings = {
    // seconds per typed letter, or space
    letter: 0.042,
    // the shortest word that gets guesses as it's typed
    shortest: 3,
    // seconds a wrong guess takes to fade out, and the next one to fade in:
    // the new one eases in slowly, so it barely shows while the old one goes
    fadeOut: 0.08,
    fadeIn: 0.28,
    // how far a new guess slides in from, in em
    slide: 0.05,
    // seconds the right guess shows before it fills in
    take: 0.08,
    // seconds per letter as the right guess fills in
    sweep: 0.02,
    // seconds a filled-in letter takes to brighten
    brighten: 0.12,
    // seconds the caret takes to jump to the end of a filled-in word
    jump: 0.06,
    // seconds the caret waits before the first letter
    lead: 0.2,
    // seconds the caret is off, then on, as it blinks at the end
    blink: 0.16,
    // blinks at the end
    blinks: 2,
    // seconds it then takes to fade
    fade: 0.3,
};

// Where the caret or a guess sits: before or after a character, by its index
// among all the characters of the text
const before = index => index * 2;
const after = index => index * 2 + 1;

export class Autocomplete {
    DOM = {
        // the element holding the lines
        el: null,
        // every character of the text, line after line
        chars: [],
        // the layer over the text holding the caret and the guesses
        typist: null,
        caret: null,
    };
    // each word of the text: its characters, the index of its first one, its
    // text, its letters without punctuation, and whether its line is written
    // in capitals
    words = [];
    // the guesses built for a play: their elements, letters, text, where
    // they sit, and how many of their letters have been typed over
    ghosts = [];
    // where the caret can sit, before and after each character, relative to
    // the text; measured when the text plays
    spots = [];
    // the width of the text, which no guess runs past
    width = 0;
    // the text's font size in pixels, for the guesses' slide
    em = 0;
    // measures a guess's letters in the text's font before it's built
    context = document.createElement('canvas').getContext('2d');
    widths = new Map();
    // where the caret is now
    caretSpot = 0;
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 'autocomplete';
        this.DOM.el = el;

        el.querySelectorAll('[data-line]').forEach(line => {
            // a line in capitals gets its guesses in capitals, as with caps lock on
            const letters = line.textContent.replace(/[^a-z]/gi, '');
            const capitals = letters.length > 1 && letters === letters.toUpperCase();
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => {
                const chars = split.chars.filter(char => wordEl.contains(char));
                const text = chars.map(char => char.textContent).join('');
                // only words of letters, maybe followed by punctuation, get guesses
                const match = text.match(/^([a-z]+)[^a-z0-9]*$/i);
                this.words.push({
                    chars,
                    start: this.DOM.chars.length,
                    text,
                    letters: match ? match[1] : '',
                    capitals,
                });
                this.DOM.chars.push(...chars);
            });
            line.classList.add('is-ready');
        });

        this.DOM.typist = document.createElement('div');
        this.DOM.typist.className = 'typist';
        this.DOM.typist.setAttribute('aria-hidden', 'true');
        this.DOM.caret = document.createElement('span');
        this.DOM.caret.className = 'typist__caret';
        this.DOM.typist.append(this.DOM.caret);
        el.append(this.DOM.typist);

        this.reset();
    }

    // Measures where the caret can sit, before and after each character,
    // and the room the guesses have
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
        this.width = textRect.width;

        const style = getComputedStyle(this.DOM.el);
        this.em = parseFloat(style.fontSize);
        this.context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        this.widths.clear();
    }

    // Measures again after a resize and moves the caret and the guesses to match
    refresh() {
        this.measure();
        this.placeCaret(this.caretSpot);
        this.ghosts.forEach(ghost => this.placeGhost(ghost));
    }

    // Whether a guess placed at a spot ends before the right edge of the
    // text, its letters set side by side like the split characters
    fits(text, spot) {
        const width = [...text].reduce((total, letter) => {
            if (!this.widths.has(letter)) this.widths.set(letter, this.context.measureText(letter).width);
            return total + this.widths.get(letter);
        }, 0);
        return this.spots[spot].x + width <= this.width;
    }

    // The next one or two words guessed after a word, placed past the space.
    // The second word goes if it would run past the edge, both if the first would.
    predict(previous, spot) {
        const key = /^\d/.test(previous.text) ? '#' : previous.letters.toLowerCase();
        const words = guessNext(key).split(' ');
        // in capitals in a line of capitals; otherwise a new sentence starts with a capital
        if (previous.capitals) words.forEach((word, index) => (words[index] = word.toUpperCase()));
        else if (/[.!?]$/.test(previous.text)) words[0] = words[0][0].toUpperCase() + words[0].slice(1);
        while (words.length && !this.fits(words.join(' '), spot)) words.pop();
        return words.join(' ');
    }

    // A guess at the rest of a word from its first letters: the longest word
    // starting with them that fits before the edge, then the word that might
    // follow it, if that fits too. When no other word fits, the rest of the
    // right word.
    complete(word, typed) {
        const prefix = word.letters.slice(0, typed);
        const right = word.letters.toLowerCase();
        const spot = after(word.start + typed - 1);
        // all capitals in a line of capitals or once two capitals are typed, otherwise lower case
        const isCapitals = word.capitals || (prefix.length > 1 && prefix === prefix.toUpperCase());
        const write = text => (isCapitals ? text.toUpperCase() : text);

        const guess = WORDS.filter(
            candidate => candidate !== right && candidate.length > typed && candidate.startsWith(prefix.toLowerCase()),
        )
            .sort((a, b) => b.length - a.length)
            .find(candidate => this.fits(write(candidate.slice(typed)), spot));

        if (!guess && typed === word.letters.length) return '';
        const rest = guess ? write(guess.slice(typed)) : word.letters.slice(typed);
        const withNext = `${rest} ${write(guessNext(guess ?? right).split(' ')[0])}`;
        return this.fits(withNext, spot) ? withNext : rest;
    }

    // Puts the caret at one of its spots
    placeCaret(spot) {
        const {x, y} = this.spots[spot] ?? {x: 0, y: 0};
        this.caretSpot = spot;
        gsap.set(this.DOM.caret, {x, y});
    }

    // Puts a guess right after the letters typed when it showed up
    placeGhost(ghost) {
        const {x, y} = this.spots[ghost.spot] ?? {x: 0, y: 0};
        gsap.set(ghost.el, {x, y});
    }

    // Builds a hidden guess at a spot, letter by letter, with spaces between its words
    createGhost(text, spot) {
        const el = document.createElement('span');
        el.className = 'ghost';
        const inner = document.createElement('span');
        inner.className = 'ghost__inner';
        const letters = [...text].map(letter => {
            if (letter === ' ') {
                inner.append(' ');
                return null;
            }
            const span = document.createElement('span');
            span.className = 'ghost__letter';
            span.textContent = letter;
            inner.append(span);
            return span;
        });
        el.append(inner);
        this.DOM.typist.insertBefore(el, this.DOM.caret);

        const ghost = {el, inner, letters, text, spot, typed: 0};
        this.ghosts.push(ghost);
        this.placeGhost(ghost);
        return ghost;
    }

    // Takes every guess out of the page
    removeGhosts() {
        this.ghosts.forEach(ghost => ghost.el.remove());
        this.ghosts = [];
    }

    // A letter typed: it shows at once and the caret moves past it
    addKey(index, time) {
        this.timeline
            .set(this.DOM.chars[index], {opacity: 1}, time)
            .call(() => this.placeCaret(after(index)), null, time);
    }

    // A guess fades in at a spot, sliding a little to the left
    addGhost(text, spot, time) {
        if (!text) return null;
        const ghost = this.createGhost(text, spot);
        this.timeline.set(ghost.el, {visibility: 'visible'}, time).fromTo(
            ghost.inner,
            {
                opacity: 0,
                x: () => settings.slide * this.em,
            },
            {
                opacity: 1,
                x: 0,
                duration: settings.fadeIn,
                ease: 'power2.inOut',
            },
            time,
        );
        return ghost;
    }

    // A letter typed that fits the guess lands on the guess's own letter
    addCover(ghost, time) {
        const letter = ghost.letters[ghost.typed];
        if (letter) this.timeline.set(letter, {visibility: 'hidden'}, time);
        ghost.typed++;
    }

    // A guess the letters no longer fit fades out
    addDrop(ghost, time) {
        if (!ghost) return;
        this.timeline
            .to(ghost.inner, {opacity: 0, duration: settings.fadeOut, ease: 'power1.out'}, time)
            .set(ghost.el, {visibility: 'hidden'}, time + settings.fadeOut);
    }

    // Whether the guess's word at the caret is the rest of the word being typed
    isRight(ghost, word, typed) {
        const left = word.letters.slice(typed).toLowerCase();
        const guessed = ghost.text.slice(ghost.typed).split(' ')[0].toLowerCase();
        return left.length > 0 && guessed === left;
    }

    // The right guess fills the word in: its dim letters brighten into the
    // word, left to right, while the caret jumps to the end of the word. The
    // rest of the guess stays ahead. Returns when the next letter can be typed.
    addFill(ghost, word, typed, time) {
        const start = time + settings.take;
        const count = word.letters.length - typed;
        const end = after(word.start + word.letters.length - 1);

        for (let i = 0; i < count; i++) {
            const at = start + i * settings.sweep;
            this.timeline
                .to(
                    this.DOM.chars[word.start + typed + i],
                    {opacity: 1, duration: settings.brighten, ease: 'power1.out'},
                    at,
                )
                .to(ghost.letters[ghost.typed + i], {opacity: 0, duration: settings.brighten, ease: 'power1.out'}, at);
        }
        ghost.typed += count;

        this.timeline.to(
            this.DOM.caret,
            {
                x: () => this.spots[end].x,
                y: () => this.spots[end].y,
                duration: settings.jump,
                ease: 'expo.out',
                onStart: () => (this.caretSpot = end),
            },
            start,
        );

        return start + Math.max(count * settings.sweep, settings.jump);
    }

    play() {
        this.reset();
        this.measure();
        this.placeCaret(0);
        this.timeline = gsap.timeline();
        this.timeline.set(this.DOM.caret, {autoAlpha: 1}, 0);

        // the guess on screen
        let ghost = null;
        let time = settings.lead;

        this.words.forEach((word, wordIndex) => {
            // The space before the word, or the move to the next line. A guess
            // going on past a space on the same line stays; otherwise a guess
            // at the next words takes its place.
            if (wordIndex > 0) {
                const spot = before(word.start);
                time += settings.letter;
                this.timeline.call(() => this.placeCaret(spot), null, time);
                const isSameLine = ghost && Math.abs(this.spots[spot].y - this.spots[ghost.spot].y) < 1;
                if (isSameLine && ghost.text[ghost.typed] === ' ') {
                    this.addCover(ghost, time);
                } else {
                    this.addDrop(ghost, time);
                    ghost = this.addGhost(this.predict(this.words[wordIndex - 1], spot), spot, time);
                }
            }

            let typed = 0;
            while (typed < word.chars.length) {
                if (ghost && this.isRight(ghost, word, typed)) {
                    time = this.addFill(ghost, word, typed, time);
                    typed = word.letters.length;
                    continue;
                }

                time += settings.letter;
                this.addKey(word.start + typed, time);
                const char = word.text[typed];
                typed++;

                if (ghost && ghost.text[ghost.typed]?.toLowerCase() === char.toLowerCase()) {
                    this.addCover(ghost, time);
                    continue;
                }
                this.addDrop(ghost, time);
                ghost = null;
                if (word.letters.length >= settings.shortest && typed <= word.letters.length) {
                    ghost = this.addGhost(this.complete(word, typed), after(word.start + typed - 1), time);
                }
            }
        });
        this.addDrop(ghost, time);

        // The caret blinks twice at the end, then fades
        for (let i = 0; i < settings.blinks; i++) {
            this.timeline
                .set(this.DOM.caret, {opacity: 0}, time + settings.blink * (2 * i + 1))
                .set(this.DOM.caret, {opacity: 1}, time + settings.blink * (2 * i + 2));
        }
        const fade = time + settings.blink * (2 * settings.blinks + 1);
        this.timeline
            .to(this.DOM.caret, {autoAlpha: 0, duration: settings.fade, ease: 'power1.inOut'}, fade)
            .call(() => this.removeGhosts(), null, fade + settings.fade);
    }

    reset() {
        this.timeline?.kill();
        this.removeGhosts();
        gsap.set(this.DOM.chars, {clearProps: 'opacity'});
        gsap.set(this.DOM.caret, {autoAlpha: 0});
        this.placeCaret(0);
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        this.removeGhosts();
        gsap.set(this.DOM.chars, {opacity: 1});
        gsap.set(this.DOM.caret, {autoAlpha: 0});
    }
}
