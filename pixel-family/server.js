const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const canvasSize = 128;
const canvasState = Array(canvasSize).fill(0).map(()=>Array(canvasSize).fill("#FFFFFF"));

app.use(express.static('public'));

io.on('connection', socket => {
  console.log("New client connected");

  socket.emit('initCanvas', canvasState);

  socket.on('pixelChange', ({x, y, color}) => {
    canvasState[y][x] = color;
    socket.broadcast.emit('pixelChange', {x, y, color});
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
