// @ts-check
// Sound: an original startup chime that rings as the Intro or Short Boot starts up the Macintosh. Sound
// is off until a visitor turns it on with one of the sound controls (the Intro's, or the Menu Bar's),
// which ring the chime as they turn it on. The choice is remembered for later visits.
//
// The chime is synthesized here, note by note: a rising, bell-like arpeggio written for this portfolio,
// not a recording of any other computer's sound.
//
// Browsers let a page make sound only once its visitor has pressed or typed on it. A returning visitor's
// Short Boot starts before they have, so where the browser withholds sound, the chime waits for the
// visitor's first press or keystroke while the Intro is still playing, and is dropped once it is over.

/** Whether the Intro or Short Boot is playing. (Every script shares one scope, so this one keeps its names apart.) */
function introPlaying() {
  return Boolean(document.documentElement.dataset.intro)
}

/** Where the browser remembers that this visitor turned sound on. */
const SOUND_KEY = 'isaac-dobson-portfolio:sound'

/** Whether this visitor turned sound on during an earlier visit. Storage that is blocked means off. */
function soundRemembered() {
  try {
    return window.localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
}

/**
 * Remembers whether sound is on, where the browser lets it.
 * @param {boolean} on
 */
function rememberSound(on) {
  try {
    if (on) window.localStorage.setItem(SOUND_KEY, 'on')
    else window.localStorage.removeItem(SOUND_KEY)
  } catch {
    // Storage is blocked or full: sound stays as chosen for this visit only.
  }
}

/** The chime's notes, in hertz, rising from D: D4, A4, E5, F♯5. */
const CHIME_NOTES = [293.66, 440, 659.26, 739.99]
/** Each note's partials, as multiples of its pitch and their loudness, for a soft bell-like tone. */
const BELL_PARTIALS = [
  { multiple: 1, level: 1 },
  { multiple: 2, level: 0.25 },
  { multiple: 3.01, level: 0.08 },
]
const NOTE_SPACING_S = 0.08
const NOTE_RING_S = 1.8
const CHIME_VOLUME = 0.15

/** @type {AudioContext | undefined} made only once there is a chime to ring */
let chimeContext

function audioContext() {
  chimeContext ??= new AudioContext()
  return chimeContext
}

/** @type {GainNode | undefined} the volume of the chime ringing now, if any */
let ringingVolume

/** Whether the Intro playing now has rung its chime, so it rings once however sound was turned on. */
let rangDuringIntro = false

/**
 * Rings the chime now.
 * @param {AudioContext} context
 */
function ring(context) {
  hush()
  const start = context.currentTime + 0.02
  const volume = context.createGain()
  volume.gain.value = CHIME_VOLUME
  volume.connect(context.destination)
  CHIME_NOTES.forEach((pitch, index) => {
    const at = start + index * NOTE_SPACING_S
    for (const { multiple, level } of BELL_PARTIALS) {
      const tone = context.createOscillator()
      tone.frequency.value = pitch * multiple
      const envelope = context.createGain()
      envelope.gain.setValueAtTime(0, at)
      envelope.gain.linearRampToValueAtTime(level / CHIME_NOTES.length, at + 0.01)
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_RING_S)
      tone.connect(envelope).connect(volume)
      tone.start(at)
      tone.stop(at + NOTE_RING_S)
    }
  })
  ringingVolume = volume
  if (introPlaying()) rangDuringIntro = true
}

/** Quickly fades out the chime ringing now, if any. */
function hush() {
  if (!ringingVolume || !chimeContext) return
  ringingVolume.gain.setTargetAtTime(0, chimeContext.currentTime, 0.03)
  ringingVolume = undefined
}

let soundOn = soundRemembered()

/** Whether a chime is waiting for the browser to allow sound. */
let chimeWaiting = false

/** Rings the chime once the browser allows this page to make sound, unless sound is turned off first. */
function ringWhenAllowed() {
  const context = audioContext()
  chimeWaiting = true
  context.resume().then(ringIfAllowed, () => {})
}

function ringIfAllowed() {
  if (!chimeWaiting || !soundOn || chimeContext?.state !== 'running') return
  chimeWaiting = false
  ring(chimeContext)
}

// A chime withheld by the browser rings on the visitor's first press or keystroke, which allows sound,
// if the Intro it belongs to is still playing. (Pressing a sound control decides for itself.)
for (const type of ['pointerdown', 'keydown']) {
  window.addEventListener(
    type,
    (event) => {
      if (!chimeWaiting || !chimeContext) return
      if (!introPlaying()) chimeWaiting = false
      else if (!(event.target instanceof Element && event.target.closest('.sound-toggle'))) {
        chimeContext.resume().then(ringIfAllowed, () => {})
      }
    },
    { capture: true },
  )
}

// js/intro.js announces when the Intro or Short Boot starts up the Macintosh.
document.addEventListener('intro:power-on', () => {
  if (soundOn && !rangDuringIntro) ringWhenAllowed()
})

/** The Menu Bar's sound menu and the Intro's sound control, each hidden until it can play the chime. */
const soundControls = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.menu-bar__sound, .intro__sound')])
const soundToggles = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('.sound-toggle')])

/** Shows whether sound is on in every sound control. */
function showSoundState() {
  for (const toggle of soundToggles) toggle.setAttribute('aria-pressed', String(soundOn))
}

for (const toggle of soundToggles) {
  toggle.addEventListener('click', () => {
    soundOn = !soundOn
    rememberSound(soundOn)
    showSoundState()
    if (soundOn) ringWhenAllowed()
    else {
      chimeWaiting = false
      hush()
    }
  })
}

// The sound controls show only in a browser that can play the chime.
if (typeof window.AudioContext === 'function') {
  showSoundState()
  for (const control of soundControls) control.hidden = false
}
