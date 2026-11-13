// @ts-check
// Time Machine: shows the full-color source behind each 1-bit image.
// A mouse or pen gets a lens that follows the pointer. Clicking or tapping an image, or
// pressing its Full color toggle, shows the whole image in full color until done again.
// Images inside a [data-time-machine-group] change together, with one toggle for all of them.

const timeMachineFrames = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.time-machine')])
const imageGroups = new Set(timeMachineFrames.map((frame) => frame.closest('[data-time-machine-group]') ?? frame))

/** Where the mouse or pen last moved over a frame, in window coordinates, so the lens can follow it through scrolling. */
let lensPointer = { clientX: 0, clientY: 0 }

// Pointer moves and scrolls only record what happened; the lenses move once per animation frame,
// reading layout before writing styles, so a fast mouse or pen doesn't force a layout per event.
/** @type {HTMLElement | null} the frame the mouse or pen moved over since the last lens update */
let pointerMovedOver = null
/** Whether anything scrolled since the last lens update. */
let scrolledSinceLensUpdate = false
let lensUpdateRequested = false

/**
 * Centers the lens, and so the reveal, on a point in the window.
 * @param {HTMLElement} frame
 * @param {number} clientX
 * @param {number} clientY
 */
function aimLens(frame, clientX, clientY) {
  const box = frame.getBoundingClientRect()
  frame.style.setProperty('--lens-x', `${clientX - box.left - frame.clientLeft}px`)
  frame.style.setProperty('--lens-y', `${clientY - box.top - frame.clientTop}px`)
}

function requestLensUpdate() {
  if (lensUpdateRequested) return
  lensUpdateRequested = true
  requestAnimationFrame(updateLenses)
}

// Shows the lens on the frame the pointer moved over. After a scroll, each lens follows the pointer
// to its new spot in the image, or hides if the image left the pointer.
function updateLenses() {
  lensUpdateRequested = false
  const { clientX, clientY } = lensPointer
  const lensFrames = new Set(
    scrolledSinceLensUpdate ? timeMachineFrames.filter((frame) => frame.classList.contains('time-machine--lensing')) : [],
  )
  if (pointerMovedOver) lensFrames.add(pointerMovedOver)
  const pointerChecked = scrolledSinceLensUpdate && lensFrames.size > 0
  const underPointer = pointerChecked ? document.elementFromPoint(clientX, clientY) : null
  pointerMovedOver = null
  scrolledSinceLensUpdate = false

  // Read every lens position first, then write them all.
  const aims = [...lensFrames].map((frame) => {
    if (pointerChecked && !(underPointer && frame.contains(underPointer))) return { frame, lens: null }
    const box = frame.getBoundingClientRect()
    return { frame, lens: { x: clientX - box.left - frame.clientLeft, y: clientY - box.top - frame.clientTop } }
  })
  for (const { frame, lens } of aims) {
    if (!lens) {
      frame.classList.remove('time-machine--lensing')
      continue
    }
    frame.style.setProperty('--lens-x', `${lens.x}px`)
    frame.style.setProperty('--lens-y', `${lens.y}px`)
    frame.classList.add('time-machine--lensing')
  }
}

for (const imageGroup of imageGroups) {
  const groupFrames = timeMachineFrames.filter((frame) => imageGroup.contains(frame))
  // A group without a toggle still gets its lens and click-to-reveal.
  const toggle = imageGroup.querySelector('.time-machine__toggle')

  const groupInFullColor = () => groupFrames[0].classList.contains('time-machine--full-color')
  /** @param {boolean} showFullColor every image in the group in full color, or every one in 1-bit */
  const showGroup = (showFullColor) => {
    toggle?.setAttribute('aria-pressed', String(showFullColor))
    for (const frame of groupFrames) frame.classList.toggle('time-machine--full-color', showFullColor)
  }

  if (toggle instanceof HTMLElement) {
    toggle.hidden = false
    toggle.addEventListener('click', () => {
      const showFullColor = !groupInFullColor()
      // The toggle isn't a point on any image, so the reveal grows from each image's center.
      if (showFullColor) {
        for (const frame of groupFrames) {
          frame.style.setProperty('--lens-x', '50%')
          frame.style.setProperty('--lens-y', '50%')
        }
      }
      showGroup(showFullColor)
    })
  }

  for (const frame of groupFrames) {
    frame.addEventListener('click', (event) => {
      // A click on the toggle is the toggle's own.
      if (toggle && event.target instanceof Node && toggle.contains(event.target)) return
      // A double-click acts as one click: its later clicks (detail 2 and up) don't flip the group back.
      if (event.detail > 1) return
      // A click reveals from where it landed; a synthetic click (detail 0) has no point, so from where the lens last was.
      if (event.detail > 0) aimLens(frame, event.clientX, event.clientY)
      showGroup(!groupInFullColor())
    })

    frame.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return
      lensPointer = { clientX: event.clientX, clientY: event.clientY }
      pointerMovedOver = frame
      requestLensUpdate()
    })

    frame.addEventListener('pointerleave', () => {
      if (pointerMovedOver === frame) pointerMovedOver = null
      frame.classList.remove('time-machine--lensing')
    })
  }
}

// Scrolling the page or the Mac Window moves the images under a still pointer without any pointermove,
// so the lenses update after a scroll too.
// Scroll events don't bubble, so one capturing listener hears every scrolling element.
document.addEventListener(
  'scroll',
  () => {
    scrolledSinceLensUpdate = true
    requestLensUpdate()
  },
  { capture: true, passive: true },
)
