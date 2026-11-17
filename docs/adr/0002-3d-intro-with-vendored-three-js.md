# The Intro's 3D Macintosh uses a self-hosted three.js

Spec #1 rules out heavy animation libraries and third-party animation services. To get a real 3D Macintosh lit by its own screen, as the old Lottie aimed for, the Intro renders an original Macintosh built in code with three.js in WebGL. three.js is a copy kept in the repository, needs no build step, and loads only for the full Intro. Portfolio content never depends on it: the Short Boot, used for returning visitors and as the fallback when WebGL is missing or the scene is slow to load, doesn't load three.js.

## Considered Options

- **CSS 3D transforms**: no dependencies, but faces are flat-shaded with no real light, so it can't give the screen-lit dark room.
- **Pre-rendered video**, like the old Lottie's frames: photoreal, but several megabytes, and its fixed shape can't match every browser window when entering the screen.
