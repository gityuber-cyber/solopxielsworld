const socket = io();

// ===== CONFIG =====
const pixelSize = 10;
const canvasWidthInPixels = 800;
const canvasHeightInPixels = 400;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ===== OFFSCREEN CANVAS =====
const offscreen = document.createElement("canvas");
offscreen.width = canvasWidthInPixels * pixelSize;
offscreen.height = canvasHeightInPixels * pixelSize;
const offCtx = offscreen.getContext("2d");

// ===== STATE =====
let canvasState = Array(canvasHeightInPixels).fill(0)
  .map(() => Array(canvasWidthInPixels).fill("#FFFFFF"));

let currentColor = "#FF0000";
let painting = false;
let mouseDown = false;

// ===== UNDO STACK =====
const undoStack = []; // {x, y, oldColor}

// ===== VIEW TRANSFORM =====
let scale = Math.min(canvas.width / (canvasWidthInPixels * pixelSize), canvas.height / (canvasHeightInPixels * pixelSize));
let offsetX = (canvas.width - canvasWidthInPixels * pixelSize * scale) / 2;
let offsetY = (canvas.height - canvasHeightInPixels * pixelSize * scale) / 2;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// ===== COLOR PICKER =====
const colors = [
  "#000000","#3c3c3c","#787878","#d2d2d2","#ffffff",
  "#600018","#ed1c24","#ff7f27","#f6aa09","#f9dd3b","#fffabc",
  "#0eb968","#13e67b","#87ff5e","#138472","#189b9a","#58d6d7",
  "#6150da","#99b1fb","#780c99","#aa38b9","#e09ff9",
  "#cb007a","#ec1f80","#f38da9","#684634","#95682a","#f8b277"
];

const colorPickerContainer = document.getElementById("color-picker");
colors.forEach(color => {
  const btn = document.createElement("button");
  btn.style.backgroundColor = color;
  btn.style.width = "50px";
  btn.style.height = "50px";
  btn.style.margin = "5px";
  btn.style.border = "1px solid #444";
  btn.onclick = () => currentColor = color;
  colorPickerContainer.appendChild(btn);
});

// ===== PLAYER LIST BOTTOM BAR =====
const playerListDiv = document.createElement("div");
playerListDiv.id = "player-list";
playerListDiv.style.cssText = `
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  z-index: 9999;
`;
document.body.appendChild(playerListDiv);

const playersOnline = new Set();
function updatePlayerList() {
  playerListDiv.textContent = Array.from(playersOnline).join(", ");
}

// ===== LEADERBOARD LEFT SIDE =====
const leaderboardDiv = document.createElement("div");
leaderboardDiv.id = "leaderboard";
leaderboardDiv.style.cssText = `
  position: fixed;
  top: 80px;
  left: 10px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  z-index: 9999;
  max-height: 300px;
  overflow-y: auto;
`;
document.body.appendChild(leaderboardDiv);

const playerPixels = {}; // playerId -> count
function updateLeaderboard() {
  leaderboardDiv.innerHTML = "<strong>Leaderboard</strong><br>";
  const sorted = Object.entries(playerPixels).sort((a,b)=>b[1]-a[1]);
  sorted.forEach(([id, count]) => {
    const div = document.createElement("div");
    div.textContent = `${id}: ${count} px`;
    leaderboardDiv.appendChild(div);
  });
}

// ===== NOTIFICATIONS =====
const notifications = document.createElement("div");
notifications.id = "notifications";
notifications.style.cssText = `
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 9999;
  pointer-events: none;
`;
document.body.appendChild(notifications);

function randomHashtag() {
  return '#' + Math.random().toString(36).substring(2, 8);
}

function showNotification(message) {
  const div = document.createElement("div");
  div.textContent = message;
  div.style.background = "rgba(0,0,0,0.8)";
  div.style.color = "#fff";
  div.style.padding = "8px 12px";
  div.style.borderRadius = "8px";
  div.style.fontFamily = "monospace";
  div.style.fontSize = "14px";
  div.style.opacity = "0";
  div.style.transition = "opacity 0.3s, transform 0.3s";
  div.style.transform = "translateY(10px)";
  notifications.appendChild(div);

  requestAnimationFrame(() => {
    div.style.opacity = "1";
    div.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transform = "translateY(10px)";
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

// ===== PLAYER ID =====
const myPlayerId = randomHashtag();
playersOnline.add(myPlayerId);
playerPixels[myPlayerId] = 0;

// ===== SOCKET EVENTS =====
socket.emit("playerJoined", { id: myPlayerId });

// Receive current players
socket.on("currentPlayers", (list) => {
  list.forEach(id => {
    playersOnline.add(id);
    if(!playerPixels[id]) playerPixels[id] = 0;
  });
  updatePlayerList();
  updateLeaderboard();
});

// Player joined
socket.on("playerJoined", ({ id }) => {
  playersOnline.add(id);
  playerPixels[id] = 0;
  updatePlayerList();
  updateLeaderboard();
  showNotification(`Player ${id} joined`);
});

// Player left
socket.on("playerLeft", ({ id }) => {
  playersOnline.delete(id);
  delete playerPixels[id];
  updatePlayerList();
  updateLeaderboard();
  showNotification(`Player ${id} left`);
});

// Canvas init
socket.on("initCanvas", state => {
  canvasState = state;
  redrawOffscreen();
  drawCanvas();
});

// Pixel change
socket.on("pixelChange", ({ x, y, color, player }) => {
  canvasState[y][x] = color;
  offCtx.fillStyle = color;
  offCtx.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);
  if(player){
    playerPixels[player] = (playerPixels[player] || 0) + 1;
    updateLeaderboard();
  }
  drawCanvas();
});

// ===== DRAW OFFSCREEN =====
function redrawOffscreen() {
  for (let y = 0; y < canvasHeightInPixels; y++) {
    for (let x = 0; x < canvasWidthInPixels; x++) {
      offCtx.fillStyle = canvasState[y][x];
      offCtx.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);
    }
  }
}

// ===== DRAW MAIN CANVAS =====
function drawCanvas() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, offsetX, offsetY, offscreen.width*scale, offscreen.height*scale);

  // red border
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  ctx.strokeRect(offsetX, offsetY, offscreen.width*scale, offscreen.height*scale);
}

// ===== HELPER =====
function getPixelUnderCursor(e){
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  let x = Math.floor((mouseX - offsetX)/(pixelSize*scale));
  let y = Math.floor((mouseY - offsetY)/(pixelSize*scale));
  x = Math.max(0, Math.min(canvasWidthInPixels-1, x));
  y = Math.max(0, Math.min(canvasHeightInPixels-1, y));
  return {x,y};
}

// ===== PAINT =====
function paint(e){
  const {x,y} = getPixelUnderCursor(e);

  // save for undo
  undoStack.push({x, y, oldColor: canvasState[y][x]});

  canvasState[y][x] = currentColor;
  offCtx.fillStyle = currentColor;
  offCtx.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);

  playerPixels[myPlayerId] += 1;
  updateLeaderboard();

  socket.emit("pixelChange", {x, y, color: currentColor, player: myPlayerId});
  drawCanvas();
}

// ===== MOUSE EVENTS =====
canvas.addEventListener("mousedown", e=>{
  if(painting){ mouseDown = true; paint(e); }
  else { isDragging = true; dragStartX = e.clientX - offsetX; dragStartY = e.clientY - offsetY; canvas.style.cursor="grabbing"; }
});
canvas.addEventListener("mousemove", e=>{
  if(painting && mouseDown) paint(e);
  else if(isDragging){ offsetX = e.clientX - dragStartX; offsetY = e.clientY - dragStartY; drawCanvas(); }
});
canvas.addEventListener("mouseup", ()=>{
  mouseDown=false; isDragging=false; canvas.style.cursor="grab";
});
canvas.addEventListener("contextmenu", e=> e.preventDefault());

// ===== SPACEBAR PAINT TOGGLE =====
document.addEventListener("keydown", e=>{
  if(e.code==="Space"){ painting=true; canvas.style.cursor="crosshair"; e.preventDefault();}
});
document.addEventListener("keyup", e=>{
  if(e.code==="Space"){ painting=false; mouseDown=false; canvas.style.cursor="grab";}
});

// ===== ZOOM =====
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const zoomFactor=1.1;
  const rect=canvas.getBoundingClientRect();
  const mouseX=e.clientX - rect.left;
  const mouseY=e.clientY - rect.top;
  const worldX=(mouseX-offsetX)/(pixelSize*scale);
  const worldY=(mouseY-offsetY)/(pixelSize*scale);
  scale = e.deltaY<0 ? scale*zoomFactor : scale/zoomFactor;
  offsetX = mouseX - worldX*pixelSize*scale;
  offsetY = mouseY - worldY*pixelSize*scale;
  drawCanvas();
});

// ===== UNDO =====
document.addEventListener("keydown", e=>{
  if((e.ctrlKey || e.metaKey) && e.key==="z"){
    if(undoStack.length>0){
      const last = undoStack.pop();
      canvasState[last.y][last.x] = last.oldColor;
      offCtx.fillStyle = last.oldColor;
      offCtx.fillRect(last.x*pixelSize,last.y*pixelSize,pixelSize,pixelSize);
      drawCanvas();
      socket.emit("pixelChange",{x:last.x,y:last.y,color:last.oldColor,player:myPlayerId});
      playerPixels[myPlayerId] = Math.max(0, playerPixels[myPlayerId]-1);
      updateLeaderboard();
    }
  }
});

// ===== INITIAL DRAW =====
redrawOffscreen();
drawCanvas();
canvas.style.cursor="grab";
