const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Canvas state
const canvasWidth = 800;
const canvasHeight = 400;
let canvasState = Array(canvasHeight).fill(0).map(() => Array(canvasWidth).fill("#FFFFFF"));

// Player list
let players = {}; // socketId -> playerId

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Send current canvas and player list to the new client
  socket.emit("initCanvas", canvasState);
  socket.emit("currentPlayers", Object.values(players));

  // When a new player joins
  socket.on("playerJoined", ({ id }) => {
    players[socket.id] = id;
    io.emit("playerJoined", { id });
  });

  // Pixel change
  socket.on("pixelChange", (data) => {
    const { x, y, color, player } = data;
    canvasState[y][x] = color;
    socket.broadcast.emit("pixelChange", data);
  });

  socket.on("disconnect", () => {
    const leftPlayer = players[socket.id];
    if(leftPlayer) {
      delete players[socket.id];
      io.emit("playerLeft", { id: leftPlayer });
    }
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));
