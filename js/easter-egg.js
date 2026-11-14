// @ts-check
// Easter Egg: the hidden About This Mac window, opened from the first menu of the Menu Bar.
// It is a modal dialog, so while it is open keyboard and screen-reader visitors stay inside it and
// Escape closes it, as does its close box. Closing it returns focus to the Menu Bar, where it was opened.

const easterEggMenu = /** @type {HTMLElement} */ (document.querySelector('.menu-bar__easter-egg'))
const easterEggOpener = /** @type {HTMLButtonElement} */ (easterEggMenu.querySelector('.menu-bar__easter-egg-opener'))
const easterEgg = /** @type {HTMLDialogElement} */ (document.querySelector('.easter-egg'))
const easterEggCloseBox = /** @type {HTMLButtonElement} */ (easterEgg.querySelector('.easter-egg__close-box'))

easterEggOpener.addEventListener('click', () => easterEgg.showModal())
easterEggCloseBox.addEventListener('click', () => easterEgg.close())

/**
 * Whether a point in the window lies outside the About This Mac window, on the portfolio behind it.
 * @param {MouseEvent} event
 */
function outsideEasterEgg({ clientX, clientY }) {
  const box = easterEgg.getBoundingClientRect()
  return clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom
}

/** Whether the latest press began outside the window, rather than, say, selecting its text. */
let pressedOutsideEasterEgg = false

// A click on the portfolio behind closes the window, so it never blocks the portfolio. While the window
// is open the portfolio is inert, so such clicks land on the window's own element, by way of its backdrop.
// A drag that only ends outside, such as a text selection, leaves it open.
easterEgg.addEventListener('pointerdown', (event) => {
  pressedOutsideEasterEgg = event.target === easterEgg && outsideEasterEgg(event)
})
easterEgg.addEventListener('click', (event) => {
  if (pressedOutsideEasterEgg && event.target === easterEgg && outsideEasterEgg(event)) easterEgg.close()
})
// However it closes, visitors carry on from the Menu Bar. (Safari doesn't focus a button it clicks, so
// the browser alone wouldn't return focus there.)
easterEgg.addEventListener('close', () => easterEggOpener.focus())

// The Menu Bar offers the Easter Egg only once this script can open it, in a browser that can open
// modal dialogs (Safari before 15.4 can't).
if (typeof easterEgg.showModal === 'function') easterEggMenu.hidden = false
