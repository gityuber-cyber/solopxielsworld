const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public
app.use(express.static("public"));

// Canvas setup
const canvasSize = 80;
let canvasState = Array(canvasSize).fill(0).map(() => Array(canvasSize).fill("#FFFFFF"));

// Socket.IO
io.on("connection", socket => {
  console.log("New client connected");

  // send initial canvas
  socket.emit("initCanvas", canvasState);

  // listen for pixel changes
  socket.on("pixelChange", ({ x, y, color }) => {
    canvasState[y][x] = color;
    socket.broadcast.emit("pixelChange", { x, y, color });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
