import {Hero} from './hero.js';
import {CursorScramble} from './variations/cursorScramble.js';
import {Proofread} from './variations/proofread.js';
import {Telegram} from './variations/telegram.js';
import {Loupe} from './variations/loupe.js';
import {Overtype} from './variations/overtype.js';
import {Autocomplete} from './variations/autocomplete.js';
import {MultiCursor} from './variations/multiCursor.js';
import {Swipe} from './variations/swipe.js';
import {T9} from './variations/t9.js';
import {FindAll} from './variations/findAll.js';
import {Collaborators} from './variations/collaborators.js';
import {LiveCaptions} from './variations/liveCaptions.js';
import {VoiceNote} from './variations/voiceNote.js';
import {SpeedReader} from './variations/speedReader.js';
import {ScreenReader} from './variations/screenReader.js';
import {Filament} from './variations/filament.js';
import {Photocopy} from './variations/photocopy.js';
import {Photon} from './variations/photon.js';
import {Caustics} from './variations/caustics.js';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, Flip);

// The effect each section runs, by its data-variation name
const variations = {
    'cursor-scramble': CursorScramble,
    'proofread': Proofread,
    'telegram': Telegram,
    'loupe': Loupe,
    'overtype': Overtype,
    'autocomplete': Autocomplete,
    'multi-cursor': MultiCursor,
    'swipe': Swipe,
    't9': T9,
    'find-all': FindAll,
    'collaborators': Collaborators,
    'live-captions': LiveCaptions,
    'voice-note': VoiceNote,
    'speed-reader': SpeedReader,
    'screen-reader': ScreenReader,
    'filament': Filament,
    'photocopy': Photocopy,
    'photon': Photon,
    'caustics': Caustics,
};

// Visitors who prefer reduced motion get every text at once, and native scrolling
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// set while an in-page link moves the focus to where the page is already scrolling
let isLinkFocus = false;

const smoother = reducedMotion
    ? null
    : ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 1,
          // the smoother scrolls to whatever takes the focus, except there
          onFocusIn: () => !isLinkFocus,
      });

// Screen readers get each text as one plain paragraph in a hidden copy; the
// animated letters, split and rewritten by the effects, are hidden from them
document.querySelectorAll('.variation__text').forEach(block => {
    const copy = document.createElement('p');
    copy.className = 'visually-hidden';
    copy.textContent = [...block.querySelectorAll('[data-line]')].map(line => line.textContent.trim()).join(' ');
    block.before(copy);
    block.setAttribute('aria-hidden', 'true');
});

if (reducedMotion) document.querySelector('.intro__hint').textContent = 'Scroll to see each variation.';

// The variation numbers again, in a bar fixed at the top centre once the
// frame has scrolled out of view, with the variation on screen marked
const pager = document.createElement('nav');
pager.className = 'pager';
pager.setAttribute('aria-label', 'Jump to variation');
pager.append(...[...document.querySelectorAll('.frame__demo')].map(link => link.cloneNode(true)));

document.body.prepend(pager);
const setPagerVisible = isVisible => pager.classList.toggle('is-visible', isVisible);

// shown from the moment the frame's bottom passes the top of the screen, all
// the way down, and hidden again only back above it
const showPager = ScrollTrigger.create({
    trigger: '.frame',
    start: 'bottom top',
    onEnter: () => setPagerVisible(true),
    onLeaveBack: () => setPagerVisible(false),
});
const syncPager = () => setPagerVisible(showPager.scroll() > showPager.start);
syncPager();
ScrollTrigger.addEventListener('refresh', syncPager);

// the variation whose top has passed the middle of the screen is marked; the
// last one stays marked down to the end of the page, and none above the first
const pagerLinks = [...pager.querySelectorAll('a')];
const markCurrent = id => {
    pagerLinks.forEach(link => {
        if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
    });
};
document.querySelectorAll('[data-variation]').forEach((section, index) => {
    const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => markCurrent(section.id),
        onEnterBack: () => markCurrent(section.id),
        onLeaveBack: () => index === 0 && markCurrent(null),
    });
    if (trigger.scroll() > trigger.start) markCurrent(section.id);
});

// In-page links (the variation numbers, back to top) go through the smoother too
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', ev => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        ev.preventDefault();
        // a variation stops with its heading just under the bar of numbers
        const offset = target.matches('[data-variation]') ? pager.offsetTop + pager.offsetHeight + 12 : 0;
        if (smoother) smoother.scrollTo(target, true, `top ${offset}px`);
        else window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY - offset});
        // keyboard focus and the address follow
        target.tabIndex = -1;
        isLinkFocus = true;
        target.focus({preventScroll: true});
        isLinkFocus = false;
        history.pushState(null, '', link.getAttribute('href'));
    });
});

// Every effect built so far, measured again whenever the layout changes
const effects = [];
ScrollTrigger.addEventListener('refresh', () => effects.forEach(effect => effect.refresh()));

// Each text block in a section, the small one and the big one, runs the
// section's effect on its own. A block plays when its top is a fifth of the
// way up the screen, and plays again only once it has left the screen and
// comes back. A click on a block plays it any time; the Replay button plays them all.
const setUpBlock = (Effect, block) => {
    const effect = new Effect(block);
    effects.push(effect);

    if (reducedMotion) {
        effect.show();
        return effect;
    }

    let isArmed = true;
    effect.replay = () => {
        isArmed = false;
        effect.play();
    };
    const playIfArmed = () => {
        if (isArmed) effect.replay();
    };
    const rearm = () => {
        isArmed = true;
        effect.reset();
    };

    const playZone = ScrollTrigger.create({
        trigger: block,
        start: 'top 80%',
        end: 'bottom 35%',
        onEnter: playIfArmed,
        onEnterBack: playIfArmed,
    });
    // a block built while it's already in view plays straight away
    if (playZone.isActive) playIfArmed();

    ScrollTrigger.create({
        trigger: block,
        start: 'top bottom',
        end: 'bottom top',
        onLeave: rearm,
        onLeaveBack: rearm,
    });

    block.addEventListener('click', effect.replay);
    return effect;
};

const setUpVariation = section => {
    const Effect = variations[section.dataset.variation];
    const replay = section.querySelector('.variation__replay');
    const blocks = [...section.querySelectorAll('.variation__text')].map(block => setUpBlock(Effect, block));

    if (reducedMotion) {
        replay.hidden = true;
        return;
    }
    replay.addEventListener('click', () => blocks.forEach(effect => effect.replay()));
};

// Building a section's effects takes a moment. So the hero starts on its
// own, and the sections are built afterwards, one at a time in the page's
// idle moments while it's still, or at once when the visitor scrolls within
// two screens of one
const build = section => {
    if (section.dataset.built !== undefined) return;
    section.dataset.built = '';
    setUpVariation(section);
};

const whenIdle = callback =>
    window.requestIdleCallback ? window.requestIdleCallback(callback, {timeout: 1000}) : setTimeout(callback, 50);

// When the visitor last scrolled; the page keeps moving for about a second
// after, as the smooth scroll catches up
let lastScroll = -Infinity;
window.addEventListener('scroll', () => (lastScroll = performance.now()), {passive: true});
const STILL = 1000;

const buildInTurn = sections => {
    const next = sections.find(section => section.dataset.built === undefined);
    if (!next) return;
    // not while the page is moving: try again once it's been still a moment
    const wait = STILL - (performance.now() - lastScroll);
    if (wait > 0) {
        setTimeout(() => whenIdle(() => buildInTurn(sections)), wait);
        return;
    }
    build(next);
    whenIdle(() => buildInTurn(sections));
};

// Split only once the fonts are in, so every character is measured in its real font
document.fonts.ready.then(() => {
    const hero = new Hero(document.querySelector('.hero'), {reducedMotion});
    const sections = [...document.querySelectorAll('[data-variation]')];

    sections.forEach(section => {
        const near = ScrollTrigger.create({
            trigger: section,
            start: 'top 200%',
            once: true,
            onEnter: () => build(section),
        });
        // near the screen already, as after a reload partway down the page
        if (near.isActive) build(section);
    });

    gsap.delayedCall(hero.timeline?.duration() ?? 0, () => whenIdle(() => buildInTurn(sections)));
});
