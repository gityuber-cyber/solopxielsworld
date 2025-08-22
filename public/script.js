const socket = io();
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("canvas-container");
const colorPickerContainer = document.getElementById("color-picker");

// ===== CANVAS SIZE =====
const canvasSize = 80;
const pixelSize = 20;
canvas.width = canvasSize * pixelSize;
canvas.height = canvasSize * pixelSize;

let canvasState = Array(canvasSize).fill(0).map(() => Array(canvasSize).fill("#FFFFFF"));

// ===== WALL / DEAD ZONE =====
const wall = {
  x: 5,
  y: 5,
  width: 70,
  height: 70
};

// ===== COLOR PICKER =====
const colors = ["#000000","#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#FFA500","#800080","#00FFFF","#FFC0CB"];
let currentColor = "#FF0000";

colors.forEach(color=>{
  const btn = document.createElement("button");
  btn.style.backgroundColor = color;
  btn.addEventListener("click", ()=> currentColor=color);
  colorPickerContainer.appendChild(btn);
});

// ===== GLOBALS FOR ZOOM/PAN =====
let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let dragStart = { x:0, y:0 };
let justDragged = false;

// ===== CURSOR PREVIEW =====
/* disabled for moment bec mobile would be added */
//const cursorPreview = document.createElement("div");
//cursorPreview.style.position = "absolute";
//cursorPreview.style.width = `${pixelSize}px`;
//cursorPreview.style.height = `${pixelSize}px`;
//cursorPreview.style.border = "1px solid black";
//cursorPreview.style.pointerEvents = "none";
//cursorPreview.style.transformOrigin = "top left";
//container.appendChild(cursorPreview);

// ===== DRAW FUNCTION =====
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      ctx.fillStyle = canvasState[y][x];
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);

      // draw black grid lines
      ctx.strokeStyle = "black";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }

  // Draw red border for wall
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(wall.x * pixelSize, wall.y * pixelSize, wall.width * pixelSize, wall.height * pixelSize);

  // Gray overlay outside wall
  ctx.fillStyle = "rgba(200,200,200,0.5)";
  ctx.fillRect(0, 0, canvas.width, wall.y * pixelSize); // top
  ctx.fillRect(0, (wall.y + wall.height) * pixelSize, canvas.width, canvas.height - (wall.y + wall.height) * pixelSize); // bottom
  ctx.fillRect(0, wall.y * pixelSize, wall.x * pixelSize, wall.height * pixelSize); // left
  ctx.fillRect((wall.x + wall.width) * pixelSize, wall.y * pixelSize, canvas.width - (wall.x + wall.width) * pixelSize, wall.height * pixelSize); // right
}

// ===== SOCKET EVENTS =====
socket.on('initCanvas', state => {
  canvasState = state;
  drawCanvas();
});

socket.on('pixelChange', ({x, y, color}) => {
  canvasState[y][x] = color;
  drawCanvas();
});

// ===== PAN & DRAW =====
canvas.addEventListener("mousedown", e => {
  dragStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
  isDragging = true;
  justDragged = false;
});

canvas.addEventListener("mousemove", e => {
  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // update cursor preview
  const px = Math.floor((mouseX - offsetX) / scale / pixelSize) * pixelSize;
  const py = Math.floor((mouseY - offsetY) / scale / pixelSize) * pixelSize;
  cursorPreview.style.left = `${px * scale + offsetX}px`;
  cursorPreview.style.top = `${py * scale + offsetY}px`;
  cursorPreview.style.width = `${pixelSize * scale}px`;
  cursorPreview.style.height = `${pixelSize * scale}px`;

  // handle drag
  if (!isDragging) return;
  const dx = e.clientX - dragStart.x - offsetX;
  const dy = e.clientY - dragStart.y - offsetY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) justDragged = true;
  offsetX = e.clientX - dragStart.x;
  offsetY = e.clientY - dragStart.y;
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  cursorPreview.style.transform = `scale(${scale})`;
});

canvas.addEventListener("mouseup", e => {
  if (!justDragged) {
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = Math.floor((mouseX - offsetX) / scale / pixelSize);
    const y = Math.floor((mouseY - offsetY) / scale / pixelSize);

    if (x < wall.x || x >= wall.x + wall.width || y < wall.y || y >= wall.y + wall.height) return;

    canvasState[y][x] = currentColor;
    drawCanvas();
    socket.emit('pixelChange', { x, y, color: currentColor });
  }
  isDragging = false;
});

canvas.addEventListener("mouseleave", () => isDragging = false);

// ===== ZOOM WITH CURSOR =====
container.addEventListener("wheel", e=>{
  e.preventDefault();
  const zoomFactor = 1.1;

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;

  // adjust offset to zoom on cursor
  offsetX = mouseX - ((mouseX - offsetX) * (newScale / scale));
  offsetY = mouseY - ((mouseY - offsetY) * (newScale / scale));

  scale = newScale;
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  cursorPreview.style.transform = `scale(${scale})`;
});
