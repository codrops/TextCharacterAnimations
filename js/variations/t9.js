// 09 T9. The text is typed on a phone with number keys and predictive text.
// Lines start one after another from the top. Each key stands for three or
// four letters, so as keys come the word being typed keeps changing to the
// likeliest word, or start of a word, those keys could spell: i, ha, has,
// harb, harbour. While a word is being typed it shows in inverse, like the
// word on an old phone's screen. When the keys spell more than one word and
// the first guess is wrong, the next key cycles through the others until it's
// right: good, home. Then the space key takes the word. Commas and full stops
// come from one key too, cycling . , ? ! to the right one; digits are typed as
// they are.

// The letters on each key
const KEYS = {2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz'};
const KEY_OF = Object.fromEntries(
    Object.entries(KEYS).flatMap(([key, letters]) => [...letters].map(letter => [letter, key])),
);

// The punctuation on the 1 key, in the order it cycles through them
const PUNCTUATION = ['.', ',', '?', '!'];

// Common English words, the most common first: the guesses come from these,
// then from the text's own words
const WORDS = `
    the of and a to in is you that it he was for on are as with his they i at
    be this have from or one had by word but not what all were we when your can
    said there use an each which she do how their if will up other about out
    many then them these so some her would make like him into time has look two
    more write go see number no way could people my than first water been call
    who its now find long down day did get come made may part good new sound
    take only little work know place year live me back give most very after
    thing our just name man think say great where help through much before line
    right too mean old any same tell boy follow came want show also around form
    three small set put end does another well large must big even such because
    turn here why ask went men read need land different home us move try kind
    hand picture again change off play spell air away animal house point page
    letter mother answer found study still learn should world high every near
    add food between own below country plant last school father keep tree never
    start city earth eye light thought head under story saw left few while
    along might close something seem next hard open example begin life always
    those both paper together got group often run important until children side
    feet car mile night walk white sea began grow took river four carry state
    once book hear stop without second later miss idea enough eat face watch
    far really almost let above girl sometimes mountain cut young talk room
    soon list song leave family wide wife
`
    .trim()
    .split(/\s+/);

const settings = {
    // seconds per key press, quicker on small text and slower on big text; in
    // between for sizes in between (px)
    small: {size: 20, key: 0.04},
    big: {size: 80, key: 0.08},
    // seconds per press of the next key, as the guesses cycle
    next: 0.12,
    // seconds between the last key of a word and the space key taking it
    commit: 0.06,
    // seconds between the starts of two lines
    line: 0.3,
};

// The keys that spell a word
const keysOf = word => [...word.toLowerCase()].map(letter => KEY_OF[letter] ?? letter).join('');

// Writes a guess in the case of the word it stands for
const inCaseOf = (guess, word) => {
    if (word.length > 1 && word === word.toUpperCase()) return guess.toUpperCase();
    if (word[0] === word[0].toUpperCase()) return guess[0].toUpperCase() + guess.slice(1);
    return guess;
};

export class T9 {
    DOM = {
        // the element holding the lines
        el: null,
    };
    // each word: its element, its characters with their own text, the line
    // it's on, its letters (the part T9 spells) and what follows them
    words = [];
    // the guesses: common words, then the text's own
    dictionary = [];
    timeline = null;

    constructor(el) {
        // marks the element, so this effect's styles apply to it and nothing else
        el.dataset.effect = 't9';
        this.DOM.el = el;

        el.querySelectorAll('[data-line]').forEach((line, lineIndex) => {
            const split = SplitText.create(line, {
                type: 'words, chars',
                wordsClass: 'word',
                charsClass: 'char',
            });
            split.words.forEach(wordEl => {
                const chars = split.chars.filter(char => wordEl.contains(char));
                const text = chars.map(char => char.textContent).join('');
                // the letters at the start of the word; a word starting with anything else is typed as it is
                const letters = text.match(/^[a-z]+/i)?.[0] ?? '';
                this.words.push({el: wordEl, chars, text, line: lineIndex, letters});
            });
            line.classList.add('is-ready');
        });

        const own = this.words.map(word => word.letters.toLowerCase()).filter(Boolean);
        this.dictionary = [...new Set([...WORDS, ...own])].map(word => ({word, keys: keysOf(word)}));
        this.reset();
    }

    // What the screen shows for the first keys of a word: the likeliest word
    // they spell, or else the start of the likeliest longer word, or else the
    // first letter on each key
    guess(keys) {
        const exact = this.dictionary.find(entry => entry.keys === keys);
        if (exact) return exact.word;
        const longer = this.dictionary.find(entry => entry.keys.startsWith(keys));
        if (longer) return longer.word.slice(0, keys.length);
        return [...keys].map(key => KEYS[key]?.[0] ?? key).join('');
    }

    // Every word the keys of a whole word spell, likeliest first, ending with the right one
    candidates(word) {
        const keys = keysOf(word);
        const right = word.toLowerCase();
        const all = this.dictionary.filter(entry => entry.keys === keys).map(entry => entry.word);
        return all.slice(0, all.indexOf(right) + 1);
    }

    // Shows a guess in a word's first characters
    write(word, guess) {
        [...guess].forEach((letter, index) => {
            const char = word.chars[index];
            char.textContent = letter;
            char.style.opacity = 1;
        });
    }

    // Puts a word's own text back, its own capitals too
    restoreWord(word) {
        word.chars.forEach((char, index) => (char.textContent = word.text[index]));
    }

    restore() {
        this.words.forEach(word => this.restoreWord(word));
    }

    play() {
        this.reset();
        const em = parseFloat(getComputedStyle(this.DOM.el).fontSize);
        const {small, big} = settings;
        const key = gsap.utils.mapRange(
            small.size,
            big.size,
            small.key,
            big.key,
            gsap.utils.clamp(small.size, big.size, em),
        );
        this.timeline = gsap.timeline();

        let time = 0;
        let line = -1;
        this.words.forEach(word => {
            // each line starts a moment after the one above; a space between words
            if (word.line !== line) {
                line = word.line;
                time = line * settings.line;
            } else {
                time += key;
            }

            // The letters: each key changes the guess, shown in inverse
            const {letters} = word;
            for (let count = 1; count <= letters.length; count++) {
                time += key;
                const keys = keysOf(letters.slice(0, count));
                const guess = inCaseOf(
                    count < letters.length ? this.guess(keys) : this.candidates(letters)[0],
                    letters,
                );
                this.timeline.call(
                    () => {
                        word.el.classList.add('is-composing');
                        this.write(word, guess);
                    },
                    null,
                    time,
                );
            }
            // a wrong guess for the whole word: the next key, until it's right
            this.candidates(letters)
                .slice(1)
                .forEach(candidate => {
                    time += settings.next;
                    this.timeline.call(() => this.write(word, inCaseOf(candidate, letters)), null, time);
                });
            if (letters) {
                time += settings.commit;
                this.timeline.call(
                    () => {
                        word.el.classList.remove('is-composing');
                        this.restoreWord(word);
                    },
                    null,
                    time,
                );
            }

            // The rest, as it is, but . , ? ! cycle on their key to the right one
            word.chars.slice(letters.length).forEach(char => {
                const target = char.textContent;
                const steps = PUNCTUATION.includes(target)
                    ? PUNCTUATION.slice(0, PUNCTUATION.indexOf(target) + 1)
                    : [target];
                steps.forEach((step, index) => {
                    time += index === 0 ? key : settings.next;
                    this.timeline.call(
                        () => {
                            char.textContent = step;
                            char.style.opacity = 1;
                        },
                        null,
                        time,
                    );
                });
            });
        });
    }

    reset() {
        this.timeline?.kill();
        this.restore();
        this.words.forEach(word => {
            word.el.classList.remove('is-composing');
            word.chars.forEach(char => (char.style.opacity = ''));
        });
    }

    // The whole text at once, for reduced motion
    show() {
        this.timeline?.kill();
        this.restore();
        this.words.forEach(word => {
            word.el.classList.remove('is-composing');
            word.chars.forEach(char => (char.style.opacity = 1));
        });
    }

    // Nothing to measure
    refresh() {}
}
