import { NextRequest, NextResponse } from "next/server";
import { WebSocketServer } from "ws";

let wbs: WebSocketServer | undefined;
let playersReady = 0;

export function GET() {
  if (!wbs) {
    wbs = new WebSocketServer({ noServer: true });
    wbs.on("connection", (socket) => {
      console.log("New client connected!");
      socket.on("disconnect", () => {
        console.log("Client disconnected hmmm");
      });
      socket.on("message", (message) => {
        const data = JSON.parse(message.toString());
        if (data.action === "ready") {
          playersReady++;
          if (playersReady === 2) {
            // Start the game when both players are ready
            wbs?.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ action: "startGame" }));
              }
            });
            playersReady = 0; // Reset for next game
          }
        }

        wbs?.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      });

      socket.on("close", () => {
        console.log("Client closes");
      });
    });
  }

  return NextResponse.json(
    { message: "WebSocket server setup" },
    { status: 200 }
  );
  return { message: "the" };
}

export const config = {
  api: {
    bodyParser: false,
  },
};
