"use client";

import { useEffect, useRef, useState } from "react";
import { json } from "stream/consumers";

type calledCode = {
  code: string;
  answer: string;
};

export default function Hero() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [inRoom, setInRoom] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playerCodeinp, setPlayerCodeInp] = useState("");
  const [playingCode, setPlayingCode] = useState("");
  const [yourTurn, setYourTurn] = useState(false);
  const opponentCalledCode = useRef<calledCode[]>([]);
  const yourCalledCode = useRef<calledCode[]>([]);
  const [callInput, setCallInput] = useState("");
  const playCode = useRef("");

  // console.log(playing, inRoom, playerCodeinp);
  console.log("opponents calls", opponentCalledCode);
  console.log("your calls", yourCalledCode);

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

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    // Function to initialize WebSocket connection
    const initWebSocket = () => {
      const ws = new WebSocket(
        `${protocol}://${window.location.host}/server/socket`
      );
      setSocket(ws);

      ws.onopen = () => {
        console.log("Connected to WebSocket server");
      };

      ws.onmessage = async (event) => {
        const message = await checkifitBlob(event.data as any);
        console.log(message);
        const data = JSON.parse(message);
        if (data.action === "joined") {
          console.log("Joined room:", data.roomId);
          setInRoom(true);
        } else if (data.action === "startGame") {
          alert("Game is starting!");
          setInRoom(true);
          setPlaying(true);
        } else if (data.action === "saveCode") {
          console.log("Code saved");
        } else if (data.action === "ready") {
          setIsReady(true);
          setYourTurn(data.turn);
        } else if (data.action === "opponentCalledCode") {
          // check if the code is correct from opponent
          const code = data.code;
          console.log("from op", code, "mine", playCode.current);

          let injured = 0;
          let dead = 0;
          const opCodeCheck = code.split("");
          const myCodeChecker = playCode.current.split("");
          for (let i = 0; i < opCodeCheck.length; i++) {
            if (
              myCodeChecker.includes(opCodeCheck[i]) &&
              opCodeCheck[i] === myCodeChecker[i]
            ) {
              dead++;
            } else if (opCodeCheck.includes(myCodeChecker[i])) {
              injured++;
            }
          }

          if (dead === 4) {
            alert("You Lose");
            setPlaying(false);
            ws.send(JSON.stringify({ action: "Endgame", win: false }));
          }
          const answer = `${dead}Dead ${injured}Injured`;
          ws.send(
            JSON.stringify({
              action: "answer",
              answer,
            })
          );
          const updatedOpponentCalledCode = [
            ...opponentCalledCode.current,
            { code: data.code, answer },
          ];
          opponentCalledCode.current = updatedOpponentCalledCode;
          setYourTurn(true);
        } else if (data.action === "opponentAnswered") {
          const updatedYourCalledCode = [...yourCalledCode.current];
          console.log(updatedYourCalledCode);
          updatedYourCalledCode[updatedYourCalledCode.length - 1].answer =
            data.answer;
          yourCalledCode.current = updatedYourCalledCode;
        }
      };

      ws.onclose = () => {
        console.log("Disconnected from WebSocket server");
        setTimeout(() => {
          console.log("Reconnecting to WebSocket server...");
          initWebSocket(); // Re-initialize the WebSocket after a delay
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    };

    // Initialize WebSocket connection
    initWebSocket();

    // Clean up WebSocket connection when component unmounts
    return () => {
      if (socket) {
        socket.onclose = null; // Prevent reconnection on unmount
        socket.close();
      }
    };
  }, []); // Empty dependency array ensures this only runs once

  const joinRoom = () => {
    console.log("Joining room...");
    if (socket) {
      socket.send(JSON.stringify({ action: "joinRoom" }));
    }
  };

  const handleSaveCode = () => {
    setPlayingCode(playerCodeinp);
    playCode.current = playerCodeinp;
    if (socket && playing) {
      socket.send(JSON.stringify({ action: "saveCode" }));
    }
  };

  const handleCallCode = () => {
    if (socket && playing) {
      socket.send(JSON.stringify({ action: "callCode", code: callInput }));
      setYourTurn(false);
      const updatedYourCalledCode = [
        ...yourCalledCode.current,
        { code: callInput, answer: "" },
      ];
      yourCalledCode.current = updatedYourCalledCode;
    }
  };

  return (
    <div className="flex-col gap-10  flex ">
      <button
        className="bg-red-500 text-white py-3  rounded"
        onClick={joinRoom}
        disabled={inRoom}
      >
        {inRoom && !playing
          ? "Waiting to match"
          : playing
          ? "Best Luck"
          : "Play"}
      </button>

      {playing && !isReady ? (
        <>
          <input
            placeholder="input you code...."
            value={playerCodeinp}
            onChange={(e) => setPlayerCodeInp(e.target.value)}
          />
          <button onClick={handleSaveCode}>Save</button>
        </>
      ) : (
        isReady && (
          <div>
            {yourTurn ? (
              <>
                <p>You turn</p>
                <input
                  value={callInput}
                  onChange={(e) => setCallInput(e.target.value)}
                  type="text"
                />
                <button onClick={handleCallCode}>Send</button>
              </>
            ) : (
              <>
                <p>Waiting For opponent to call</p>
              </>
            )}
          </div>
        )
      )}
      <div className="grid bg-slate-400 p-2 gap-3 grid-cols-2">
        <div className="bg-white p-3 items-center grid gap-1">
          <h3>Your Calls</h3>
          {yourCalledCode.current.map((call) => (
            <div>
              <span>Code:{call.code}</span>
              <span>, {call.answer}</span>
            </div>
          ))}
        </div>
        <div className="bg-white p-3 items-center grid gap-1">
          <h3>Opponent Calls</h3>
          {opponentCalledCode.current.map((call) => (
            <div>
              <span>Code:{call.code}</span>
              <span>, {call.answer}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
