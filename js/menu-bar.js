// @ts-check
// Menu Bar: marks the menu title of the Section being read, so visitors always know where they are.
// The menu titles are plain links to each Section, so moving between Sections, and focusing the
// Section moved to, is the browser's own fragment navigation. This script follows the reading, and
// makes a move chosen from the Menu Bar a glide that marks the chosen Section from the start.

/**
 * The Section a URL fragment such as "#about" names, if any. A mistyped or truncated fragment such as
 * "#%E0" names none, rather than stopping the script.
 * @param {string} hash
 */
function sectionNamedBy(hash) {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    return null
  }
}

/** Each menu title with the Section it moves to, in reading order. Titles without a Section are left alone. */
const menu = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('.menu-bar__title')]).flatMap((title) => {
  const section = sectionNamedBy(title.hash)
  return section ? [{ title, section }] : []
})
const sections = menu.map(({ section }) => section)
const macWindowTitleBar = /** @type {HTMLElement} */ (document.querySelector('.mac-window__title-bar'))
const macWindowContent = /** @type {HTMLElement} */ (document.querySelector('.mac-window__content'))

/** How long scrolling must pause before a move to a chosen Section counts as over. */
const MOVE_SETTLE_MS = 150

/** Whether the menu titles are due to be marked on the next animation frame. */
let markRequested = false
/** @type {HTMLElement | null} the Section chosen from the Menu Bar, marked until the move there is over */
let chosenSection = null
let moveSettleTimer = 0

/**
 * The Section a visitor is reading: the one they just chose from the Menu Bar while they move to it;
 * otherwise the last one whose top has passed a third of the way down the part of the Mac Window they
 * can see, or before any has, the first. (The last Section is tall enough to reach that line.)
 */
function sectionBeingRead() {
  if (chosenSection) return chosenSection
  // The Mac Window's title bar stays put above its content, as does the Menu Bar above it.
  const top = macWindowTitleBar.getBoundingClientRect().bottom
  const bottom = Math.min(macWindowContent.getBoundingClientRect().bottom, window.innerHeight)
  const line = top + (bottom - top) / 3
  const passed = sections.filter((section) => section.getBoundingClientRect().top <= line)
  return passed[passed.length - 1] ?? sections[0]
}

function markSectionBeingRead() {
  markRequested = false
  const current = sectionBeingRead()
  for (const { title, section } of menu) {
    if (section === current) title.setAttribute('aria-current', 'location')
    else title.removeAttribute('aria-current')
  }
}

// Scrolls only ask for the marking; it happens once per animation frame however many scrolls arrive.
function requestMark() {
  if (markRequested) return
  markRequested = true
  requestAnimationFrame(markSectionBeingRead)
}

// A move to a chosen Section is over once scrolling pauses; then gliding stops and the marking follows
// the reading again.
function holdChosenSectionUntilMoveSettles() {
  window.clearTimeout(moveSettleTimer)
  moveSettleTimer = window.setTimeout(() => {
    chosenSection = null
    document.documentElement.classList.remove('gliding-to-section')
    requestMark()
  }, MOVE_SETTLE_MS)
}

// Choosing a menu title glides to its Section, past the Sections in between. Marking the chosen one
// straight away keeps the Menu Bar from flickering through them. (Pressing Enter on a title clicks it too.)
for (const { title, section } of menu) {
  title.addEventListener('click', (event) => {
    // A click with a modifier key opens the Section in a new tab or window: nothing moves here.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    document.documentElement.classList.add('gliding-to-section')
    chosenSection = section
    markSectionBeingRead()
    holdChosenSectionUntilMoveSettles()
  })
}

// A link straight to a Section opens at it: the browser jumps there once the page has loaded. Until that
// jump settles, the linked Section is the one marked, rather than whatever the page shows on its way there.
const linkedSection = menu.find(({ section }) => section === sectionNamedBy(window.location.hash))
if (linkedSection) {
  chosenSection = linkedSection.section
  window.addEventListener('load', holdChosenSectionUntilMoveSettles)
}

// The Mac Window scrolls on large screens and the page scrolls on phones. Scroll events don't bubble,
// so one capturing listener hears both.
document.addEventListener(
  'scroll',
  () => {
    if (chosenSection) holdChosenSectionUntilMoveSettles()
    requestMark()
  },
  { capture: true, passive: true },
)
window.addEventListener('resize', requestMark)
markSectionBeingRead()
