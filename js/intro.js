// @ts-check
// Intro: boots an original compact Macintosh in 3D (js/intro-scene.js), enters its screen until it is the
// visitor's whole screen, the Mac Desktop, and types Isaac's name and Headline in the Mac Window. Where it
// can't play, the Short Boot plays instead. Every way through it, played out or skipped, ends in the same
// ready state: the page exactly as it is without this script.
//
// This script runs before the page is first drawn, so the Intro covers the portfolio from the first frame.
// It marks the page with data-intro, the kind of Intro playing, and the stylesheet shows the Intro only then.

/**
 * @typedef {'full' | 'short'} IntroKind the full Intro for a first visit, or the Short Boot for a return, or
 *   in place of a full Intro that can't play
 */

const root = document.documentElement

/** Where the browser remembers that this visitor has seen the full Intro, so later visits get the Short Boot. */
const INTRO_SEEN_KEY = 'isaac-dobson-portfolio:intro-seen'

/** Whether this visitor has seen the full Intro before. Storage that is blocked or unavailable means a first visit. */
function hasSeenIntro() {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === 'yes'
  } catch {
    return false
  }
}

/** Forgets that this visitor has seen the full Intro, so the next visit plays it as a first one does. */
function forgetIntroSeen() {
  try {
    window.localStorage.removeItem(INTRO_SEEN_KEY)
  } catch {
    // Storage is blocked: every visit is treated as a first one already.
  }
}

/** Remembers that this visitor has seen the full Intro, where the browser lets it. */
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
  // Only the full Intro, played out or skipped, counts as seen: after a Short Boot that played in its place,
  // the next visit tries it again.
  const sawFullIntro = root.dataset.intro === 'full'
  stopIntro.abort()
  for (const animation of introAnimations) animation.cancel()
  for (const cleanup of introCleanups) cleanup()
  delete root.dataset.intro
  delete root.dataset.introPhase
  if (sawFullIntro) rememberIntroSeen()
}

/**
 * Prepares a line of the ready title to be typed: its text stays in place, unseen, for assistive
 * technology and for layout, while a decorative copy over it shows only what has been typed so far.
 * @param {HTMLElement} line
 * @param {string} testId
 * @param {{ caretShown?: boolean }} [options] caretShown: the caret shows from now on, before typing starts
 */
function prepareTyping(line, testId, { caretShown = false } = {}) {
  const text = line.textContent ?? ''
  const echo = document.createElement('span')
  echo.className = 'intro-typing__echo'
  echo.setAttribute('aria-hidden', 'true')
  const typed = document.createElement('span')
  typed.dataset.testid = testId
  const caret = document.createElement('span')
  caret.className = 'intro-typing__caret'
  caret.hidden = !caretShown
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
function introStage() {
  return /** @type {HTMLElement} */ (document.querySelector('.intro__stage'))
}

/** The original smiling computer that greets the visitor as a screen starts up. */
function happyComputer() {
  return /** @type {SVGSVGElement} */ (document.querySelector('.intro__happy-computer'))
}

/** The Mac Desktop, the visitor's whole screen once the Intro has entered it. */
function macDesktop() {
  return /** @type {HTMLElement} */ (document.querySelector('.mac-desktop'))
}

/** Announces that a screen powers on: js/sound.js rings the Startup Chime then, for visitors who turned sound on. */
function announcePowerOn() {
  document.dispatchEvent(new Event('intro:power-on'))
}

/** The artwork fades away, showing the portfolio on the Mac Desktop. */
function fadeIntoPortfolio() {
  return play(introStage(), [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in' })
}

/** The Short Boot: the visitor's own dark screen powers on with a flicker and opens straight onto the portfolio. */
async function playShortBoot() {
  const glass = /** @type {HTMLElement} */ (document.querySelector('.intro__boot-screen .intro__glass'))
  await pause(150)
  announcePowerOn()
  await play(glass, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 0.8 }, { opacity: 0.1 }, { opacity: 0 }], {
    duration: 450,
  })
  // The smiling computer greets the visitor while it starts up.
  await play(happyComputer(), [{ opacity: 1 }], { duration: 0 })
  await pause(700)
  await play(happyComputer(), [{ opacity: 0 }], { duration: 0 })
  await fadeIntoPortfolio()
  finishIntro()
}

/**
 * Whether this browser can draw the full Intro's 3D scene: three.js draws with WebGL 2. Asking makes a
 * WebGL context, released straight away.
 */
function canDrawScene() {
  const context = document.createElement('canvas').getContext('webgl2')
  context?.getExtension('WEBGL_lose_context')?.loseContext()
  return context !== null
}

/** How long a first-time visitor waits in the dark for the 3D scene before the Short Boot plays instead. */
const SCENE_WAIT_MS = 2000

/**
 * Loads three.js and builds the full Intro's 3D scene while the visitor waits in the dark, for SCENE_WAIT_MS
 * at most. A scene given up on, because it was too slow or the Intro ended, stops being built, and a scene
 * already built is released when the Intro ends.
 * @returns the scene, ready to power on, or nothing if it failed to load or wasn't ready in time
 */
async function loadScene() {
  const sceneAbandoned = new AbortController()
  const abandonScene = () => sceneAbandoned.abort()
  stopIntro.signal.addEventListener('abort', abandonScene, { once: true })
  const loading = import('./intro-scene.js')
    .then(({ createIntroScene }) =>
      createIntroScene(introStage(), { happyComputer: happyComputer(), macDesktop: macDesktop() }, sceneAbandoned.signal),
    )
    .catch((error) => {
      if (!sceneAbandoned.signal.aborted) {
        console.warn('The 3D Intro failed to load, so the Short Boot plays instead.', error)
      }
    })
  const scene = await Promise.race([loading, pause(SCENE_WAIT_MS).then(() => undefined)])
  if (!scene) abandonScene()
  return scene
}

/**
 * The full Intro: in a dark room, the 3D Macintosh's screen powers on and shows the Mac Desktop, the view
 * lands on it as large as the live page and the screen crossfades into the page, and Isaac's name and
 * Headline are typed into the Mac Window before the rest of the portfolio appears.
 */
async function playFullIntro() {
  const name = /** @type {HTMLElement} */ (document.querySelector('.ready-title__name'))
  const headline = /** @type {HTMLElement} */ (document.querySelector('.ready-title__headline'))
  const restOfMacWindow = document.querySelectorAll('.mac-window__content > :not(.ready-title)')

  // Only now, and only where it can be drawn, is three.js loaded. Where the scene can't play, the Short Boot
  // plays instead.
  const scene = canDrawScene() ? await loadScene() : undefined
  if (!scene) {
    root.dataset.intro = 'short'
    return playShortBoot()
  }
  await pause(300)

  // The screen powers on, lighting the room, and the smiling computer greets the visitor: about a second from
  // darkness. Then the view swings round and moves in for about three seconds, and on its way the screen
  // shows the Mac Desktop they are about to enter: the Menu Bar, and the Mac Window, empty but for a caret.
  await scene.powerOn(announcePowerOn)
  await pause(250)
  await Promise.all([scene.enter(3000), pause(400).then(() => scene.showMacDesktop())])

  // The screen crossfades into the page, the Mac Window open and empty but for the caret the view landed on,
  // and Isaac's name and the Headline are typed into it.
  const typeName = prepareTyping(name, 'typed-name', { caretShown: true })
  const typeHeadline = prepareTyping(headline, 'typed-headline')
  root.dataset.introPhase = 'typing'
  await fadeIntoPortfolio()
  scene.release()
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

/**
 * Restarts the Macintosh: the portfolio opens again as on a first visit, at its start rather than at any
 * Section linked to, so the full Intro plays. Playing it out, or skipping it, remembers it as seen again.
 */
function restart() {
  forgetIntroSeen()
  window.location.replace(window.location.pathname + window.location.search)
}

/**
 * Windows too narrow for the Menu Bar to hold Restart beside the Sections, such as a phone's. There, the
 * Restart at the end of the Mac Window stands in for it.
 */
const menuBarTooNarrowForRestart = matchMedia('(max-width: 30rem)')

// Restart is offered only once this script can play the Intro, and only to visitors who don't prefer
// reduced motion, who never see an Intro. Each offer is hidden with the hidden attribute, which
// js/intro-scene.js follows as it draws the Menu Bar on the 3D Macintosh's screen.
document.addEventListener('DOMContentLoaded', () => {
  const restartControls = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.restart-control')])
  for (const control of restartControls) control.querySelector('button')?.addEventListener('click', restart)
  const offerRestart = () => {
    for (const control of restartControls) {
      const noRoom = control.matches('.menu-bar__restart') && menuBarTooNarrowForRestart.matches
      control.hidden = reducedMotion.matches || noRoom
    }
  }
  reducedMotion.addEventListener('change', offerRestart)
  menuBarTooNarrowForRestart.addEventListener('change', offerRestart)
  offerRestart()
})

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
