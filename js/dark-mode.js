// @ts-check
// Dark Mode: the Mac Desktop drawn inverted, white on black. It follows the visitor's system setting until
// they choose otherwise with the Menu Bar's Dark Mode control, a choice remembered for later visits. Choosing
// what the system is set to forgets the choice, so the page follows the system again.
//
// The stylesheet follows the system setting on its own; this script marks the page with data-dark-mode only
// while the visitor's choice overrides it. It runs before the page is first drawn, so a remembered choice
// shows from the first frame.

/** Where the browser remembers that this visitor turned Dark Mode on or off. */
const DARK_MODE_KEY = 'isaac-dobson-portfolio:dark-mode'

/** Whether the visitor's system is set to dark. */
const systemSetToDark = matchMedia('(prefers-color-scheme: dark)')

/**
 * The visitor's choice of Dark Mode, if they made one on an earlier visit. Storage that is blocked means none.
 * @returns {'on' | 'off' | undefined}
 */
function darkModeRemembered() {
  try {
    const choice = window.localStorage.getItem(DARK_MODE_KEY)
    return choice === 'on' || choice === 'off' ? choice : undefined
  } catch {
    return undefined
  }
}

/**
 * Remembers the visitor's choice of Dark Mode, or forgets it, where the browser lets it.
 * @param {'on' | 'off' | undefined} choice
 */
function rememberDarkMode(choice) {
  try {
    if (choice) window.localStorage.setItem(DARK_MODE_KEY, choice)
    else window.localStorage.removeItem(DARK_MODE_KEY)
  } catch {
    // Storage is blocked or full: the choice holds for this visit only.
  }
}

/** @type {'on' | 'off' | undefined} the visitor's choice, overriding the system setting, if they made one */
let darkModeChoice = darkModeRemembered()

/** Whether Dark Mode is on now. */
function darkModeOn() {
  return darkModeChoice ? darkModeChoice === 'on' : systemSetToDark.matches
}

/** Shows Dark Mode as it is now: on the page, and in the Dark Mode control once the page has it. */
function showDarkMode() {
  const page = document.documentElement
  if (darkModeChoice) page.dataset.darkMode = darkModeChoice
  else delete page.dataset.darkMode
  document.querySelector('.menu-bar__dark-mode-toggle')?.setAttribute('aria-pressed', String(darkModeOn()))
}

/** Turns Dark Mode the other way, remembering the choice unless it is what the system is set to. */
function toggleDarkMode() {
  const on = !darkModeOn()
  darkModeChoice = on === systemSetToDark.matches ? undefined : on ? 'on' : 'off'
  rememberDarkMode(darkModeChoice)
  showDarkMode()
}

showDarkMode()
systemSetToDark.addEventListener('change', showDarkMode)

// The Menu Bar's Dark Mode control is offered, on every screen, once this script can turn it.
document.addEventListener('DOMContentLoaded', () => {
  const control = /** @type {HTMLElement} */ (document.querySelector('.menu-bar__dark-mode'))
  control.querySelector('button')?.addEventListener('click', toggleDarkMode)
  showDarkMode()
  control.hidden = false
})
