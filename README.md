# Bad Notes Performance Lab

This is a tiny Node notes API with deliberately inefficient code paths for learning and performance testing.

It uses only built-in Node modules. No database, no framework, no tests, and no optimized implementation.

## Run

```bash
npm run dev
```

The server listens on `http://localhost:3000` by default.

Use another port with:

```bash
PORT=4000 npm run dev
```

## Routes

- `GET /health`
- `GET /notes`
- `GET /notes/:id`
- `POST /notes`
- `PUT /notes/:id`
- `DELETE /notes/:id`
- `GET /stats`
- `GET /slow-block?ms=1000`

Example create request:

```bash
curl -X POST http://localhost:3000/notes \
  -H "content-type: application/json" \
  -d '{"title":"first note","body":"hello"}'
```

This app intentionally performs synchronous file work, repeated JSON parsing, nested scans, pointless CPU work, and event-loop blocking. Keep it local.
