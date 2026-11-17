// @ts-check
// The full Intro's 3D scene: a Macintosh in a dark room, lit only by its screen. js/intro.js loads this
// module, and three.js with it, only when the full Intro plays, and sets the pace: the screen powers on,
// then the view moves in until the screen fills the browser window and flares white.
//
// The Macintosh is a stand-in made of simple original shapes in grayscale: a case with a screen.
import * as THREE from 'three'

/** The case's size, in decimeters, close to a compact Macintosh's. */
const CASE = { width: 2.4, height: 3.4, depth: 2.7 }
/** The screen's size, 4:3, and how far its center sits above the case's. */
const SCREEN = { width: 1.8, height: 1.35, rise: 0.6 }
/** The screen's picture, in pixels. */
const SCREEN_PIXELS = { width: 512, height: 384 }
/** The view's vertical angle, in degrees. */
const FIELD_OF_VIEW = 35
/** The screen's brightness, from 0, dark, to 1, as it powers on with a flicker, lit from its first frame. */
const FLICKER = [0.8, 0.2, 0.9, 1]
const FLICKER_MS = 450

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
 * The stand-in Macintosh, its screen dark, standing on a desk.
 * @param {HTMLCanvasElement} picture what its screen shows once it powers on
 */
function standInMacintosh(picture) {
  const macintosh = new THREE.Group()
  const plastic = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.75 })
  const shadowed = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.9 })

  const caseShape = new THREE.Mesh(new THREE.BoxGeometry(CASE.width, CASE.height, CASE.depth), plastic)
  caseShape.position.y = CASE.height / 2
  const front = CASE.depth / 2

  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width * 1.18, SCREEN.height * 1.22), shadowed)
  bezel.position.set(0, CASE.height / 2 + SCREEN.rise, front + 0.002)

  const texture = new THREE.CanvasTexture(picture)
  texture.colorSpace = THREE.SRGBColorSpace
  // Crisp 1-bit pixels up close, a soft gray from afar.
  texture.magFilter = THREE.NearestFilter
  const glass = new THREE.MeshBasicMaterial({ map: texture, color: 0x000000 })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height), glass)
  screen.position.set(0, CASE.height / 2 + SCREEN.rise, front + 0.004)

  const floppySlot = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.02), shadowed)
  floppySlot.position.set(0.45, CASE.height * 0.17, front + 0.01)

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x8a8a8a }))
  desk.rotation.x = -Math.PI / 2

  // The screen's glow, the room's only light.
  const glow = new THREE.PointLight(0xffffff, 0, 0, 2)
  glow.position.set(0, screen.position.y, front + 0.8)

  macintosh.add(caseShape, bezel, screen, floppySlot, desk, glow)
  return { macintosh, screenCenter: screen.position.clone(), front, glass, glow }
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

  const scene = new THREE.Scene()
  const { macintosh, screenCenter, front, glass, glow } = standInMacintosh(picture)
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 100)
  // Washes the whole view white as it enters the screen.
  const flare = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  )
  flare.position.z = -0.05
  flare.renderOrder = 1
  camera.add(flare)
  scene.add(macintosh, camera)

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
    const far = { y: CASE.height / 2, distance: front + framing(CASE.width * 1.3, CASE.height * 1.3).whole }
    // Where the screen covers the whole window, with a margin, so that no edge of the Macintosh shows.
    const covered = screenCenter.z + framing(SCREEN.width, SCREEN.height).covered * 0.95
    const glass = screenCenter.z + 0.05

    const eased = THREE.MathUtils.smoothstep(approach, 0, 1)
    // Level with the screen's center well before it covers the window.
    const y = THREE.MathUtils.lerp(far.y, screenCenter.y, Math.min(eased * 2, 1))
    const distance = THREE.MathUtils.lerp(THREE.MathUtils.lerp(far.distance, covered, eased), glass, push * push)
    camera.position.set(0, y, distance)
    camera.lookAt(0, y, 0)
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

  /** @param {number} level the screen's brightness, from 0, dark, to 1 */
  const lightScreen = (level) => {
    glass.color.setScalar(level)
    glow.intensity = level * 4
  }

  let released = false
  /** Stops drawing, releases the scene's WebGL resources, and removes its canvas. */
  const release = () => {
    if (released) return
    released = true
    renderer.setAnimationLoop(null)
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      for (const material of [object.material].flat()) material.dispose()
    })
    glass.map?.dispose()
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
