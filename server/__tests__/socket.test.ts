import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { setupSocketHandlers } from "../src/socket.js";
import { StateManager } from "../src/state.js";
import { Database } from "../src/db.js";

function waitFor(socket: ClientSocket, event: string): Promise<any> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe("Socket Events", () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: Server;
  let db: Database;
  let state: StateManager;
  let client1: ClientSocket;
  let client2: ClientSocket;
  let port: number;

  beforeEach(async () => {
    db = new Database(":memory:");
    state = new StateManager(db);
    httpServer = createServer();
    ioServer = new Server(httpServer, { cors: { origin: "*" } });
    setupSocketHandlers(ioServer, state);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    client1?.disconnect();
    client2?.disconnect();
    state.stopAutoSave();
    db.close();
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connect(): ClientSocket {
    return ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
  }

  it("joins a session and receives state", async () => {
    const session = state.createSession();
    client1 = connect();
    client1.emit("session:join", session.id);
    const data = await waitFor(client1, "session:state");
    expect(data.id).toBe(session.id);
  });

  it("receives error for invalid session", async () => {
    client1 = connect();
    client1.emit("session:join", "NOPE");
    const err = await waitFor(client1, "session:error");
    expect(err.message).toMatch(/not found/i);
  });

  it("broadcasts token:added to other clients", async () => {
    const session = state.createSession();
    client1 = connect();
    client2 = connect();
    client1.emit("session:join", session.id);
    await waitFor(client1, "session:state");
    client2.emit("session:join", session.id);
    await waitFor(client2, "session:state");

    const addedPromise = waitFor(client2, "token:added");
    client1.emit("token:add", { name: "Fighter", color: "#ff0000", x: 100, y: 200 });
    const token = await addedPromise;
    expect(token.name).toBe("Fighter");
  });

  it("broadcasts token:moved to other clients", async () => {
    const session = state.createSession();
    const t = state.addToken(session.id, { name: "Rogue", color: "#00ff00", x: 0, y: 0 });
    client1 = connect();
    client2 = connect();
    client1.emit("session:join", session.id);
    await waitFor(client1, "session:state");
    client2.emit("session:join", session.id);
    await waitFor(client2, "session:state");

    const movedPromise = waitFor(client2, "token:moved");
    client1.emit("token:move", { id: t!.id, x: 500, y: 600 });
    const moved = await movedPromise;
    expect(moved.x).toBe(500);
    expect(moved.y).toBe(600);
  });

  it("broadcasts token:removed to other clients", async () => {
    const session = state.createSession();
    const t = state.addToken(session.id, { name: "Wizard", color: "#0000ff", x: 0, y: 0 });
    client1 = connect();
    client2 = connect();
    client1.emit("session:join", session.id);
    await waitFor(client1, "session:state");
    client2.emit("session:join", session.id);
    await waitFor(client2, "session:state");

    const removedPromise = waitFor(client2, "token:removed");
    client1.emit("token:remove", { id: t!.id });
    const removed = await removedPromise;
    expect(removed.id).toBe(t!.id);
  });

  it("broadcasts grid:updated to other clients", async () => {
    const session = state.createSession();
    client1 = connect();
    client2 = connect();
    client1.emit("session:join", session.id);
    await waitFor(client1, "session:state");
    client2.emit("session:join", session.id);
    await waitFor(client2, "session:state");

    const updatedPromise = waitFor(client2, "grid:updated");
    client1.emit("grid:update", { gridMode: "hex", gridSize: 60 });
    const updated = await updatedPromise;
    expect(updated.gridMode).toBe("hex");
    expect(updated.gridSize).toBe(60);
  });

  it("triggers save on session:save event", async () => {
    const session = state.createSession();
    state.addToken(session.id, { name: "Paladin", color: "#ffff00", x: 10, y: 20 });
    client1 = connect();
    client1.emit("session:join", session.id);
    await waitFor(client1, "session:state");

    const savedPromise = waitFor(client1, "session:saved");
    client1.emit("session:save");
    await savedPromise;

    const loaded = db.loadSession(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.tokens).toHaveLength(1);
  });
});
