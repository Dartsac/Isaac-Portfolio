// @ts-check
// Time Machine: shows the full-color source behind each 1-bit image.
// A mouse or pen gets a lens that follows the pointer. Clicking or tapping an image, or
// pressing its Full color toggle, shows the whole image in full color until done again.
// Images inside a [data-time-machine-group] change together, with one toggle for all of them.
// Full color forwards an image to present-day viewing: crisp, with none of the CRT Effects over it.

const timeMachineFrames = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.time-machine')])
const imageGroups = new Set(timeMachineFrames.map((frame) => frame.closest('[data-time-machine-group]') ?? frame))

const crtEffects = /** @type {HTMLElement | null} */ (document.querySelector('.crt'))
const windowContent = /** @type {HTMLElement | null} */ (document.querySelector('.mac-window__content'))
const windowTitleBar = document.querySelector('.mac-window__title-bar')
let crtUpdateRequested = false

function requestCrtUpdate() {
  if (crtUpdateRequested) return
  crtUpdateRequested = true
  requestAnimationFrame(clearCrtOverFullColor)
}

// Cuts a hole in the CRT Effects over each image shown in full color, where it shows in the Mac Window:
// not under its title bar, nor, on a phone, under the Menu Bar stuck above it. Those keep their effects.
function clearCrtOverFullColor() {
  crtUpdateRequested = false
  if (!crtEffects || !windowContent) return
  const fullColorFrames = timeMachineFrames.filter((frame) => frame.classList.contains('time-machine--full-color'))
  if (fullColorFrames.length === 0) {
    crtEffects.style.removeProperty('clip-path')
    return
  }

  // A hole's edge is blended with the effects around it, about a pixel wide. So each hole reaches past the
  // picture onto the black rule around it, the frame's border or the Mac Window's, where the blend can't be
  // seen, and the whole picture shows crisp.
  const rule = timeMachineFrames[0].clientLeft

  // The CRT Effects cover the browser window from its top-left corner. The window is measured, not the
  // effects, which may be out of sight a moment, and both ways, so a pinch-zoomed phone's isn't too small.
  const screen = {
    width: Math.max(innerWidth, document.documentElement.clientWidth),
    height: Math.max(innerHeight, document.documentElement.clientHeight),
  }

  // The part of the Mac Window's content on screen, and the rule around it: inside its scrollbar, and
  // reaching onto the bottom of its title bar.
  const content = windowContent.getBoundingClientRect()
  const contentLeft = content.left + windowContent.clientLeft
  const contentTop = content.top + windowContent.clientTop
  const shown = {
    left: Math.max(contentLeft - rule, 0),
    top: Math.max(Math.max(contentTop, windowTitleBar?.getBoundingClientRect().bottom ?? -Infinity) - rule, 0),
    right: Math.min(contentLeft + windowContent.clientWidth, screen.width),
    bottom: Math.min(contentTop + windowContent.clientHeight + rule, screen.height),
  }

  // Each frame, out to its border's edge, as much of it as shows; drawn around clockwise, from the screen's corner.
  const holes = fullColorFrames.flatMap((frame) => {
    const box = frame.getBoundingClientRect()
    const left = Math.max(box.left, shown.left)
    const top = Math.max(box.top, shown.top)
    const right = Math.min(box.right, shown.right)
    const bottom = Math.min(box.bottom, shown.bottom)
    return right > left && bottom > top ? [`M${left} ${top}H${right}V${bottom}H${left}Z`] : []
  })
  // The whole screen, less the holes: even-odd filling leaves out whatever lies inside it twice.
  const outline = `M0 0H${screen.width}V${screen.height}H0Z`
  crtEffects.style.setProperty('clip-path', `path(evenodd, '${outline}${holes.join('')}')`)
}

// The holes follow the images as the Mac Window or the page scrolls, and as the screen changes size.
window.addEventListener('resize', requestCrtUpdate)
if (windowContent) new ResizeObserver(requestCrtUpdate).observe(windowContent)

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
    requestCrtUpdate()
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
    requestCrtUpdate()
  },
  { capture: true, passive: true },
)
