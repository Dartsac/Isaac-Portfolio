// @ts-check
// Intro: boots an original compact Macintosh, zooms into its screen, and types Isaac's name and Headline
// in the Mac Window. Every way through it, played out or skipped, ends in the same ready state: the page
// exactly as it is without this script.
//
// This script runs before the page is first drawn, so the Intro covers the portfolio from the first frame.
// It marks the page with data-intro, the kind of Intro playing, and the stylesheet shows the Intro only then.

/** @typedef {'full' | 'short'} IntroKind the full Intro for a first visit, or the Short Boot for a return */

const root = document.documentElement

/** Where the browser remembers that this visitor has had the Intro, so later visits get the Short Boot. */
const INTRO_SEEN_KEY = 'isaac-dobson-portfolio:intro-seen'

/** Whether this visitor has had the Intro before. Storage that is blocked or unavailable means a first visit. */
function hasSeenIntro() {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === 'yes'
  } catch {
    return false
  }
}

/** Remembers that this visitor has had the Intro, where the browser lets it. */
function rememberIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, 'yes')
  } catch {
    // Storage is blocked or full: the next visit is simply treated as a first one.
  }
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/**
 * Whether the page was opened from a link straight to a Section. Like the Menu Bar's sectionNamedBy, it
 * reads the fragment as js/menu-bar.js does, but runs earlier, so it can't share that script's copy.
 */
function linkedStraightToSection() {
  try {
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    return Boolean(target?.matches('.section'))
  } catch {
    // A mistyped or truncated fragment, such as "#%E0", names nothing.
    return false
  }
}

/**
 * Chooses the Intro for this visit, if any. Visitors who prefer reduced motion get the ready state straight
 * away, however often they have visited. Otherwise a first visit gets the full Intro, and a return the
 * Short Boot.
 */
function chooseIntro() {
  if (reducedMotion.matches) return
  /** @type {IntroKind} */
  const kind = hasSeenIntro() ? 'short' : 'full'
  root.dataset.intro = kind
}

// A visitor following a link to a Section came for that Section: it opens right there, with no Intro.
// Nothing of the Intro was seen, so their next visit to the portfolio itself still gets all of it. Whether
// a link names a Section can only be told once the page is read, so only then is its Intro chosen.
if (!window.location.hash) chooseIntro()
else document.addEventListener('DOMContentLoaded', () => linkedStraightToSection() || chooseIntro())

/** Stops the Intro wherever it has got to. */
const stopIntro = new AbortController()

/** @type {Animation[]} every animation the Intro has started, so ending it can undo them all */
const introAnimations = []

/** @type {(() => void)[]} undoes each change the Intro made to the portfolio itself */
const introCleanups = []

/**
 * Animates an element as part of the Intro, holding its last frame until the Intro ends.
 * @param {Element} element
 * @param {Keyframe[]} keyframes
 * @param {KeyframeAnimationOptions} options
 */
function play(element, keyframes, options) {
  const animation = element.animate(keyframes, { fill: 'forwards', ...options })
  introAnimations.push(animation)
  return animation.finished
}

/**
 * Waits, unless the Intro ends first.
 * @param {number} ms
 */
function pause(ms) {
  return new Promise((resolve, reject) => {
    const signal = stopIntro.signal
    if (signal.aborted) return reject(signal.reason)
    const stop = () => {
      window.clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', stop)
      resolve(undefined)
    }, ms)
    signal.addEventListener('abort', stop, { once: true })
  })
}

/** Ends the Intro, played out or not: every trace of it is undone, leaving the page in its ready state. */
function finishIntro() {
  if (stopIntro.signal.aborted) return
  stopIntro.abort()
  for (const animation of introAnimations) animation.cancel()
  for (const cleanup of introCleanups) cleanup()
  delete root.dataset.intro
  delete root.dataset.introPhase
  rememberIntroSeen()
}

/**
 * Where elements sit on screen without a transform.
 * @param {HTMLElement} transformed the element whose transform to set aside
 * @param {Element[]} elements it, or things inside it
 */
function untransformedBoxes(transformed, elements) {
  const transform = transformed.style.transform
  transformed.style.transform = 'none'
  const boxes = elements.map((element) => element.getBoundingClientRect())
  transformed.style.transform = transform
  return boxes
}

/**
 * The transform that zooms the Intro's Macintosh until its screen covers the portfolio's own screen: on
 * large screens the Macintosh's screen, and on phones, where the Macintosh steps aside, the whole phone.
 * @param {HTMLElement} macintosh
 * @param {Element} screen the Intro's Macintosh's screen
 */
function zoomedIntoScreen(macintosh, screen) {
  const pageScreen = /** @type {Element} */ (document.querySelector('.macintosh__screen')).getBoundingClientRect()
  const target = pageScreen.width > 0 ? pageScreen : new DOMRect(0, 0, window.innerWidth, window.innerHeight)
  const [frame, from] = untransformedBoxes(macintosh, [macintosh, screen])
  const scale = Math.max(target.width / from.width, target.height / from.height)
  // Scaling about the Macintosh's center, then moving its screen's center onto the target's.
  const center = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
  const x = target.x + target.width / 2 - center.x - scale * (from.x + from.width / 2 - center.x)
  const y = target.y + target.height / 2 - center.y - scale * (from.y + from.height / 2 - center.y)
  return `translate(${x}px, ${y}px) scale(${scale})`
}

/**
 * Prepares a line of the ready title to be typed: its text stays in place, unseen, for assistive
 * technology and for layout, while a decorative copy over it shows only what has been typed so far.
 * @param {HTMLElement} line
 * @param {string} testId
 */
function prepareTyping(line, testId) {
  const text = line.textContent ?? ''
  const echo = document.createElement('span')
  echo.className = 'intro-typing__echo'
  echo.setAttribute('aria-hidden', 'true')
  const typed = document.createElement('span')
  typed.dataset.testid = testId
  const caret = document.createElement('span')
  caret.className = 'intro-typing__caret'
  caret.hidden = true
  const rest = document.createElement('span')
  rest.className = 'intro-typing__rest'
  rest.textContent = text
  echo.append(typed, caret, rest)
  line.classList.add('intro-typing')
  line.append(echo)
  introCleanups.push(() => {
    echo.remove()
    line.classList.remove('intro-typing')
  })

  /**
   * Types the line one character at a time.
   * @param {number} msPerCharacter
   */
  return async function typeOut(msPerCharacter) {
    caret.hidden = false
    for (let length = 1; length <= text.length; length++) {
      await pause(msPerCharacter)
      typed.textContent = text.slice(0, length)
      rest.textContent = text.slice(length)
    }
    caret.hidden = true
  }
}

/** The Intro's artwork, drawn over the portfolio while the Intro plays. */
function introArtwork() {
  return {
    stage: /** @type {HTMLElement} */ (document.querySelector('.intro__stage')),
    macintosh: /** @type {HTMLElement} */ (document.querySelector('.intro__macintosh')),
    screen: /** @type {HTMLElement} */ (document.querySelector('.intro__screen')),
    glass: /** @type {HTMLElement} */ (document.querySelector('.intro__glass')),
    happyComputer: /** @type {Element} */ (document.querySelector('.intro__happy-computer')),
  }
}

/**
 * The screen powers on with a flicker, and greets the visitor with a smiling computer while it starts up.
 * @param {ReturnType<typeof introArtwork>} artwork
 * @param {number} greetingMs how long the smiling computer shows
 */
async function powerOn({ glass, happyComputer }, greetingMs) {
  await play(glass, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 0.8 }, { opacity: 0.1 }, { opacity: 0 }], {
    duration: 450,
  })
  await play(happyComputer, [{ opacity: 1 }], { duration: 0 })
  await pause(greetingMs)
  await play(happyComputer, [{ opacity: 0 }], { duration: 0 })
}

/**
 * The artwork fades away, showing the portfolio on the Macintosh's screen.
 * @param {ReturnType<typeof introArtwork>} artwork
 */
function fadeIntoPortfolio({ stage }) {
  return play(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in' })
}

/** The Short Boot: the Macintosh, already up close, starts up and opens straight onto the portfolio. */
async function playShortBoot() {
  const artwork = introArtwork()
  const { macintosh, screen } = artwork
  await play(macintosh, [{ transform: zoomedIntoScreen(macintosh, screen) }], { duration: 0 })
  await pause(150)
  await powerOn(artwork, 700)
  await fadeIntoPortfolio(artwork)
  finishIntro()
}

/**
 * The full Intro: the Macintosh boots in the distance, the view zooms into its screen, and Isaac's name
 * and Headline are typed into the Mac Window before the rest of the portfolio appears.
 */
async function playFullIntro() {
  const artwork = introArtwork()
  const { macintosh, screen } = artwork
  const name = /** @type {HTMLElement} */ (document.querySelector('.ready-title__name'))
  const headline = /** @type {HTMLElement} */ (document.querySelector('.ready-title__headline'))
  const restOfMacWindow = document.querySelectorAll('.mac-window__content > :not(.ready-title)')

  // The Macintosh appears in the distance, its screen dark, and starts up.
  await play(macintosh, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' })
  await pause(300)
  await powerOn(artwork, 1300)
  await pause(250)

  // Zoom into its screen, which becomes the portfolio's own, from the distance the stylesheet sets.
  const distant = getComputedStyle(macintosh).transform
  await play(macintosh, [{ transform: distant }, { transform: zoomedIntoScreen(macintosh, screen) }], {
    duration: 1400,
    easing: 'cubic-bezier(0.65, 0, 0.25, 1)',
  })

  // The Mac Window opens, empty but for a caret, and Isaac's name and the Headline are typed into it.
  const typeName = prepareTyping(name, 'typed-name')
  const typeHeadline = prepareTyping(headline, 'typed-headline')
  root.dataset.introPhase = 'typing'
  await fadeIntoPortfolio(artwork)
  await typeName(85)
  await pause(300)
  await typeHeadline(40)
  await pause(400)

  // The rest of the portfolio appears below them.
  await Promise.all(
    [...restOfMacWindow].map((element) => play(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 })),
  )
  finishIntro()
}

document.addEventListener('DOMContentLoaded', () => {
  if (!root.dataset.intro) return
  const intro = /** @type {HTMLElement} */ (document.querySelector('.intro'))
  const skip = /** @type {HTMLButtonElement} */ (document.querySelector('.intro__skip'))
  skip.addEventListener('click', finishIntro)

  // A visitor who reaches into the portfolio itself, tabbing past the skip control or pressing on the
  // Menu Bar while the name is typed, is done with the Intro: it ends rather than hide what they reached.
  /** @param {Event} event */
  const endOnReachingPortfolio = (event) => {
    if (event.target instanceof Node && !intro.contains(event.target)) finishIntro()
  }
  document.addEventListener('focusin', endOnReachingPortfolio)
  document.addEventListener('pointerdown', endOnReachingPortfolio, { capture: true })

  // Asking for reduced motion while the Intro plays ends it.
  reducedMotion.addEventListener('change', finishIntro)

  introCleanups.push(() => {
    document.removeEventListener('focusin', endOnReachingPortfolio)
    document.removeEventListener('pointerdown', endOnReachingPortfolio, { capture: true })
    reducedMotion.removeEventListener('change', finishIntro)
  })

  const playIntro = root.dataset.intro === 'short' ? playShortBoot : playFullIntro
  playIntro().catch((error) => {
    // Ending the Intro early stops it wherever it was: that is not a failure.
    if (!stopIntro.signal.aborted) {
      finishIntro()
      throw error
    }
  })
})
