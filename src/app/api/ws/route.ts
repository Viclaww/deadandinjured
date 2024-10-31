import { Interface } from "node:readline";
import { WebSocket } from "ws";
export function GET() {
  const headers = new Headers();
  headers.set("Connection", "Upgrade");
  headers.set("Upgrade", "websocket");
  return new Response("Upgrade Required", { status: 426, headers });
}
interface Player extends WebSocket {
  codeSet: boolean;
  codeCalled: boolean;
  turn?: boolean;
  roomId: string;
}

interface Room {
  players: Player[];
  starter?: number;
}
const rooms: { [key: string]: Room } = {};

const checkifitBlob = async (blob: any): Promise<string> => {
  if (blob instanceof Blob) {
    // Convert Blob to text
    console.log("Blob received:", blob);
    blob.text().then((string) => {
      try {
        return string;
      } catch (error) {
        console.error("Error parsing message:", error);
        return blob;
      }
    });
  }
  return blob;
};

export function SOCKET(
  client: Player,
  _request: import("node:http").IncomingMessage,
  server: import("ws").WebSocketServer
) {
  const { send, broadcast } = createHelpers(client, server);

  // When a new client connects broadcast a connect message
  broadcast({ author: "Server", content: "A new client has connected." });
  send({ author: "Server", content: "Welcome!" });

  // Relay any message back to other clients
  client.on("message", async (message) => {
    const data = JSON.parse(await checkifitBlob(message.toString()));

    const { action } = data;
    let roomId: string | undefined;
    if (action === "joinRoom") {
      roomId = Object.keys(rooms).find(
        (id: string) => rooms[id].players.length < 2
      );
      console.log(roomId);
      if (!roomId) {
        roomId = `room-${Object.keys(rooms).length + 1}`;
        console.log(roomId);

        rooms[roomId] = { players: [client] };
      } else {
        rooms[roomId].players.push(client);
      }
      client.roomId = roomId;
      const room = rooms[client.roomId];
      client.send(JSON.stringify({ action: "joined", roomId: client.roomId }));
      if (room.players.length === 2) {
        room.players.forEach((player: Player) => {
          player.send(JSON.stringify({ action: "startGame", roomId }));
        });
      }
      console.log(`Player ${room.players.length} joined room ${roomId}`);
    }
    const room = rooms[client.roomId];
    const playerIndex = room.players.indexOf(client);
    const opponentIndex = playerIndex === 0 ? 1 : 0;

    if (action === "saveCode") {
      console.log(client.roomId);
      const room = rooms[client.roomId];
      const playerIndex = room.players.indexOf(client);
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      if (playerIndex > -1) {
        room.players[playerIndex].codeSet = true;
        client.send(
          JSON.stringify({
            action: "codeSaved",
          })
        );
        // console.log(client.roomId);
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
          room.players.forEach((player: Player) => {
            player.send(JSON.stringify({ action: "waiting for other player" }));
          });
        }
      }
    }
    if (action === "callCode") {
      const room = rooms[client.roomId];
      const playerIndex = room.players.indexOf(client);
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
            player.send(JSON.stringify({ action: "waiting for other player" }));
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
      server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
  });

  // When this client disconnects broadcast a disconnect message
  client.on("close", () => {
    broadcast({ author: "Server", content: "A client has disconnected." });
  });
}

function createHelpers(
  client: import("ws").WebSocket,
  server: import("ws").WebSocketServer
) {
  const send = (payload: unknown) => client.send(JSON.stringify(payload));
  const broadcast = (payload: unknown) => {
    if (payload instanceof Buffer) payload = payload.toString();
    if (typeof payload !== "string") payload = JSON.stringify(payload);
    for (const other of server.clients)
      if (other !== client) other.send(String(payload));
  };
  return { send, broadcast };
}
