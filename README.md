# nova

*noise oriented visual aesthetics*

---

nova is a browser-based, audio-reactive visual experience.

it listens to your environment and transforms sound into a living, evolving space —
not as a tool, but as an atmosphere.

low frequencies expand a central planetary body.
higher tones ripple outward as waves through a drifting field of stars.

this is not a dashboard.
it is a quiet, reactive environment.

---

## what it does

nova creates a real-time connection between sound and space:

* your surroundings become motion
* a cosmic environment slowly reacts and shifts
* a central “planet” breathes with audio input
* waves expand outward and shape the visual field

everything happens live, in your browser.

---

## how to run it

to experience nova, you need to run it on a local server.
this is required so your browser allows microphone access.

### easiest way

open a terminal inside the project folder and run:

```bash id="run-nova"
npx live-server
```

this will start a local server and open the project in your browser automatically
(usually at `http://127.0.0.1:5500`).

---

### if this does not work

`npx` requires node.js to be installed.

you can install it in one of the following ways:

* easiest: download from https://nodejs.org/
* via terminal (mac, using homebrew):

  ```bash id="install-node"
  brew install node
  ```

---

### alternative options

if you prefer other methods:

**vs code**
install the “Live Server” extension and click “Go Live”

**python**
run:

```bash id="python-server"
python3 -m http.server 8000
```

then open:
http://localhost:8000

---

## microphone access

nova uses your microphone to generate the visuals.

when you click “start”, your browser will ask for permission.

* allow access to continue
* no audio is recorded or stored
* everything happens locally in your browser

---

## common issues

**microphone is blocked**

make sure you are not opening the file directly (`file:///`).
use `http://localhost` instead.

also check your browser permissions (icon next to the URL).

---

**nothing happens on screen**

nova needs sound to react.
try speaking, playing music, or creating ambient noise.

you can also open developer tools (F12) to check for errors.

---

## tech

built with native web technologies:

* javascript
* html canvas
* web audio api

no frameworks. no dependencies.

---

## note

this project is an experiment in generative visuals, interaction,
and the idea of translating sound into spatial experience.

---

*created as part of my journey in media engineering —
somewhere between code, design, and atmosphere.*
