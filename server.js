import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { setHttpServer, setWebSockectServer } from "next-ws/server";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port: 3000, turbopack: true, watch: true });
const handle = app.getRequestHandler();

let wbs;
const rooms = {};
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  setHttpServer(server);

  if (!wbs) {
    wbs = new WebSocketServer({ noServer: true });
    setWebSockectServer(wbs);
    wbs.on("connection", (socket) => {
      console.log("New client connected");
      socket.on("close", (code, reason) => {
        console.log(
          `Client disconnected with code: ${code}, reason: ${reason}`
        );
      });
      socket.on("message", (message) => {
        const data = JSON.parse(message);
        console.log(data);
        const { action } = data;
        let roomId;
        if (action === "joinRoom") {
          roomId = Object.keys(rooms).find(
            (id) => rooms[id].players.length < 2
          );
          console.log(roomId);
          if (!roomId) {
            roomId = `room-${Object.keys(rooms).length + 1}`;
            console.log(roomId);

            rooms[roomId] = { players: [socket] };
          } else {
            rooms[roomId].players.push(socket);
          }
          socket.roomId = roomId;
          const room = rooms[socket.roomId];
          socket.send(
            JSON.stringify({ action: "joined", roomId: socket.roomId })
          );
          if (room.players.length === 2) {
            room.players.forEach((player) => {
              player.send(JSON.stringify({ action: "startGame", roomId }));
            });
          }
          console.log(`Player ${room.players.length} joined room ${roomId}`);
        }
        const room = rooms[socket.roomId];
        const playerIndex = room.players.indexOf(socket);
        const opponentIndex = playerIndex === 0 ? 1 : 0;

        if (action === "saveCode") {
          console.log(socket.roomId);
          const room = rooms[socket.roomId];
          const playerIndex = room.players.indexOf(socket);
          const opponentIndex = playerIndex === 0 ? 1 : 0;
          if (playerIndex > -1) {
            room.players[playerIndex].codeSet = true;
            socket.send(
              JSON.stringify({
                action: "codeSaved",
              })
            );
            console.log(socket.roomId);
            // console.log(room.players);
            console.log(room.players[0].codeSet, room.players[1].codeSet);

            if (room.players[0].codeSet && room.players[1].codeSet) {
              if (!room.starter) {
                const start = Math.floor(Math.random() * 2);
                room.starter = start;
              }
              console.log("room starter", room.starter, playerIndex);
              for (let i = 0; i < room.players.length; i++) {
                room.players[i].send(
                  JSON.stringify({
                    action: "ready",
                    turn: i == room.starter ? true : false,
                  })
                );
              }
            } else {
              room.players.forEach((player) => {
                player.send(
                  JSON.stringify({ action: "waiting for other player" })
                );
              });
            }
          }
        }
        if (action === "callCode") {
          const room = rooms[socket.roomId];
          const playerIndex = room.players.indexOf(socket);
          const opponentIndex = playerIndex === 0 ? 1 : 0;
          if (playerIndex > -1) {
            room.players[playerIndex].turn = true;
            room.players[opponentIndex].send(
              JSON.stringify({ action: "opponentCalledCode", code: data.code })
            );

            if (room.players[0].codeCalled && room.players[1].codeCalled) {
              const turn = Math.floor(Math.random() * 2);
              room.players.forEach((player) => {
                player.send(
                  JSON.stringify({
                    action: "ready",
                    turn: playerIndex === turn ? true : false,
                  })
                );
              });
            } else {
              room.players.forEach((player) => {
                player.send(
                  JSON.stringify({ action: "waiting for other player" })
                );
              });
            }
          }
        }
        if (action === "answer") {
          if (playerIndex > -1) {
            room.players[opponentIndex].send(
              JSON.stringify({
                action: "opponentAnswered",
                answer: data.answer,
              })
            );
          }
        }

        // console.log(`Received: ${message}`);
        else
          wbs.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
      });
      socket.on("close", () => {
        for (const roomId in rooms) {
          const room = rooms[roomId];
          const playerIndex = room.players.indexOf(socket);
          if (playerIndex > -1) {
            room.players.splice(playerIndex, 1);
            room.players.forEach((player) => {
              player.send(
                JSON.stringify({ action: `player ${playerIndex} quit` })
              );
            });
          }
        }
      });
    });
  }

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url);
    if (pathname === "/_next/webpack-hmr") {
      app.getUpgradeHandler()(request, socket, head);
    }
    if (pathname === "/server/socket") {
      wbs.handleUpgrade(request, socket, head, (ws) => {
        wbs.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log("> Ready on http://localhost:3000");
  });
});
