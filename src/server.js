const http = require("http");
const fs = require("fs").promises;
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "..", "data", "notes.json");

// In-memory cache for notes to eliminate disk I/O on hot path
let cachedNotes = null;

async function loadNotes() {
  if (cachedNotes !== null) {
    return cachedNotes;
  }
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const notes = JSON.parse(raw);
    cachedNotes = Array.isArray(notes) ? notes : [];
  } catch (error) {
    cachedNotes = [];
  }
  return cachedNotes;
}

async function saveNotes(notes) {
  cachedNotes = notes;
  const backupPath = DATA_FILE + ".backup";
  const json = JSON.stringify(notes, null, 2);

  try {
    const current = await fs.readFile(DATA_FILE, "utf8");
    await fs.writeFile(backupPath, current);
  } catch (err) {
    // ignore backup error if file doesn't exist yet
  }

  await fs.writeFile(DATA_FILE, json);
}

function sendJson(res, statusCode, value) {
  const body = JSON.stringify(value, null, 2);

  res.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    "x-powered-by": "sleepy-sync-code"
  });
  res.end(body);
}

function sendNotFound(res) {
  sendJson(res, 404, { error: "not found" });
}

function getRequestBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(body || "{}");
        resolve(parsed);
      } catch (error) {
        resolve({});
      }
    });

    req.on("error", () => {
      resolve({});
    });
  });
}

function parseUrl(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pieces = url.pathname.split("/").filter(Boolean);
  return { url, pieces };
}

async function route(req, res) {
  const method = req.method || "GET";
  const { url, pieces } = parseUrl(req);

  if (method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      warning: "healthy endpoint still blocks a little"
    });
  }

  if (method === "GET" && url.pathname === "/slow-block") {
    const requestedMs = Number(url.searchParams.get("ms") || 1000);
    const ms = Math.min(Math.max(requestedMs, 0), 15000);

    if (ms > 0) {
      await new Promise(resolve => setTimeout(resolve, ms));
    }

    return sendJson(res, 200, {
      blockedForMs: ms,
      note: "this route intentionally blocked the event loop"
    });
  }

  if (method === "GET" && url.pathname === "/stats") {
    const notes = await loadNotes();
    const totalTextLength = notes.reduce((sum, note) => {
      return sum + String(note.title || "").length + String(note.body || "").length;
    }, 0);

    return sendJson(res, 200, {
      noteCount: notes.length,
      totalTextLength,
      generatedAt: new Date().toISOString()
    });
  }

  if (pieces[0] !== "notes") {
    return sendNotFound(res);
  }

  if (method === "GET" && pieces.length === 1) {
    const notes = await loadNotes();

    const sorted = notes.slice().sort((a, b) => {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });

    return sendJson(res, 200, {
      count: sorted.length,
      notes: sorted
    });
  }

  if (method === "GET" && pieces.length === 2) {
    const notes = await loadNotes();
    const id = pieces[1];
    const note = notes.find(n => n.id === id);

    if (!note) {
      return sendNotFound(res);
    }

    return sendJson(res, 200, note);
  }

  if (method === "POST" && pieces.length === 1) {
    const input = await getRequestBody(req);
    const notes = await loadNotes();
    const now = new Date().toISOString();

    const note = {
      id: String(Date.now()),
      title: String(input.title || "Untitled"),
      body: String(input.body || ""),
      createdAt: now,
      updatedAt: now
    };

    const newNotes = [...notes, note];
    await saveNotes(newNotes);

    return sendJson(res, 201, note);
  }

  if (method === "PUT" && pieces.length === 2) {
    const input = await getRequestBody(req);
    const notes = await loadNotes();
    const id = pieces[1];
    
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
      return sendNotFound(res);
    }

    const updatedNote = {
      ...notes[index],
      title: String(input.title || notes[index].title || "Untitled"),
      body: String(input.body || notes[index].body || ""),
      updatedAt: new Date().toISOString()
    };

    const newNotes = [...notes];
    newNotes[index] = updatedNote;

    await saveNotes(newNotes);

    return sendJson(res, 200, updatedNote);
  }

  if (method === "DELETE" && pieces.length === 2) {
    const notes = await loadNotes();
    const id = pieces[1];
    
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
      return sendNotFound(res);
    }

    const removed = notes[index];
    const newNotes = notes.filter((_, i) => i !== index);

    await saveNotes(newNotes);

    return sendJson(res, 200, {
      deleted: true,
      note: removed
    });
  }

  sendNotFound(res);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    sendJson(res, 500, {
      error: "server exploded slowly",
      message: error.message
    });
  });
});

server.listen(PORT, () => {
  console.log(`Bad Notes Perf Lab listening on http://localhost:${PORT}`);
});
