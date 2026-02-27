// ==========================
// EyeVoice - Direct Command Mode
// ==========================

const video = document.getElementById("video");
const output = document.getElementById("output");

let lastCommandTime = 0;
const COMMAND_COOLDOWN = 2000; // 2 seconds

// Blink detection
let blinkCount = 0;
let lastBlinkTime = 0;
const BLINK_WINDOW = 2000;

// ==========================
// SPEECH FUNCTION
// ==========================

function speak(text) {
  let speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-US";
  speech.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);

  output.innerText = text;
}

// ==========================
// COOLDOWN CHECK
// ==========================

function canTrigger() {
  return Date.now() - lastCommandTime > COMMAND_COOLDOWN;
}

function triggerCommand(word) {
  if (!canTrigger()) return;
  lastCommandTime = Date.now();
  speak(word);
}

// ==========================
// BLINK DETECTION
// ==========================

function detectBlink(landmarks) {
  let top = landmarks[159];
  let bottom = landmarks[145];
  let eyeOpen = Math.abs(top.y - bottom.y);
  return eyeOpen < 0.01;
}

function handleBlink() {
  let now = Date.now();

  if (now - lastBlinkTime > BLINK_WINDOW) {
    blinkCount = 0;
  }

  blinkCount++;
  lastBlinkTime = now;

  setTimeout(() => {
    if (Date.now() - lastBlinkTime >= BLINK_WINDOW) {
      if (blinkCount === 2) {
        triggerCommand("WASHROOM");
      }
      blinkCount = 0;
    }
  }, BLINK_WINDOW + 100);
}

// ==========================
// EYE MOVEMENT DETECTION
// ==========================

function detectEyeDirection(landmarks) {

  let leftCorner = landmarks[33];
  let rightCorner = landmarks[133];
  let iris = landmarks[468];

  let eyeWidth = rightCorner.x - leftCorner.x;
  let hRatio = (iris.x - leftCorner.x) / eyeWidth;

  if (hRatio < 0.35) return "LEFT";
  if (hRatio > 0.65) return "RIGHT";

  return "CENTER";
}

// ==========================
// HEAD MOVEMENT DETECTION
// ==========================

function detectHeadVertical(landmarks) {

  let nose = landmarks[1];

  if (nose.y < 0.35) return "UP";
  if (nose.y > 0.65) return "DOWN";

  return "CENTER";
}

// ==========================
// START CAMERA
// ==========================

async function start() {

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  const faceMesh = new FaceMesh({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  faceMesh.onResults(results => {

    if (!results.multiFaceLandmarks) return;

    const landmarks = results.multiFaceLandmarks[0];

    // Blink detection first
    if (detectBlink(landmarks)) {
      handleBlink();
      return;
    }

    // Eye movement
    let eyeDir = detectEyeDirection(landmarks);
    if (eyeDir === "LEFT") triggerCommand("YES");
    if (eyeDir === "RIGHT") triggerCommand("NO");

    // Head movement
    let headDir = detectHeadVertical(landmarks);
    if (headDir === "UP") triggerCommand("WATER");
    if (headDir === "DOWN") triggerCommand("HELP");

  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 400,
    height: 300
  });

  camera.start();
}

start();

