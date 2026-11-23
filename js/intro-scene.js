// @ts-check
// The full Intro's 3D scene: a Macintosh in a dark room, lit only by its screen. js/intro.js loads this
// module, and three.js with it, only when the full Intro plays, and sets the pace: the screen powers on
// with the smiling computer, then the view swings round from the front right to face the screen while it
// moves in, as the old Lottie's did, and on its way the screen shows the Mac Desktop the visitor is about to
// enter. The view lands where the screen fills the browser window, showing the Mac Desktop as large as the
// live page will.
//
// The Macintosh, its keyboard, and its mouse are original, built here from simple shapes with the
// proportions of the era's compact Macintosh, in grayscale, with no logo, badge, or other Apple-owned detail.
// Nothing is downloaded for them.
import * as THREE from 'three'

// Sizes are in decimeters. The desk is at height 0, and the Macintosh's front faces the view, along +z.

/** The case's size, a compact Macintosh's, and the height of the dark plinth it stands on. */
const CASE = { width: 2.46, height: 3.45, depth: 2.76, plinth: 0.08 }
/** How deep the front bezel is, ahead of the seam that joins it to the rear housing. */
const BEZEL_DEPTH = 0.55
/** The screen's picture, 4:3, and how far its center sits above the case's middle. */
const SCREEN = { width: 1.8, height: 1.35, rise: 0.45 }
/**
 * The tube's glass around the picture, its corners' radius, and how far it sits back in the bezel. It is flat,
 * so the Mac Desktop on it lands as the live page lays it out, with no line bowed.
 */
const GLASS = { width: SCREEN.width * 1.07, height: SCREEN.height * 1.09, radius: 0.08, inset: 0.18 }
/** The opening in the bezel that slopes in to the glass. */
const OPENING = { width: SCREEN.width * 1.16, height: SCREEN.height * 1.22, radius: 0.14 }
/** The keyboard: no keypad, about 15 keys wide, wedge-shaped, rising toward the Macintosh. */
const KEYBOARD = { width: 3.3, depth: 1.45, front: 0.22, back: 0.42, key: 0.19, gap: 0.025 }
/** The keys, row by row from the back, each as wide as so many ordinary keys. */
const KEY_ROWS = [
  [...Array(13).fill(1), 2],
  [1.5, ...Array(12).fill(1), 1.5],
  [1.75, ...Array(11).fill(1), 2.25],
  [2.25, ...Array(10).fill(1), 2.75],
  [1.5, 1.5, 9, 1.5, 1.5],
]
/** The mouse: a low box, longer than it is wide. */
const MOUSE = { width: 0.62, length: 1.05, height: 0.3 }
/** Where the keyboard and mouse sit, how far ahead of the Macintosh's front and to the side. */
const DESK_LAYOUT = { keyboardAhead: 1.2, mouse: { x: 2.2, ahead: 1.15, turn: -0.15 } }

/** Grayscale only: off-white plastic, darker keys and details, a dim desk. */
const GRAYS = { plastic: 0xdcdcdc, keys: 0x6e6e6e, button: 0xa8a8a8, panel: 0xb4b4b4, dark: 0x262626, slot: 0x050505, desk: 0x7c7c7c }

/** The smiling computer's picture, in pixels, as a classic Macintosh's screen would be. */
const SCREEN_PIXELS = { width: 512, height: 384 }
/** The widest the Mac Desktop's picture is drawn, in pixels: as wide as any graphics card can hold. */
const MAX_PICTURE_WIDTH = 4096
/**
 * How many of the drawing's pixels, at least, each of the picture's spans once the view has entered the
 * screen, so it is drawn enlarged, crisp, and never shrunk and smoothed. A little more than one, so that the
 * graphics card never takes it for shrunk.
 */
const CRISP_SCALE = 1.25
/** The most device pixels the scene is drawn with to each CSS pixel, so screens with more draw no slower. */
const MAX_PIXEL_RATIO = 2
/** The caret's size, in ems of the name it stands before, as .intro-typing__caret draws it. */
const CARET = { width: 0.55, height: 1.1 }
/** How long the Mac Window's caret shows, and then hides, as it blinks. */
const CARET_BLINK_MS = 530
/**
 * How much of the screen's picture, across its width or its height, the browser window shows once the view
 * has entered it: a little less than all, so no edge of the Macintosh shows.
 */
const ENTERED_SPAN = 0.95
/**
 * How far below the top of the screen's picture the browser window's top edge is once the view has entered
 * it, as a share of the picture's height: a slight margin, enough to keep the glass around it out of view.
 */
const LANDING_MARGIN = 0.01
/** The view's vertical angle, in degrees. */
const FIELD_OF_VIEW = 35
/**
 * Where the view starts, as the old Lottie's does: low, at the front right of the Macintosh as the visitor faces
 * it, three-quarter on. Its eye's height above the desk, a little below the screen, and how far round it is from
 * straight ahead, in degrees.
 */
const VIEW_START = { height: 1.3, turn: 32 }
/**
 * How much of the view the Macintosh, keyboard, and mouse fill as it starts, across or down from its middle to its
 * edges, whichever they reach first: the dark room frames them.
 */
const START_FILL = 0.85
/**
 * How far through its movement the view has swung round to face the screen square, level with where it lands. From
 * then on it only moves in, so it lands with no angle, tilt, or roll left.
 */
const SWING_ENDS = 0.65
/**
 * How long the view holds back from moving in: the higher, the longer it keeps the Macintosh whole in view while it
 * swings round, and the faster it closes in after, as the old Lottie's did. 1 moves in evenly throughout.
 */
const MOVE_IN_DELAY = 1.5
/** The screen's brightness, from 0, dark, to 1, as it powers on with a flicker, lit from its first frame. */
const FLICKER = [0.8, 0.2, 0.9, 1]
const FLICKER_MS = 450
/** How brightly, at full brightness, the screen lights what is in front of it, the bezel around it, and, off the desk, the case's sides. */
const GLOW = { forward: 9, around: 1.2, bounce: 0.25 }

/**
 * A picture for the screen, transparent: wherever nothing is drawn on it, the screen shows the Mac Desktop's
 * 1-bit pattern in the display's own pixels (see drawPatternInDisplayPixels). Once drawn, makeOneBit makes
 * what is drawn pure black and white.
 * @param {number} width in pixels
 * @param {number} height in pixels
 */
function blankPicture(width, height) {
  const picture = document.createElement('canvas')
  picture.width = width
  picture.height = height
  const context = /** @type {CanvasRenderingContext2D} */ (picture.getContext('2d', { willReadFrequently: true }))
  return { picture, context }
}

/**
 * Whether the live page is in Dark Mode: its 1-bit screen inverted, white ink on black paper.
 * @param {HTMLElement} macDesktop the page's Mac Desktop
 */
function inDarkMode(macDesktop) {
  const macWindow = /** @type {HTMLElement} */ (macDesktop.querySelector('.mac-window'))
  return getComputedStyle(macWindow).backgroundColor === 'rgb(0, 0, 0)'
}

/**
 * Makes a picture pure black and white, even where a browser smoothed the edges of its artwork and text, and
 * leaves what is mostly transparent wholly so, for the screen's pattern. Drawn black on white, as the page's
 * artwork is without its stylesheet, it is inverted in Dark Mode, as the page shows it.
 * @param {CanvasRenderingContext2D} context
 * @param {boolean} darkMode
 */
function makeOneBit(context, darkMode) {
  const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height)
  const { data } = pixels
  for (let i = 0; i < data.length; i += 4) {
    const opaque = data[i + 3] >= 128
    const white = opaque && data[i] + data[i + 1] + data[i + 2] >= 3 * 128
    data.fill(white !== darkMode ? 255 : 0, i, i + 3)
    data[i + 3] = opaque ? 255 : 0
  }
  context.putImageData(pixels, 0, 0)
}

/**
 * Draws a copy of the page's artwork into a picture, as the page shows it: parts the page hides are left out.
 * @param {CanvasRenderingContext2D} context
 * @param {SVGSVGElement} svg
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} [resolution] how many pixels across to draw it in, if not as many as its size
 */
async function drawArtwork(context, svg, x, y, size, resolution = size) {
  const artwork = /** @type {SVGSVGElement} */ (svg.cloneNode(true))
  const liveParts = [svg, ...svg.querySelectorAll('*')]
  ;[artwork, ...artwork.querySelectorAll('*')].forEach((part, i) => {
    if (getComputedStyle(liveParts[i]).display === 'none') part.remove()
  })
  artwork.setAttribute('width', String(Math.round(resolution)))
  artwork.setAttribute('height', String(Math.round(resolution)))
  const image = new Image()
  image.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(artwork))}`
  await image.decode()
  context.drawImage(image, x, y, size, size)
}

/**
 * Draws what the screen shows as it powers on: the smiling computer, on the screen's 1-bit pattern.
 * @param {SVGSVGElement} happyComputer the page's smiling computer
 * @param {boolean} darkMode whether the page is in Dark Mode
 */
async function smilingComputerPicture(happyComputer, darkMode) {
  const { picture, context } = blankPicture(SCREEN_PIXELS.width, SCREEN_PIXELS.height)
  // Five pixels to each of the artwork's 32, so its edges fall on whole pixels, and centered on the screen.
  const size = 32 * 5
  await drawArtwork(context, happyComputer, (picture.width - size) / 2, (picture.height - size) / 2, size)
  makeOneBit(context, darkMode)
  return picture
}

/**
 * The part of the screen's picture the browser window shows once the view has entered it, as shares of the
 * picture's width and height: across, the middle of it; down, from just below its top, so the Mac Desktop's
 * Menu Bar runs along the top of the window.
 * @param {number} aspect the browser window's width over its height
 */
function landingArea(aspect) {
  const screenAspect = SCREEN.width / SCREEN.height
  const width = ENTERED_SPAN * Math.min(1, aspect / screenAspect)
  return { left: (1 - width) / 2, top: LANDING_MARGIN, width, height: (width * screenAspect) / aspect }
}

/**
 * Fills an area of a picture with black or white.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {'#000' | '#fff'} color
 */
function fill(context, x, y, width, height, color) {
  context.fillStyle = color
  context.fillRect(x, y, width, height)
}

/** A live element's text, as it reads. @param {Element} element */
function textOf(element) {
  return element.textContent?.trim() ?? ''
}

/**
 * Whether the live page is in its phone layout, the Mac Window reaching from one edge of the browser window
 * to the other, as on a phone held either way.
 * @param {HTMLElement} macDesktop the page's Mac Desktop
 * @param {number} windowWidth the browser window's width, in CSS pixels
 */
function inPhoneLayout(macDesktop, windowWidth) {
  const box = /** @type {HTMLElement} */ (macDesktop.querySelector('.mac-window')).getBoundingClientRect()
  return box.left <= 0 && box.right >= windowWidth
}

/**
 * A picture with nothing drawn on it, so the screen shows only its pattern, as on a phone once the smiling
 * computer has shown.
 */
function patternOnlyPicture() {
  return blankPicture(16, 12).picture
}

/**
 * Draws what the screen shows once the Macintosh has started: the Mac Desktop the visitor is about to enter,
 * as the page shows it when Isaac's name is about to be typed. Original 1-bit artwork that mirrors the live
 * Mac Desktop: the Menu Bar's titles and controls, which title is selected, the Mac Window's border and title
 * bar, empty below but for the rule and a caret where the name will be typed, inverted in Dark Mode as the page
 * is. Two pictures, so the caret can blink: with it, and without it.
 *
 * It is drawn at the live page's own scale, from where each part of it is on the page, in the part of the
 * picture the browser window shows once the view has entered the screen, so the view lands on it as large as
 * the live page, and the screen crossfades into the page. What reaches the window's edges runs on to the
 * picture's. The pattern is the screen's own, so it is left out.
 *
 * In the live page's phone layout, nothing is drawn: a phone shows only the middle of the 4:3 screen, where the
 * Menu Bar sat cramped. The screen shows only its pattern, and the whole live page appears as it crossfades.
 * @param {HTMLElement} macDesktop the page's Mac Desktop
 * @param {{ width: number, height: number, pixelRatio: number }} browserWindow the browser window's size, in
 *   CSS pixels, and how many of the drawing's pixels it has to each
 */
async function macDesktopPictures(macDesktop, browserWindow) {
  if (inPhoneLayout(macDesktop, browserWindow.width)) {
    const patternOnly = patternOnlyPicture()
    return { withCaret: patternOnly, withoutCaret: patternOnly }
  }
  const landed = landingArea(browserWindow.width / browserWindow.height)
  // As many of the picture's pixels to each CSS pixel as keeps it enlarged, and so crisp, as the view lands,
  // within what any graphics card can hold.
  let scale = browserWindow.pixelRatio / CRISP_SCALE
  let width = Math.round((browserWindow.width * scale) / landed.width)
  if (width > MAX_PICTURE_WIDTH) {
    scale *= MAX_PICTURE_WIDTH / width
    width = MAX_PICTURE_WIDTH
  }
  const height = Math.round((width * SCREEN.height) / SCREEN.width)
  const { picture, context } = blankPicture(width, height)
  const area = { left: landed.left * width, top: landed.top * height }
  // From here on, in the live page's CSS pixels.
  context.setTransform(scale, 0, 0, scale, area.left, area.top)
  const edges = { left: -area.left / scale, top: -area.top / scale, right: (width - area.left) / scale, bottom: (height - area.top) / scale }
  /**
   * Fills an area given in CSS pixels, on whole pixels of the picture, at least one each way, so that lines a
   * CSS pixel thick stay whole when the picture has fewer pixels than the page.
   * @param {number} x @param {number} y @param {number} w @param {number} h @param {'#000' | '#fff'} color
   */
  const fillAt = (x, y, w, h, color) => {
    const [left, top] = [Math.round(area.left + x * scale), Math.round(area.top + y * scale)]
    const right = Math.max(left + 1, Math.round(area.left + (x + w) * scale))
    const bottom = Math.max(top + 1, Math.round(area.top + (y + h) * scale))
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    fill(context, left, top, right - left, bottom - top, color)
    context.restore()
  }
  /**
   * Draws a black border inside an area given in CSS pixels, each side as its own strip, so none is lost to
   * what is filled inside it.
   * @param {DOMRect} box @param {number} thickness
   */
  const outlineAt = (box, thickness) => {
    fillAt(box.left, box.top, box.width, thickness, '#000')
    fillAt(box.left, box.bottom - thickness, box.width, thickness, '#000')
    fillAt(box.left, box.top, thickness, box.height, '#000')
    fillAt(box.right - thickness, box.top, thickness, box.height, '#000')
  }
  const live = (/** @type {string} */ selector) => /** @type {HTMLElement} */ (macDesktop.querySelector(selector))
  const boxOf = (/** @type {Element} */ element) => element.getBoundingClientRect()
  const sizeOf = (/** @type {Element} */ element, /** @type {'borderTopWidth' | 'borderBottomWidth' | 'fontSize'} */ property) =>
    parseFloat(getComputedStyle(element)[property])
  const fontOf = (/** @type {Element} */ element) => {
    const style = getComputedStyle(element)
    return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  }
  /** Where an element's text is, as the page lays it out. @param {Element} element */
  const textBoxOf = (element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect()
  }
  /** @param {Element} element @param {'#000' | '#fff'} color */
  const writeAsLive = (element, color) => {
    const box = textBoxOf(element)
    context.font = fontOf(element)
    context.fillStyle = color
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(textOf(element), box.left, (box.top + box.bottom) / 2)
  }

  const macWindow = live('.mac-window')
  const outer = boxOf(macWindow)

  // The Menu Bar, running on to the picture's edges, and its menus where the live ones are.
  const menuBar = live('.menu-bar')
  const bar = boxOf(menuBar)
  const barRule = sizeOf(menuBar, 'borderBottomWidth')
  fillAt(edges.left, edges.top, edges.right - edges.left, bar.bottom - barRule - edges.top, '#fff')
  fillAt(edges.left, bar.bottom - barRule, edges.right - edges.left, barRule, '#000')
  for (const menu of menuBar.querySelectorAll('li')) {
    if (menu.hidden) continue
    const title = menu.querySelector('.menu-bar__title')
    if (title) {
      const selected = title.hasAttribute('aria-current')
      const box = boxOf(title)
      if (selected) fillAt(box.left, box.top, box.width, box.height, '#000')
      writeAsLive(title, selected ? '#fff' : '#000')
      continue
    }
    const artwork = /** @type {SVGSVGElement} */ (menu.querySelector('svg'))
    const box = boxOf(artwork)
    await drawArtwork(context, artwork, box.left, box.top, box.width, box.width * scale)
  }

  // The Mac Window, its border and drop shadow where it has them, and its title bar, running on to the
  // picture's edges where the live ones reach the browser window's.
  const reach = {
    left: outer.left <= 0 ? edges.left : outer.left,
    right: outer.right >= browserWindow.width ? edges.right : outer.right,
    bottom: outer.bottom >= browserWindow.height ? edges.bottom : outer.bottom,
  }
  const windowBox = new DOMRect(reach.left, outer.top, reach.right - reach.left, reach.bottom - outer.top)
  const border = sizeOf(macWindow, 'borderTopWidth')
  if (border > 0) fillAt(windowBox.left + border, windowBox.top + border, windowBox.width, windowBox.height, '#000')
  fillAt(windowBox.left, windowBox.top, windowBox.width, windowBox.height, '#fff')
  if (border > 0) outlineAt(windowBox, border)
  const titleBar = live('.mac-window__title-bar')
  const titleBarBox = boxOf(titleBar)
  const strip = { left: reach.left + border, width: reach.right - reach.left - 2 * border, top: titleBarBox.top, height: titleBarBox.height }
  const stripRule = sizeOf(titleBar, 'borderBottomWidth')
  const plain = strip.height - stripRule
  // One-pixel stripes, every other pixel, between plain bands three pixels deep, as css/style.css draws them.
  for (let y = 4; y < plain - 3; y += 2) fillAt(strip.left, strip.top + y, strip.width, 1, '#000')
  fillAt(strip.left, strip.top + plain, strip.width, stripRule, '#000')
  const closeBox = boxOf(live('.mac-window__close-box'))
  fillAt(closeBox.left - 2, closeBox.top - 2, closeBox.width + 4, closeBox.height + 4, '#fff')
  outlineAt(closeBox, 1)
  const title = live('.mac-window__title')
  const titleBox = boxOf(title)
  fillAt(titleBox.left, titleBox.top, titleBox.width, titleBox.height, '#fff')
  writeAsLive(title, '#000')

  // The rule below the ready title, and the caret where the name's first letter will be typed, as
  // .intro-typing__caret draws it.
  const readyTitle = live('.ready-title')
  const ready = boxOf(readyTitle)
  const readyRule = sizeOf(readyTitle, 'borderBottomWidth')
  fillAt(ready.left, ready.bottom - readyRule, ready.width, readyRule, '#000')
  const name = live('.ready-title__name')
  const nameText = textBoxOf(name)
  const em = sizeOf(name, 'fontSize')
  const caret = { x: nameText.left + 0.05 * em, y: nameText.bottom + 0.1 * em - CARET.height * em, width: CARET.width * em, height: CARET.height * em }

  context.setTransform(1, 0, 0, 1, 0, 0)
  const darkMode = inDarkMode(macDesktop)
  makeOneBit(context, darkMode)
  const withCaret = /** @type {HTMLCanvasElement} */ (picture.cloneNode())
  const withCaretContext = /** @type {CanvasRenderingContext2D} */ (withCaret.getContext('2d'))
  withCaretContext.drawImage(picture, 0, 0)
  withCaretContext.fillStyle = darkMode ? '#fff' : '#000'
  withCaretContext.fillRect(
    Math.round(area.left + caret.x * scale),
    Math.round(area.top + caret.y * scale),
    Math.round(caret.width * scale),
    Math.round(caret.height * scale),
  )
  return { withCaret, withoutCaret: picture }
}

/**
 * A slab with rounded corners and softened edges, its face of the given width and height, centered on the
 * origin, and as deep as given along z.
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @param {number} radius the corners' radius
 * @param {number} edge how far the edges are rounded off
 * @param {THREE.Path[]} [holes] openings through it, on its face
 */
function roundedSlab(width, height, depth, radius, edge, holes = []) {
  const shape = new THREE.Shape(roundedRectPoints(width - 2 * edge, height - 2 * edge, radius - edge))
  shape.holes = holes
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * edge,
    bevelThickness: edge,
    bevelSize: edge,
    bevelSegments: 3,
  })
  return geometry.translate(0, 0, edge - depth / 2)
}

/**
 * Points around a rectangle with rounded corners, centered on a point, counterclockwise, the same number
 * on each corner, so that two such outlines match point for point.
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @param {number} [y] its center's height
 */
function roundedRectPoints(width, height, radius, y = 0) {
  const steps = 8
  const corners = [
    [width / 2 - radius, y - height / 2 + radius],
    [width / 2 - radius, y + height / 2 - radius],
    [-width / 2 + radius, y + height / 2 - radius],
    [-width / 2 + radius, y - height / 2 + radius],
  ]
  return corners.flatMap(([x, y], corner) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const angle = ((corner - 1 + i / steps) * Math.PI) / 2
      return new THREE.Vector2(x + radius * Math.cos(angle), y + radius * Math.sin(angle))
    }),
  )
}

/**
 * A surface joining two outlines that match point for point, such as the sloping walls of an opening.
 * @param {THREE.Vector2[]} near
 * @param {number} nearZ
 * @param {THREE.Vector2[]} far
 * @param {number} farZ
 */
function joiningWalls(near, nearZ, far, farZ) {
  const positions = []
  for (let i = 0; i < near.length; i++) {
    const next = (i + 1) % near.length
    const [a, b, c, d] = [near[i], near[next], far[i], far[next]]
    positions.push(a.x, a.y, nearZ, c.x, c.y, farZ, b.x, b.y, nearZ, b.x, b.y, nearZ, c.x, c.y, farZ, d.x, d.y, farZ)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** A matte plastic in a shade of gray. @param {number} gray */
const plasticOf = (gray) => new THREE.MeshLambertMaterial({ color: gray })

/**
 * Places a mesh, and has it cast shadows and receive them.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {[number, number, number]} position
 */
function part(geometry, material, [x, y, z]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * @typedef {{ patternCell: { value: number }, patternHeight: { value: number } }} DisplayPattern how large a CSS
 *   pixel is in the drawing's pixels, and how tall the drawing is, so the pattern lines up as the live page's does
 */

/**
 * Has the screen fill whatever its picture leaves transparent with the Mac Desktop's 1-bit
 * pattern, drawn in the display's own pixels, a CSS pixel to each square from the top left, as the live page
 * draws it. A pattern of single pixels drawn into the picture would be resized with the screen as the view
 * moves in, and beat against the display's pixels: crosses, checks, and bands that shift as the screen grows.
 * Never resized, this one reads as the same even gray at every distance, stays pure black and white up close,
 * and lines up with the live page's pattern as the view lands. What the picture draws, it draws over it.
 * @param {THREE.MeshBasicMaterial} material
 * @param {DisplayPattern} uniforms
 */
function drawPatternInDisplayPixels(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float patternCell;\nuniform float patternHeight;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          vec2 cssPixel = floor( vec2( gl_FragCoord.x, patternHeight - gl_FragCoord.y ) / patternCell );
          float pattern = mod( cssPixel.x + cssPixel.y, 2.0 );
          vec3 artwork = sampledDiffuseColor.rgb / max( sampledDiffuseColor.a, 0.0001 );
          diffuseColor.rgb *= mix( vec3( pattern ), artwork, sampledDiffuseColor.a );
        #endif`,
      )
  }
}

/**
 * The compact Macintosh, its screen dark: a tall case on a plinth, its front bezel joined to the rear
 * housing at a seam, with the screen set back in a sloping opening, and a floppy slot and vent grille below it.
 * @param {THREE.Texture} picture what its screen shows once it powers on
 * @param {DisplayPattern} displayPattern how the screen draws its pattern in the display's own pixels
 */
function macintosh(picture, displayPattern) {
  const group = new THREE.Group()
  const plastic = plasticOf(GRAYS.plastic)
  const dark = plasticOf(GRAYS.dark)
  const middle = CASE.plinth + CASE.height / 2
  const front = CASE.depth / 2
  const screenY = SCREEN.rise

  const plinth = part(new THREE.BoxGeometry(CASE.width - 0.16, CASE.plinth, CASE.depth - 0.2), dark, [0, CASE.plinth / 2, 0])

  const opening = new THREE.Path(roundedRectPoints(OPENING.width, OPENING.height, OPENING.radius, screenY))
  const bezel = part(
    roundedSlab(CASE.width, CASE.height, BEZEL_DEPTH, 0.12, 0.05, [opening]),
    plastic,
    [0, middle, front - BEZEL_DEPTH / 2],
  )
  // Set a little inside the bezel, so the seam between them shows as a dark line.
  const seam = 0.03
  const rearDepth = CASE.depth - BEZEL_DEPTH - seam
  const rear = part(
    roundedSlab(CASE.width - 0.04, CASE.height - 0.04, rearDepth, 0.12, 0.07),
    plastic,
    [0, middle - 0.01, front - BEZEL_DEPTH - seam - rearDepth / 2],
  )

  // The opening's walls slope in from just behind the bezel's rounded lip to the glass.
  const lip = 0.05
  const glassZ = front - GLASS.inset
  const walls = part(
    joiningWalls(
      roundedRectPoints(OPENING.width - 2 * lip, OPENING.height - 2 * lip, OPENING.radius - lip, screenY),
      front - lip,
      roundedRectPoints(GLASS.width, GLASS.height, GLASS.radius, screenY),
      glassZ,
    ),
    new THREE.MeshLambertMaterial({ color: GRAYS.plastic, side: THREE.DoubleSide }),
    [0, middle, 0],
  )
  const tube = new THREE.Mesh(new THREE.PlaneGeometry(GLASS.width, GLASS.height), new THREE.MeshLambertMaterial({ color: GRAYS.dark }))
  tube.position.set(0, middle + screenY, glassZ)

  // Drawn in front of the glass just behind it however far off the view is, so the glass never shows through.
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: picture,
    color: 0x000000,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  })
  drawPatternInDisplayPixels(screenMaterial, displayPattern)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height), screenMaterial)
  screen.position.set(0, middle + screenY, glassZ + 0.003)

  // The floppy slot, a dark slit in a shallow panel, low and to the right of the screen.
  const slotY = CASE.plinth + CASE.height * 0.2
  const slotPanel = part(new THREE.BoxGeometry(1.1, 0.2, 0.01), plasticOf(GRAYS.panel), [0.32, slotY, front - 0.002])
  const black = plasticOf(GRAYS.slot)
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.055, 0.02), black)
  slot.position.set(0.32, slotY, front)

  // A vent grille of short slots in the chin, to the left of the floppy slot.
  const ventShape = new THREE.BoxGeometry(0.34, 0.03, 0.02)
  const vents = Array.from({ length: 5 }, (_, i) => {
    const vent = new THREE.Mesh(ventShape, black)
    vent.position.set(-0.72, slotY + (i - 2) * 0.065, front)
    return vent
  })

  group.add(plinth, bezel, rear, walls, tube, screen, slotPanel, slot, ...vents)
  const screenCenter = screen.position.clone()
  return { group, front, screenCenter, screenMaterial }
}

/**
 * The keyboard: a wedge rising toward the Macintosh, with rows of darker keys on its sloping top.
 * @param {number} z where its middle is
 */
function keyboard(z) {
  const group = new THREE.Group()
  const { width, depth, front, back, key, gap } = KEYBOARD
  const edge = 0.03

  // The wedge's side, drawn front to back, and drawn out across the keyboard's width.
  const side = new THREE.Shape()
  side.moveTo(0, 0)
  side.lineTo(depth - 2 * edge, 0)
  side.lineTo(depth - 2 * edge, back - 2 * edge)
  side.lineTo(0, front - 2 * edge)
  const body = new THREE.ExtrudeGeometry(side, {
    depth: width - 2 * edge,
    bevelThickness: edge,
    bevelSize: edge,
    bevelSegments: 2,
  })
  body.translate(-(depth - 2 * edge) / 2, edge, -(width - 2 * edge) / 2).rotateY(Math.PI / 2)
  group.add(part(body, plasticOf(GRAYS.plastic), [0, 0, 0]))

  // The keys stand on the sloping top, rows running from the back of it, drawn together as one shape.
  /** A key cap, narrower at its top than at its base. @param {number} units how many ordinary keys wide */
  const cap = (units) => {
    const geometry = new THREE.BoxGeometry(units * key - gap, 0.09, key - gap).toNonIndexed()
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0) continue
      position.setX(i, position.getX(i) - Math.sign(position.getX(i)) * 0.025)
      position.setZ(i, position.getZ(i) - Math.sign(position.getZ(i)) * 0.025)
    }
    return geometry
  }
  const rowsDepth = KEY_ROWS.length * key
  const caps = KEY_ROWS.flatMap((row, r) => {
    let x = -(row.reduce((sum, units) => sum + units, 0) * key) / 2
    return row.map((units) => {
      x += units * key
      return cap(units).translate(x - (units * key) / 2, 0.04, -rowsDepth / 2 + (r + 0.5) * key + 0.08)
    })
  })
  const keys = new THREE.BufferGeometry()
  keys.setAttribute('position', new THREE.Float32BufferAttribute(caps.flatMap((cap) => [...cap.attributes.position.array]), 3))
  keys.computeVertexNormals()
  for (const cap of caps) cap.dispose()
  const deck = part(keys, plasticOf(GRAYS.keys), [0, (front + back) / 2 + 0.01, 0])
  deck.rotation.x = Math.atan2(back - front, depth)
  group.add(deck)
  group.position.z = z
  return group
}

/**
 * The mouse: a low box with softened edges and one wide button at the end toward the Macintosh, its cable
 * running across the desk to the Macintosh's back.
 * @param {number} front the Macintosh's front
 */
function mouse(front) {
  const group = new THREE.Group()
  const { x, ahead, turn } = DESK_LAYOUT.mouse
  const { width, length, height } = MOUSE

  const body = roundedSlab(width, length, height, 0.12, 0.06).rotateX(-Math.PI / 2).translate(0, height / 2, 0)
  const button = roundedSlab(width - 0.12, 0.34, 0.04, 0.05, 0.015).rotateX(-Math.PI / 2)
  group.add(
    part(body, plasticOf(GRAYS.plastic), [0, 0, 0]),
    part(button, plasticOf(GRAYS.button), [0, height + 0.005, -length / 2 + 0.24]),
  )
  group.position.set(x, 0, front + ahead)
  group.rotation.y = turn

  const back = group.localToWorld(new THREE.Vector3(0, height * 0.4, -length / 2))
  const path = new THREE.CatmullRomCurve3([
    back,
    new THREE.Vector3(back.x, 0.03, back.z - 0.25),
    new THREE.Vector3(back.x - 0.15, 0.03, front - 0.3),
    new THREE.Vector3(CASE.width / 2 + 0.3, 0.03, front - 1.4),
    new THREE.Vector3(CASE.width / 2 + 0.2, 0.03, front - CASE.depth - 0.25),
    new THREE.Vector3(CASE.width / 4, 0.35, front - CASE.depth - 0.02),
  ])
  const cable = part(new THREE.TubeGeometry(path, 64, 0.022, 6), plasticOf(GRAYS.button), [0, 0, 0])
  return [group, cable]
}

/**
 * The Macintosh, its screen dark, with its keyboard and mouse on a desk, and the screen's glow ready to
 * light them.
 * @param {THREE.Texture} picture what its screen shows once it powers on
 * @param {DisplayPattern} displayPattern how the screen draws its pattern in the display's own pixels
 */
function macintoshOnDesk(picture, displayPattern) {
  const { group, front, screenCenter, screenMaterial } = macintosh(picture, displayPattern)

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), plasticOf(GRAYS.desk))
  desk.rotation.x = -Math.PI / 2
  desk.receiveShadow = true

  // The screen's glow, the room's only light: out over the desk, casting soft shadows, and softly around
  // the screen onto the bezel. All of it falls off to black.
  const forward = new THREE.SpotLight(0xffffff, 0, 0, Math.PI * 0.42, 1, 2)
  forward.position.set(0, screenCenter.y, screenCenter.z + 0.25)
  forward.target.position.set(0, 0, front + DESK_LAYOUT.keyboardAhead + 1)
  forward.castShadow = true
  forward.shadow.mapSize.set(1024, 1024)
  forward.shadow.camera.near = 0.2
  forward.shadow.camera.far = 15
  forward.shadow.radius = 4
  forward.shadow.normalBias = 0.02
  const around = new THREE.PointLight(0xffffff, 0, 0, 2)
  around.position.set(0, screenCenter.y, screenCenter.z + 0.6)
  // The lit desk throws a little of the glow back onto the case's sides.
  const bounces = [-1, 1].map((side) => {
    const bounce = new THREE.PointLight(0xffffff, 0, 0, 2)
    bounce.position.set(side * (CASE.width / 2 + 0.8), 1.1, front + 0.2)
    return bounce
  })

  const setup = new THREE.Group()
  setup.add(group, keyboard(front + DESK_LAYOUT.keyboardAhead), ...mouse(front), desk, forward, forward.target, around, ...bounces)
  /** @param {number} level the screen's brightness, from 0, dark, to 1 */
  const lightScreen = (level) => {
    screenMaterial.color.setScalar(level)
    forward.intensity = level * GLOW.forward
    around.intensity = level * GLOW.around
    for (const bounce of bounces) bounce.intensity = level * GLOW.bounce
  }
  /** @param {THREE.Texture} picture what the screen shows from now on */
  const showOnScreen = (picture) => {
    screenMaterial.map = picture
  }
  return { setup, screenCenter, lightScreen, showOnScreen }
}

/** The corners of boxes around the Macintosh, its keyboard, and its mouse: what the view starts with in view. */
function cornersOnDesk() {
  const front = CASE.depth / 2
  /** @param {number[]} xs @param {number[]} ys @param {number[]} zs */
  const box = (xs, ys, zs) => xs.flatMap((x) => ys.flatMap((y) => zs.map((z) => new THREE.Vector3(x, y, z))))
  const keyboardZ = front + DESK_LAYOUT.keyboardAhead
  const mouse = { x: DESK_LAYOUT.mouse.x, z: front + DESK_LAYOUT.mouse.ahead, reach: MOUSE.length / 2 }
  return [
    ...box([-CASE.width / 2, CASE.width / 2], [0, CASE.plinth + CASE.height], [-front, front]),
    ...box([-KEYBOARD.width / 2, KEYBOARD.width / 2], [0, KEYBOARD.back], [keyboardZ - KEYBOARD.depth / 2, keyboardZ + KEYBOARD.depth / 2]),
    ...box([mouse.x - mouse.reach, mouse.x + mouse.reach], [0, MOUSE.height], [mouse.z - mouse.reach, mouse.z + mouse.reach]),
  ]
}

/**
 * Where the view starts for a browser window's shape: low at the front right, three-quarter on (VIEW_START), as
 * near as shows the Macintosh, keyboard, and mouse whole, with them across the middle of it, and the screen as
 * near the middle of it as that allows, as in a window taller than it is wide.
 * @param {number} aspect the browser window's width over its height
 * @param {THREE.Vector3} screenCenter the middle of the Macintosh's screen
 */
function startingView(aspect, screenCenter) {
  const corners = cornersOnDesk()
  const view = new THREE.PerspectiveCamera(FIELD_OF_VIEW, aspect)
  const turn = THREE.MathUtils.degToRad(VIEW_START.turn)
  const target = new THREE.Box3().setFromPoints(corners).getCenter(new THREE.Vector3())
  const projected = new THREE.Box3()
  /** Places the view so far back from what it looks at, and tells how much of it the corners fill. @param {number} distance */
  const fillFrom = (distance) => {
    view.position.set(target.x + distance * Math.sin(turn), VIEW_START.height, target.z + distance * Math.cos(turn))
    view.lookAt(target)
    view.updateMatrixWorld()
    projected.setFromPoints(corners.map((corner) => corner.clone().project(view)))
    return Math.max(-projected.min.x, projected.max.x, -projected.min.y, projected.max.y)
  }
  /** Places the view as near as shows them all. */
  const fit = () => {
    let [near, far] = [1, 100]
    while (far - near > 0.01) {
      const distance = (near + far) / 2
      if (fillFrom(distance) > START_FILL) near = distance
      else far = distance
    }
    fillFrom(far)
  }
  fit()
  // Then turned to have them where they belong in the view, which moves them a little, so again.
  for (let round = 0; round < 2; round++) {
    const middle = projected.getCenter(new THREE.Vector3())
    const screen = screenCenter.clone().project(view)
    middle.y = THREE.MathUtils.clamp(screen.y, projected.max.y - START_FILL, projected.min.y + START_FILL)
    middle.z = target.clone().project(view).z
    target.copy(middle.unproject(view))
    fit()
  }
  return { position: view.position.clone(), target }
}

/**
 * A picture for the screen, drawn as it is: crisp 1-bit pixels up close, a soft gray from afar.
 * @param {HTMLCanvasElement} picture
 */
function screenTexture(picture) {
  const texture = new THREE.CanvasTexture(picture)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  return texture
}

/**
 * Builds the scene in a canvas over the whole stage, dark until its screen powers on.
 * @param {HTMLElement} stage where the canvas goes
 * @param {{ happyComputer: SVGSVGElement, macDesktop: HTMLElement }} page what the screen shows from the page:
 *   the smiling computer as it powers on, then the Mac Desktop
 * @param {AbortSignal} signal ends the scene, wherever it has got to, and releases it
 */
export async function createIntroScene(stage, { happyComputer, macDesktop }, signal) {
  signal.throwIfAborted()
  const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
  /** @type {DisplayPattern} */
  const displayPattern = { patternCell: { value: pixelRatio }, patternHeight: { value: 1 } }
  const smilingComputer = screenTexture(await smilingComputerPicture(happyComputer, inDarkMode(macDesktop)))
  /** Draws the Mac Desktop's pictures, with the caret and without it, for the browser window's shape now. */
  const drawMacDesktop = async () => {
    const browserWindow = { width: stage.clientWidth, height: stage.clientHeight, pixelRatio }
    const drawn = await macDesktopPictures(macDesktop, browserWindow)
    return { withCaret: screenTexture(drawn.withCaret), withoutCaret: screenTexture(drawn.withoutCaret) }
  }
  let macDesktopPicture = await drawMacDesktop()
  /** Every picture the screen may show. */
  const pictures = () => [smilingComputer, macDesktopPicture.withCaret, macDesktopPicture.withoutCaret]
  signal.throwIfAborted()

  const canvas = document.createElement('canvas')
  canvas.className = 'intro__scene'
  canvas.dataset.testid = 'intro-scene'
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000)
  renderer.shadowMap.enabled = true
  // Only the view moves, so the shadows are drawn once, with the first drawing.
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true

  const scene = new THREE.Scene()
  const { setup, screenCenter, lightScreen, showOnScreen } = macintoshOnDesk(smilingComputer, displayPattern)
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 100)
  scene.add(setup, camera)

  /**
   * How far the view has moved, from 0, low at the front right with the whole Macintosh in view, to 1, square
   * to its screen, which covers the window.
   */
  let approach = 0
  /** Where the view starts, for the browser window's shape. */
  let start = startingView(camera.aspect, screenCenter)

  /**
   * Places the view on its way to the screen: it swings round to face it square while it moves in, rising level
   * with where it lands, then only moves in, until the screen covers the window.
   */
  const placeCamera = () => {
    // Where the view lands: the screen covers the whole window, showing the part of its picture the Mac
    // Desktop is laid out in, as large as the live page, so that no edge of the Macintosh shows.
    const slope = Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2))
    const landed = landingArea(camera.aspect)
    const landing = new THREE.Vector3(0, screenCenter.y + SCREEN.height * (0.5 - landed.top - landed.height / 2), screenCenter.z)
    const covered = (landed.height * SCREEN.height) / 2 / slope

    // Round the line through where it lands, square to the screen: how far round the view is, how far out, and
    // how high. It moves in by shares of the way left, so what it looks at grows as steadily up close as from
    // afar, easing out of the start and into the landing.
    const from = start.position.clone().sub(landing)
    const swung = THREE.MathUtils.smoothstep(approach, 0, SWING_ENDS)
    const movedIn = THREE.MathUtils.smoothstep(approach ** MOVE_IN_DELAY, 0, 1)
    const turn = Math.atan2(from.x, from.z) * (1 - swung)
    const outset = Math.hypot(from.x, from.z)
    const distance = outset * (covered / outset) ** movedIn
    camera.position.set(
      landing.x + distance * Math.sin(turn),
      THREE.MathUtils.lerp(start.position.y, landing.y, swung),
      landing.z + distance * Math.cos(turn),
    )
    camera.lookAt(start.target.clone().lerp(landing, swung))
  }

  /** @type {{ ms: number, step: (progress: number) => void, done: () => void, start?: number } | undefined} */
  let motion
  let drawnSize = ''
  /** @type {number | undefined} when the screen started showing the Mac Desktop, by the page's clock */
  let macDesktopShownAt
  let shown = smilingComputer

  /**
   * What the screen shows at a moment: the smiling computer, then the Mac Desktop, its caret blinking until
   * the screen covers the window, then shown, as the live Mac Window's is when typing starts.
   */
  const pictureAt = (/** @type {number} */ now) => {
    if (macDesktopShownAt === undefined) return smilingComputer
    const caretShown = approach === 1 || Math.floor(Math.max(now - macDesktopShownAt, 0) / CARET_BLINK_MS) % 2 === 0
    return caretShown ? macDesktopPicture.withCaret : macDesktopPicture.withoutCaret
  }

  /** Matches the drawing to the canvas's size on screen, and tells whether it had to change. */
  const fitCanvas = () => {
    const size = `${canvas.clientWidth}x${canvas.clientHeight}`
    if (size === drawnSize) return false
    drawnSize = size
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    displayPattern.patternHeight.value = canvas.height
    camera.aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1)
    camera.updateProjectionMatrix()
    start = startingView(camera.aspect, screenCenter)
    return true
  }

  /** Draws the scene as it is now. */
  const draw = () => {
    placeCamera()
    renderer.render(scene, camera)
  }

  /** How many times the Mac Desktop has been redrawn for a new window shape, so that only the latest shows. */
  let redraws = 0
  /**
   * Redraws the Mac Desktop for the browser window's new shape, such as a phone turned on its side, so the view
   * still lands on it as the live page is laid out. Until then, the screen shows the picture it has.
   */
  const redrawMacDesktop = async () => {
    const redraw = ++redraws
    const redrawn = await drawMacDesktop()
    const outdated = released || redraw !== redraws
    for (const picture of Object.values(outdated ? redrawn : macDesktopPicture)) picture.dispose()
    if (outdated) return
    for (const picture of Object.values(redrawn)) renderer.initTexture(picture)
    // The next frame shows it, before anything is drawn with the pictures just released.
    macDesktopPicture = redrawn
  }

  /** Each animation frame, draws the motion playing, if any, or the scene resized, or the screen's picture changed. */
  const drawFrame = (/** @type {number} */ now) => {
    const resized = fitCanvas()
    if (resized) {
      redrawMacDesktop().catch((error) => console.warn('The 3D screen keeps the Mac Desktop drawn for the window’s old shape.', error))
    }
    const moved = Boolean(motion)
    if (motion) {
      motion.start ??= now
      const progress = Math.min((now - motion.start) / motion.ms, 1)
      motion.step(progress)
      if (progress === 1) {
        motion.done()
        motion = undefined
      }
    }
    const picture = pictureAt(now)
    const repictured = picture !== shown
    if (repictured) showOnScreen((shown = picture))
    if (moved || resized || repictured) draw()
  }

  /**
   * Plays a motion over a number of milliseconds, one drawn frame at a time.
   * @param {number} ms
   * @param {(progress: number) => void} step shows the scene at a progress from 0 to 1
   * @returns {Promise<void>} settles when the motion ends, or the scene does
   */
  const play = (ms, step) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      motion = { ms, step, done: resolve }
    })

  let released = false
  /** Stops drawing, releases the scene's WebGL resources, and removes its canvas. */
  const release = () => {
    if (released) return
    released = true
    renderer.setAnimationLoop(null)
    for (const picture of pictures()) picture.dispose()
    scene.traverse((object) => {
      if (object instanceof THREE.Light) object.dispose()
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      for (const material of [object.material].flat()) {
        material.map?.dispose()
        material.dispose()
      }
    })
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
  signal.addEventListener('abort', release, { once: true })

  // The first drawing compiles the scene's shaders, which takes a while where WebGL is drawn in software.
  // It is done in the dark, before the scene is ready, so that the screen lights the moment it powers on.
  stage.append(canvas)
  fitCanvas()
  await renderer.compileAsync(scene, camera)
  signal.throwIfAborted()
  // Every picture is sent to the screen now, so that changing what it shows takes no time.
  for (const picture of pictures()) renderer.initTexture(picture)
  draw()
  renderer.setAnimationLoop(drawFrame)

  return {
    /**
     * The screen powers on with a flicker, showing the smiling computer and lighting the room.
     * @param {() => void} onPowerOn called in the frame the screen starts to light
     */
    powerOn(onPowerOn) {
      let poweringOn = true
      return play(FLICKER_MS, (progress) => {
        if (poweringOn) onPowerOn()
        poweringOn = false
        const at = progress * (FLICKER.length - 1)
        const from = Math.floor(at)
        lightScreen(THREE.MathUtils.lerp(FLICKER[from], FLICKER[Math.min(from + 1, FLICKER.length - 1)], at - from))
      })
    },

    /** The screen shows the Mac Desktop the visitor is about to enter, its caret blinking. */
    showMacDesktop() {
      macDesktopShownAt = performance.now()
    },

    /**
     * The view swings round from the front right to face the screen while it moves in, until the screen covers
     * the whole browser window, showing the Mac Desktop as large as the live page, and stops there, square to
     * it, so the screen can crossfade into the page. The motion ends on a drawn
     * frame, so however slowly the browser draws, the screen is seen covering the window.
     * @param {number} ms
     */
    enter(ms) {
      return play(ms, (progress) => {
        approach = progress
      })
    },

    /** Releases the scene once it is no longer seen. Ending the Intro releases it too. */
    release,
  }
}
