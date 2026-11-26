const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../app");

let server;
let baseUrl;
const logs = [];

before(async () => {
  server = createApp({ logger: { info: (entry) => logs.push(entry), error: (entry) => logs.push(entry) } })
    .listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("filters and ranks movie recommendations and returns a request ID", async () => {
  const response = await fetch(`${baseUrl}/api/movies?genre=drama&minRating=7.5`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
  assert.deepEqual(body.data.map((movie) => movie.id), ["m1", "m2"]);
  assert.ok(body.data[0].recommendationScore >= body.data[1].recommendationScore);
});

test("rejects out-of-range rating filters with a structured 400", async () => {
  const response = await fetch(`${baseUrl}/api/movies?minRating=11`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error.message, /minRating/);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
});

test("adds a movie to a watchlist and filters recommendations by that list", async () => {
  const addResponse = await fetch(`${baseUrl}/api/watchlists/weekend/movies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ movieId: "m1" })
  });
  assert.equal(addResponse.status, 201);

  const listResponse = await fetch(`${baseUrl}/api/movies?watchlistId=weekend`);
  const listBody = await listResponse.json();
  assert.deepEqual(listBody.data.map((movie) => movie.id), ["m1"]);
});

test("rejects an invalid watchlist body and records request metadata", async () => {
  const response = await fetch(`${baseUrl}/api/watchlists/weekend/movies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ movieId: 42, extra: true })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error.message, /movieId/);
  assert.ok(logs.some((entry) => entry.requestId === body.requestId && entry.status === 400));
});
