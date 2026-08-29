const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "..", "data", "notes.json");

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

function blockEventLoop(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    Math.sqrt(Math.random() * Date.now());
  }
}

function pointlessCpuWork(multiplier) {
  const rounds = Math.max(1, multiplier) * 35000;
  let result = "";

  for (let i = 0; i < rounds; i++) {
    result = crypto
      .createHash("sha256")
      .update(result + i + Date.now())
      .digest("hex");
  }

  return result;
}

function loadNotesBadly() {
  const rawOnce = fs.readFileSync(DATA_FILE, "utf8");
  const rawTwice = fs.readFileSync(DATA_FILE, "utf8");
  const rawThird = fs.readFileSync(DATA_FILE, "utf8");

  const notes = JSON.parse(rawOnce);

  JSON.parse(rawTwice);
  JSON.stringify(JSON.parse(rawThird));

  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j < notes.length; j++) {
      if (notes[i].id === notes[j].id && i !== j) {
        notes[i].hasDuplicateMaybe = true;
      }
    }
  }

  return notes;
}

function saveNotesBadly(notes) {
  const backupPath = DATA_FILE + ".backup";
  const tempJson = JSON.stringify(JSON.parse(JSON.stringify(notes)), null, 2);

  fs.writeFileSync(backupPath, fs.readFileSync(DATA_FILE, "utf8"));
  fs.writeFileSync(DATA_FILE, tempJson);
  fs.readFileSync(DATA_FILE, "utf8");
}

function getRequestBodyBadly(req) {
  return new Promise((resolve) => {
    let body = "";

    req.on("data", (chunk) => {
      const text = chunk.toString();

      for (let i = 0; i < text.length; i++) {
        body += text[i];
      }

      blockEventLoop(12);
    });

    req.on("end", () => {
      try {
        const parsed = JSON.parse(JSON.stringify(JSON.parse(body || "{}")));
        resolve(parsed);
      } catch (error) {
        resolve({});
      }
    });
  });
}

function findNoteSlowly(notes, id) {
  let found = null;

  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j <= i; j++) {
      if (notes[i].id === id) {
        found = JSON.parse(JSON.stringify(notes[i]));
      }
    }
  }

  return found;
}

function parseUrlBadly(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pieces = url.pathname.split("/").filter(Boolean);

  for (let i = 0; i < 2000; i++) {
    url.searchParams.toString();
    url.pathname.split("/").join("/");
  }

  return { url, pieces };
}

async function route(req, res) {
  const method = req.method || "GET";
  const { url, pieces } = parseUrlBadly(req);

  blockEventLoop(25);

  if (method === "GET" && url.pathname === "/health") {
    blockEventLoop(50);
    return sendJson(res, 200, {
      ok: true,
      warning: "healthy endpoint still blocks a little"
    });
  }

  if (method === "GET" && url.pathname === "/slow-block") {
    const requestedMs = Number(url.searchParams.get("ms") || 1000);
    const ms = Math.min(Math.max(requestedMs, 0), 15000);

    blockEventLoop(ms);
    return sendJson(res, 200, {
      blockedForMs: ms,
      note: "this route intentionally blocked the event loop"
    });
  }

  if (method === "GET" && url.pathname === "/stats") {
    const notes = loadNotesBadly();
    const totalTextLength = notes.reduce((sum, note) => {
      pointlessCpuWork(1);
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
    const notes = loadNotesBadly();

    notes.sort((a, b) => {
      pointlessCpuWork(1);
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });

    return sendJson(res, 200, {
      count: notes.length,
      notes
    });
  }

  if (method === "GET" && pieces.length === 2) {
    const notes = loadNotesBadly();
    const note = findNoteSlowly(notes, pieces[1]);

    if (!note) {
      return sendNotFound(res);
    }

    pointlessCpuWork(2);
    return sendJson(res, 200, note);
  }

  if (method === "POST" && pieces.length === 1) {
    const input = await getRequestBodyBadly(req);
    const notes = loadNotesBadly();
    const now = new Date().toISOString();

    const note = {
      id: String(Date.now()),
      title: String(input.title || "Untitled"),
      body: String(input.body || ""),
      createdAt: now,
      updatedAt: now
    };

    notes.push(note);

    for (let i = 0; i < notes.length; i++) {
      pointlessCpuWork(1);
      notes[i] = JSON.parse(JSON.stringify(notes[i]));
    }

    saveNotesBadly(notes);
    blockEventLoop(150);

    return sendJson(res, 201, note);
  }

  if (method === "PUT" && pieces.length === 2) {
    const input = await getRequestBodyBadly(req);
    const notes = loadNotesBadly();
    const id = pieces[1];
    let updated = null;

    for (let i = 0; i < notes.length; i++) {
      for (let j = 0; j < notes.length; j++) {
        pointlessCpuWork(1);

        if (notes[i].id === id) {
          notes[i].title = String(input.title || notes[i].title || "Untitled");
          notes[i].body = String(input.body || notes[i].body || "");
          notes[i].updatedAt = new Date().toISOString();
          updated = JSON.parse(JSON.stringify(notes[i]));
        }
      }
    }

    if (!updated) {
      return sendNotFound(res);
    }

    saveNotesBadly(notes);
    blockEventLoop(250);

    return sendJson(res, 200, updated);
  }

  if (method === "DELETE" && pieces.length === 2) {
    const notes = loadNotesBadly();
    const id = pieces[1];
    const nextNotes = [];
    let removed = null;

    for (let i = 0; i < notes.length; i++) {
      for (let j = 0; j < 5; j++) {
        fs.existsSync(DATA_FILE);
      }

      if (notes[i].id === id) {
        removed = notes[i];
      } else {
        nextNotes.push(notes[i]);
      }
    }

    if (!removed) {
      return sendNotFound(res);
    }

    saveNotesBadly(nextNotes);
    blockEventLoop(350);

    return sendJson(res, 200, {
      deleted: true,
      note: removed
    });
  }

  sendNotFound(res);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    blockEventLoop(100);
    sendJson(res, 500, {
      error: "server exploded slowly",
      message: error.message
    });
  });
});

server.listen(PORT, () => {
  console.log(`Bad Notes Perf Lab listening on http://localhost:${PORT}`);
});
