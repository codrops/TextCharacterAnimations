# AGENTS.md

How this demo is built, for anyone (person or agent) working on it or taking one effect out of it.

## The page

One page, `index.html`. The first screen shows one big word whose letters rise through a mask, tide becoming time (`js/hero.js`). Then nineteen sections, `#v01` to `#v19`, each with a small text of five lines and a big text in capitals, both running the section's effect. The text is one story, one time per section: a day and a night in a small harbour, the day Hana leaves on the last ferry, with her father, a fisherman, and her grandmother, who sells the tickets.

`js/index.js` wires the page:

- **Smooth scroll**: ScrollSmoother (`smooth: 1`), off with reduced motion.
- **Building**: a section's effects are built when it comes within two screens, or one section at a time in the page's idle moments once it has been still for a second. Nothing is split before `document.fonts.ready`.
- **Playing**: each block (small and big) plays when its top passes 80% down the screen (`start: 'top 80%'`), plays again only after it has left the screen completely, and replays on a click or from the section's Replay button.
- **Frame**: the title, links and tags down the left, the variation numbers in the centre; on the live site the Codrops ad (`#cdawrap`) lands top right, out of the flow on desktop so nothing moves when it arrives.
- **Bar of numbers**: `.pager`, a copy of the frame's variation links fixed at the top centre once the frame has scrolled away, with the current section marked (`aria-current`). It sits on a light pane of frosted glass (`backdrop-filter`), which blurs the text scrolling under it.
- **Screen readers**: each block is `aria-hidden`, with a visually hidden paragraph holding its text before it, since the effects split and sometimes rewrite the letters.
- **Reduced motion**: every effect calls `show()` at once, Replay is hidden and the hint changes.

The ground (`css/base.css`) is fixed to the screen: `--bg-layers`, a silver light from the top centre and a faint shade low on the left, under a grain of random white specks, `img/grain.png`, whose strength is `--grain-opacity`. The accent is `--color-accent: #e23e1d`, also the colour of the big word.

## The variations

| #  | Effect          | What happens |
| -- | --------------- | ------------ |
| 01 | Cursor Scramble | Lines start one after another. In each, a block cursor types the line out with a few dim guesses running ahead of it, and the letters it leaves behind brighten. The cursor blinks twice at the end of its line and goes. |
| 02 | Proofread       | The lines are typed fast, with a fast typist's mistakes. A caret then goes back and mends each one, the letters in question lit in the accent: swapped letters trade places, a missing letter pushes in, a doubled letter folds into its twin, a wrong key drops out. |
| 03 | Telegram        | Only the important words appear first, packed together like a telegram. The small words then slide in between them, and the punctuation lands last. |
| 04 | Loupe           | A lens travels along each line: letters appear inside it, swollen, pushed apart and in the accent, and settle behind it. |
| 05 | Overtype        | The new text is typed over the previous section's in overwrite mode. Each old letter the cursor passes is knocked out and falls away, tipping as it goes. |
| 06 | Autocomplete    | Typed with word suggestions: dim guesses, a word or two ahead of the caret, change as letters arrive, and once a guess is right the word completes itself. |
| 07 | Multi-cursor    | A caret lands at the start of every word, one after another, and they all type at once on the same keystrokes, each its own word. |
| 08 | Swipe           | Each word is written in one stroke, as on a phone keyboard: a trail glides along it, rising and dipping to each letter's keyboard row, and the word comes in when the stroke lifts. |
| 09 | T9              | Typed on a phone with number keys and predictive text: the word being typed, in inverse, changes with each key to the likeliest word those keys spell, and the next key cycles to the right one. |
| 10 | Find All        | The text is found rather than typed: one character at a time, every place it occurs lights up like the matches of a search, the most common characters first, faster and faster. |
| 11 | Collaborators   | Three people write the text at once, as in a shared document, each with a caret and flag in their own colour, gliding to their next line. |
| 12 | Live Captions   | Live television captions: a word or two at a time, and the rows roll up, each new one written in the bottom row. |
| 13 | Voice Note      | A voice message being recorded and transcribed: a live waveform grows at the front of each line, and a few letters behind, each bar shrinks into its letter. |
| 14 | Speed Reader    | Words flash one at a time at a reading point past the end of each line, aligned on a marked letter, then fly back into place. |
| 15 | Screen Reader   | A focus box like a screen reader's reads the text word by word, stretching to fit each word as it appears inside it. |
| 16 | Filament        | WebGL. Each letter catches like a lamp filament, from deep red through orange to white with a halo, then cools to the text colour. |
| 17 | Photocopy       | WebGL. Each letter starts as a copy of a copy of a copy, thickened and broken, and comes back through the generations until it's crisp. |
| 18 | Photon          | WebGL. Each letter forms the way an image does in the dark: specks of sensor noise, then the letter rising out of them. |
| 19 | Caustics        | WebGL. Each letter first shows as caustic light, refracted through moving water, and gathers into the crisp letter as the water calms. |

## Files

- `js/variations/<file>.js` and `css/variations/<name>.css`: one effect each. The CSS is scoped to `[data-effect='<name>']`, which the effect sets on its element.
- `js/variations/glText.js`: the WebGL renderer behind 16 to 19. It draws the letters into a texture (worked out in a Blob-URL web worker, or on the main thread where workers can't start), starts WebGL ahead of play in a still moment, keeps at most eight contexts alive, and hands over to the page text at the end. The top of the file documents the texture's channels.
- `js/hero.js`, `js/index.js`, `css/base.css`: the page.
- `js/*.min.js`: GSAP 3.15 (core, ScrollTrigger, ScrollSmoother, SplitText, Flip), loaded as globals.

Conventions: plain-English comments that say what you see and why; every timing in a `settings` object at the top of its file, each value commented; timings that differ between the small and the big text are mapped from the element's font size (`small` at 20px, `big` at 80px). Comments describe the code as it is, never its history.

## Use one effect on its own

Each effect is self-contained: one JavaScript file and one CSS file. It animates any element whose lines of text are marked with `data-line`. The example below uses Swipe; swap in any other effect from the table at the end.

### 1. Copy the files

From the repo, copy into your project:
- `js/variations/swipe.js`
- `css/variations/swipe.css`

For a WebGL effect (Filament, Photocopy, Photon, Caustics), also copy `js/variations/glText.js` into the same folder as the effect's file. Those four also need a browser with WebGL2.

### 2. Load GSAP

The effects use GSAP 3.15 and SplitText as globals; Proofread also needs Flip. Use the copies in this repo's `js/` folder, or load them from a CDN. If you install the `gsap` package instead, set `window.gsap` and `window.SplitText` (and `window.Flip`) before the effect's module loads.

### 3. Mark up your text

Put each line in its own element with `data-line`:

```html
<div class="message">
	<p data-line>The boats come in with the gulls,</p>
	<p data-line>her father's last of all.</p>
</div>
```

### 4. Create and play it

Create the effect once the fonts have loaded, since it measures the letters. Call `play()`, or `show()` for visitors who prefer reduced motion:

```html
<link rel="stylesheet" href="swipe.css" />

<script src="gsap.min.js"></script>
<script src="SplitText.min.js"></script>
<script type="module">
	import {Swipe} from './swipe.js';

	gsap.registerPlugin(SplitText);

	document.fonts.ready.then(() => {
		const effect = new Swipe(document.querySelector('.message'));
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) effect.show();
		else effect.play();
	});
</script>
```

Every effect has the same four methods:
- `play()` plays it from the start, even mid-play. Call it on scroll, on click, whenever you like.
- `reset()` stops it and hides the text again, ready to play.
- `show()` shows the finished text at once.
- `refresh()` measures again. Call it after a resize.

### 5. Hide the text until it's ready

The text shows as written until the effect is created, then disappears and animates in. To avoid that flash, hide the lines until the effect marks them ready:

```css
.js [data-line]:not(.is-ready) {
	visibility: hidden;
}
```

Add the `js` class to `<html>` with a one-line script in the `<head>`, so the text stays visible if scripts don't run.

### 6. Colours

The effect uses your text's own font, size and colour (the WebGL ones read the colour from the element holding the lines). Some effects add colours through CSS variables, whose defaults suit a dark page. On a light page, set them on the element or higher up:
- `--color-accent` (`#e23e1d`): carets, trails, highlights and marked letters.
- `--color-guess` (`rgb(255 255 255 / 40%)`): dim guesses in Cursor Scramble and Autocomplete.
- `--color-text` (`rgb(255 255 255 / 50%)`) and `--color-strong` (`rgb(255 255 255 / 88%)`): Overtype's old text and the text it settles to.
- `--color-bg` (`#0b0b0b`): the letters inside T9's inverse box and Find All's highlights.
- `--color-person-1` to `--color-person-3` (`#ff5d8f`, `#4aa3ff`, `#ffb020`): Collaborators' three writers.

### 7. Screen readers

SplitText labels each split line for screen readers, but some ignore labels on paragraphs. For running text, add a visually hidden copy of it next to the element and put `aria-hidden="true"` on the animated element, as `js/index.js` does.

### Effects at a glance

| Effect          | Class            | Files                                     | Also needs |
| --------------- | ---------------- | ----------------------------------------- | ---------- |
| Cursor Scramble | `CursorScramble` | `cursorScramble.js`, `cursor-scramble.css` |            |
| Proofread       | `Proofread`      | `proofread.js`, `proofread.css`           | Flip       |
| Telegram        | `Telegram`       | `telegram.js`, `telegram.css`             |            |
| Loupe           | `Loupe`          | `loupe.js`, `loupe.css`                   |            |
| Overtype        | `Overtype`       | `overtype.js`, `overtype.css`             | `data-from` on each line: the text it types over |
| Autocomplete    | `Autocomplete`   | `autocomplete.js`, `autocomplete.css`     |            |
| Multi-cursor    | `MultiCursor`    | `multiCursor.js`, `multi-cursor.css`      |            |
| Swipe           | `Swipe`          | `swipe.js`, `swipe.css`                   |            |
| T9              | `T9`             | `t9.js`, `t9.css`                         |            |
| Find All        | `FindAll`        | `findAll.js`, `find-all.css`              |            |
| Collaborators   | `Collaborators`  | `collaborators.js`, `collaborators.css`   |            |
| Live Captions   | `LiveCaptions`   | `liveCaptions.js`, `live-captions.css`    |            |
| Voice Note      | `VoiceNote`      | `voiceNote.js`, `voice-note.css`          |            |
| Speed Reader    | `SpeedReader`    | `speedReader.js`, `speed-reader.css`      |            |
| Screen Reader   | `ScreenReader`   | `screenReader.js`, `screen-reader.css`    |            |
| Filament        | `Filament`       | `filament.js`, `filament.css`             | `glText.js`, WebGL2 |
| Photocopy       | `Photocopy`      | `photocopy.js`, `photocopy.css`           | `glText.js`, WebGL2 |
| Photon          | `Photon`         | `photon.js`, `photon.css`                 | `glText.js`, WebGL2 |
| Caustics        | `Caustics`       | `caustics.js`, `caustics.css`             | `glText.js`, WebGL2 |

Each effect's timings are in a `settings` object at the top of its file, each value commented, to make it faster, slower or softer. Most effects set separate timings for small and big text.
