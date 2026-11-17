// @ts-check
// The full Intro's 3D scene: a Macintosh in a dark room, lit only by its screen. js/intro.js loads this
// module, and three.js with it, only when the full Intro plays, and sets the pace: the screen powers on,
// then the view moves in until the screen fills the browser window and flares white.
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
/** The tube's glass around the picture, its corners' radius, how far it sits back in the bezel, and how far it bulges forward. */
const GLASS = { width: SCREEN.width * 1.07, height: SCREEN.height * 1.09, radius: 0.08, inset: 0.18, bulge: 0.06 }
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
/** How far the things on the desk reach to either side of the Macintosh's middle, out to the mouse. */
const DESK_REACH = DESK_LAYOUT.mouse.x + MOUSE.width / 2 + 0.1

/** Grayscale only: off-white plastic, darker keys and details, a dim desk. */
const GRAYS = { plastic: 0xdcdcdc, keys: 0x6e6e6e, button: 0xa8a8a8, panel: 0xb4b4b4, dark: 0x262626, slot: 0x050505, desk: 0x7c7c7c }

/** The screen's picture, in pixels. */
const SCREEN_PIXELS = { width: 512, height: 384 }
/** The view's vertical angle, in degrees. */
const FIELD_OF_VIEW = 35
/** The screen's brightness, from 0, dark, to 1, as it powers on with a flicker, lit from its first frame. */
const FLICKER = [0.8, 0.2, 0.9, 1]
const FLICKER_MS = 450
/** How brightly, at full brightness, the screen lights what is in front of it, the bezel around it, and, off the desk, the case's sides. */
const GLOW = { forward: 9, around: 1.2, bounce: 0.25 }

/**
 * Draws what the screen shows once it powers on: the smiling computer on a 1-bit dither, in pure black and white.
 * @param {SVGSVGElement} happyComputer the page's smiling computer, drawn into the screen's picture
 */
async function screenPicture(happyComputer) {
  const picture = document.createElement('canvas')
  picture.width = SCREEN_PIXELS.width
  picture.height = SCREEN_PIXELS.height
  const context = /** @type {CanvasRenderingContext2D} */ (picture.getContext('2d', { willReadFrequently: true }))

  // Five pixels to each of the artwork's 32, so its edges fall on whole pixels, and centered on the screen.
  const size = 32 * 5
  const artwork = /** @type {SVGSVGElement} */ (happyComputer.cloneNode(true))
  artwork.setAttribute('width', String(size))
  artwork.setAttribute('height', String(size))
  const image = new Image()
  image.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(artwork))}`
  await image.decode()
  context.drawImage(image, (picture.width - size) / 2, (picture.height - size) / 2, size, size)

  // The dither shows around the artwork, and the artwork is made pure black and white, even where a
  // browser smooths its edges.
  const pixels = context.getImageData(0, 0, picture.width, picture.height)
  const { data } = pixels
  for (let i = 0; i < data.length; i += 4) {
    const pixel = i / 4
    const ditherWhite = (pixel % picture.width + Math.floor(pixel / picture.width)) % 2 === 0
    const white = data[i + 3] < 128 ? ditherWhite : data[i] + data[i + 1] + data[i + 2] >= 3 * 128
    data.fill(white ? 255 : 0, i, i + 3)
    data[i + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  return picture
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

/**
 * How far the tube's glass bulges forward at a point on it, measured from its center: most at the center,
 * and none at its edges.
 * @param {number} x
 * @param {number} y
 */
function bulgeAt(x, y) {
  return GLASS.bulge * (1 - (2 * x / GLASS.width) ** 2) * (1 - (2 * y / GLASS.height) ** 2)
}

/**
 * A flat rectangle bent to the glass's bulge.
 * @param {number} width
 * @param {number} height
 */
function curvedGlass(width, height) {
  const geometry = new THREE.PlaneGeometry(width, height, 24, 18)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) position.setZ(i, bulgeAt(position.getX(i), position.getY(i)))
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
 * The compact Macintosh, its screen dark: a tall case on a plinth, its front bezel joined to the rear
 * housing at a seam, with the screen set back in a sloping opening, and a floppy slot and vent grille below it.
 * @param {HTMLCanvasElement} picture what its screen shows once it powers on
 */
function macintosh(picture) {
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
  const tube = new THREE.Mesh(curvedGlass(GLASS.width, GLASS.height), new THREE.MeshLambertMaterial({ color: GRAYS.dark }))
  tube.position.set(0, middle + screenY, glassZ)

  const texture = new THREE.CanvasTexture(picture)
  texture.colorSpace = THREE.SRGBColorSpace
  // Crisp 1-bit pixels up close, a soft gray from afar.
  texture.magFilter = THREE.NearestFilter
  const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, color: 0x000000 })
  const screen = new THREE.Mesh(curvedGlass(SCREEN.width, SCREEN.height), screenMaterial)
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
  const screenCenter = new THREE.Vector3(0, middle + screenY, screen.position.z + GLASS.bulge)
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
 * @param {HTMLCanvasElement} picture what its screen shows once it powers on
 */
function macintoshOnDesk(picture) {
  const { group, front, screenCenter, screenMaterial } = macintosh(picture)

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
  return { setup, screenCenter, front, lightScreen }
}

/**
 * Builds the scene in a canvas over the whole stage, dark until its screen powers on.
 * @param {HTMLElement} stage where the canvas goes
 * @param {SVGSVGElement} happyComputer the smiling computer the screen shows
 * @param {AbortSignal} signal ends the scene, wherever it has got to, and releases it
 */
export async function createIntroScene(stage, happyComputer, signal) {
  signal.throwIfAborted()
  const picture = await screenPicture(happyComputer)
  signal.throwIfAborted()

  const canvas = document.createElement('canvas')
  canvas.className = 'intro__scene'
  canvas.dataset.testid = 'intro-scene'
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000)
  renderer.shadowMap.enabled = true
  // Only the view moves, so the shadows are drawn once, with the first drawing.
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true

  const scene = new THREE.Scene()
  const { setup, screenCenter, front, lightScreen } = macintoshOnDesk(picture)
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 100)
  // Washes the whole view white as it enters the screen.
  const flare = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  )
  flare.position.z = -0.05
  flare.renderOrder = 1
  camera.add(flare)
  scene.add(setup, camera)

  /** How far the view has moved in, from 0, the whole Macintosh in view, to 1, its screen covering the window. */
  let approach = 0
  /** How far the view has pushed on from there, from 0 to 1, at the screen's glass as it flares white. */
  let push = 0

  /** Places the view for the browser window's shape, and flares the screen as the view pushes through it. */
  const placeCamera = () => {
    const slope = Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2))
    const framing = (/** @type {number} */ width, /** @type {number} */ height) => ({
      whole: Math.max(height / 2 / slope, width / 2 / (slope * camera.aspect)),
      covered: Math.min(height / 2 / slope, width / 2 / (slope * camera.aspect)),
    })
    // From a little above, looking down onto the desk, with the Macintosh, keyboard, and mouse in view: the
    // Macintosh's height at its front, and the desk's reach to either side at the keyboard's front edge,
    // nearer the view.
    const nearest = front + DESK_LAYOUT.keyboardAhead + KEYBOARD.depth / 2
    const far = {
      y: CASE.height * 0.8,
      lookY: CASE.height * 0.4,
      distance: Math.max(front + framing(0, CASE.height * 1.45).whole, nearest + framing(DESK_REACH * 2.2, 0).whole),
    }
    // Where the screen covers the whole window, with a margin, so that no edge of the Macintosh shows. Its
    // edges are measured where they are, behind the glass's bulge.
    const covered = screenCenter.z - GLASS.bulge + framing(SCREEN.width, SCREEN.height).covered * 0.95
    const glass = screenCenter.z + 0.05

    const eased = THREE.MathUtils.smoothstep(approach, 0, 1)
    // Level with, and facing, the screen's center well before it covers the window.
    const level = Math.min(eased * 2, 1)
    const y = THREE.MathUtils.lerp(far.y, screenCenter.y, level)
    const distance = THREE.MathUtils.lerp(THREE.MathUtils.lerp(far.distance, covered, eased), glass, push * push)
    camera.position.set(0, y, distance)
    camera.lookAt(0, THREE.MathUtils.lerp(far.lookY, screenCenter.y, level), 0)
    flare.material.opacity = THREE.MathUtils.smoothstep(push, 0, 1)
  }

  /** @type {{ ms: number, step: (progress: number) => void, done: () => void, start?: number } | undefined} */
  let motion
  let drawnSize = ''

  /** Matches the drawing to the canvas's size on screen, and tells whether it had to change. */
  const fitCanvas = () => {
    const size = `${canvas.clientWidth}x${canvas.clientHeight}`
    if (size === drawnSize) return false
    drawnSize = size
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    camera.aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1)
    camera.updateProjectionMatrix()
    return true
  }

  /** Draws the scene as it is now. */
  const draw = () => {
    placeCamera()
    renderer.render(scene, camera)
  }

  /** Each animation frame, draws the motion playing, if any, or the scene resized. */
  const drawFrame = (/** @type {number} */ now) => {
    const resized = fitCanvas()
    if (!motion && !resized) return
    if (motion) {
      motion.start ??= now
      const progress = Math.min((now - motion.start) / motion.ms, 1)
      motion.step(progress)
      if (progress === 1) {
        motion.done()
        motion = undefined
      }
    }
    draw()
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

    /**
     * The view moves straight in until the screen covers the whole browser window, then pushes on to its
     * glass as it flares white. Each part ends on a drawn frame, so however slowly the browser draws, the
     * screen is seen covering the window before it flares.
     * @param {number} ms
     */
    async enter(ms) {
      await play(ms * 0.75, (progress) => {
        approach = progress
      })
      await play(ms * 0.25, (progress) => {
        push = progress
      })
    },

    /** Releases the scene once it is no longer seen. Ending the Intro releases it too. */
    release,
  }
}
