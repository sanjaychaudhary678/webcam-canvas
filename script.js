const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');

let drawing = false;
let color = 'red';
let drawEnabled = true;
let isEraser = false;
let brushSize = parseInt(localStorage.getItem('brushSize')) || 5;
let eraserSize = parseInt(localStorage.getItem('eraserSize')) || 20;
let lastTapTime = 0;
const TAP_COOLDOWN = 500;
const undoStack = [];
const redoStack = [];

const toolSlider = document.getElementById("toolSizeSlider");
const toolPreview = document.getElementById("toolSizePreview");
const eraserBtn = document.getElementById("eraserBtn");
const toggleBtn = document.getElementById("toggleDrawBtn");

video.addEventListener('loadedmetadata', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});


function updateToolSizePreview() {
  const size = isEraser ? eraserSize : brushSize;
  toolPreview.style.width = `${size}px`;
  toolPreview.style.height = `${size}px`;
  toolPreview.style.borderColor = isEraser ? 'white' : color;
}

function setColor(c) {
  color = c;
  isEraser = false;
  ctx.globalCompositeOperation = 'source-over';
  document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.color-btn.${c}`);
  if (activeBtn) activeBtn.classList.add('active');
  eraserBtn.classList.remove('active');
  toolSlider.value = brushSize;
  updateToolSizePreview();
}

function setCustomColor(hex) {
  color = hex;
  isEraser = false;
  ctx.globalCompositeOperation = 'source-over';
  document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
  eraserBtn.classList.remove('active');
  toolSlider.value = brushSize;
  updateToolSizePreview();
}

eraserBtn.addEventListener('click', () => {
  isEraser = !isEraser;
  eraserBtn.classList.toggle('active', isEraser);
  toolSlider.value = isEraser ? eraserSize : brushSize;
  updateToolSizePreview();
});

toolSlider.addEventListener('input', () => {
  const size = parseInt(toolSlider.value);
  if (isEraser) {
    eraserSize = size;
    localStorage.setItem('eraserSize', eraserSize);
  } else {
    brushSize = size;
    localStorage.setItem('brushSize', brushSize);
  }
  updateToolSizePreview();
});

toggleBtn.addEventListener('click', () => {
  drawEnabled = !drawEnabled;
  toggleBtn.textContent = drawEnabled ? '✋ Draw: ON' : '✋ Draw: OFF';
  toggleBtn.classList.toggle('off', !drawEnabled);
});

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') {
    toggleBtn.click();
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }
});

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  saveState();
}

function saveState() {
  undoStack.push(canvas.toDataURL());
  redoStack.length = 0;
}

function restoreCanvas(imageData) {
  const img = new Image();
  img.src = imageData;
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
}

function undo() {
  if (undoStack.length > 0) {
    redoStack.push(canvas.toDataURL());
    const imgData = undoStack.pop();
    restoreCanvas(imgData);
  }
}

function redo() {
  if (redoStack.length > 0) {
    undoStack.push(canvas.toDataURL());
    const imgData = redoStack.pop();
    restoreCanvas(imgData);
  }
}

document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => handleTouchAction(button.dataset.action));
});

function handleTouchAction(action) {
  switch (action) {
    case 'color-red': setColor('red'); break;
    case 'color-blue': setColor('blue'); break;
    case 'color-yellow': setColor('yellow'); break;
    case 'clear': clearCanvas(); break;
  }
}

function checkFingerTouch(x, y) {
  const now = Date.now();
  if (now - lastTapTime < TAP_COOLDOWN) return;

  const canvasRect = canvas.getBoundingClientRect(); // ← Get canvas screen position

  const screenX = canvasRect.left + x * (canvasRect.width / canvas.width);
  const screenY = canvasRect.top + y * (canvasRect.height / canvas.height);

  const allButtons = document.querySelectorAll('#controls button, #controls input');
  allButtons.forEach(btn => {
    const rect = btn.getBoundingClientRect();
    if (screenX >= rect.left && screenX <= rect.right &&
        screenY >= rect.top && screenY <= rect.bottom) {
      if (btn.dataset.action) {
        handleTouchAction(btn.dataset.action);
      } else {
        btn.click();
      }
      lastTapTime = now;
    }
  });
}


const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(results => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const tip = landmarks[8];
    const base = landmarks[6];

    const extended = tip.y < base.y - 0.05;
    const x = (1 - tip.x) * canvas.width;
    const y = tip.y * canvas.height;

    checkFingerTouch(x, y);

    if (drawEnabled && extended) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = isEraser ? eraserSize : brushSize;
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;

      if (!drawing) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (drawing) {
      drawing = false;
      ctx.globalCompositeOperation = 'source-over';
      saveState();
    }
  } else {
    if (drawing) {
      drawing = false;
      ctx.globalCompositeOperation = 'source-over';
      saveState();
    }
  }
});

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 1280,
  height: 720
});
camera.start();

setColor('red');
toolSlider.value = brushSize;
updateToolSizePreview();


// Optional: Support direct touch drawing for mobile
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;
  ctx.beginPath();
  ctx.moveTo(x, y);
  drawing = true;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (drawing) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    ctx.lineTo(x, y);
    ctx.stroke();
  }
});

canvas.addEventListener('touchend', () => {
  drawing = false;
  saveState();
});

