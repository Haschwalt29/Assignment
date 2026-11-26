const { randomUUID } = require("node:crypto");
const express = require("express");

const movies = [
  { id: "m1", title: "Arrival", genres: ["sci-fi", "drama"], year: 2016, rating: 7.9, popularity: 86 },
  { id: "m2", title: "The Grand Budapest Hotel", genres: ["comedy", "drama"], year: 2014, rating: 8.1, popularity: 79 },
  { id: "m3", title: "Moonlight", genres: ["drama"], year: 2016, rating: 7.4, popularity: 68 },
  { id: "m4", title: "Spider-Man: Into the Spider-Verse", genres: ["animation", "action"], year: 2018, rating: 8.4, popularity: 94 }
];

const seedWatchlists = new Map([["later", ["m2"]]]);
const allowedMovieFilters = new Set(["genre", "year", "minRating", "watchlistId"]);
const watchlistIdPattern = /^[a-zA-Z0-9_-]{1,40}$/;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateMovieFilters(query, watchlists) {
  for (const key of Object.keys(query)) {
    if (!allowedMovieFilters.has(key)) {
      throw new ApiError(400, `Unknown filter: ${key}`);
    }
    if (Array.isArray(query[key])) {
      throw new ApiError(400, `Filter "${key}" must be supplied once`);
    }
  }

  if (query.genre !== undefined && !/^[a-z-]{1,30}$/.test(query.genre)) {
    throw new ApiError(400, "genre must contain 1-30 lowercase letters or hyphens");
  }

  if (query.year !== undefined &&
      (!/^\d{4}$/.test(query.year) || Number(query.year) < 1888 || Number(query.year) > 2100)) {
    throw new ApiError(400, "year must be an integer from 1888 to 2100");
  }

  if (query.minRating !== undefined &&
      (!/^(?:\d+(?:\.\d{1,1})?|\.\d)$/.test(query.minRating) ||
       Number(query.minRating) < 0 || Number(query.minRating) > 10)) {
    throw new ApiError(400, "minRating must be a number from 0 to 10 with at most one decimal place");
  }

  if (query.watchlistId !== undefined) {
    if (!watchlistIdPattern.test(query.watchlistId)) {
      throw new ApiError(400, "watchlistId must be 1-40 letters, numbers, underscores, or hyphens");
    }
    if (!watchlists.has(query.watchlistId)) {
      throw new ApiError(404, "Watchlist not found");
    }
  }
}

function recommendationScore(movie) {
  return Number((movie.rating * 0.75 + (movie.popularity / 100) * 2.5).toFixed(2));
}

function createApp({ logger = console } = {}) {
  const app = express();
  const watchlists = new Map(
    [...seedWatchlists].map(([id, movieIds]) => [id, [...movieIds]])
  );

  app.use((req, res, next) => {
    req.requestId = randomUUID();
    req.startedAt = Date.now();
    res.set("X-Request-Id", req.requestId);
    res.on("finish", () => {
      logger.info({
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - req.startedAt
      });
    });
    next();
  });

  app.use(express.json({ limit: "16kb" }));

  app.get("/api/movies", (req, res, next) => {
    try {
      validateMovieFilters(req.query, watchlists);
      const savedMovieIds = req.query.watchlistId
        ? new Set(watchlists.get(req.query.watchlistId))
        : null;

      const results = movies
        .filter((movie) => req.query.genre === undefined || movie.genres.includes(req.query.genre))
        .filter((movie) => req.query.year === undefined || movie.year === Number(req.query.year))
        .filter((movie) => req.query.minRating === undefined || movie.rating >= Number(req.query.minRating))
        .filter((movie) => savedMovieIds === null || savedMovieIds.has(movie.id))
        .map((movie) => ({ ...movie, recommendationScore: recommendationScore(movie) }))
        .sort((a, b) => b.recommendationScore - a.recommendationScore);

      res.json({ data: results, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/watchlists/:watchlistId/movies", (req, res, next) => {
    try {
      const { watchlistId } = req.params;
      if (!watchlistIdPattern.test(watchlistId)) {
        throw new ApiError(400, "watchlistId must be 1-40 letters, numbers, underscores, or hyphens");
      }

      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).length !== 1 || typeof body.movieId !== "string") {
        throw new ApiError(400, 'Request body must contain only a string "movieId"');
      }

      if (!movies.some((movie) => movie.id === body.movieId)) {
        throw new ApiError(404, "Movie not found");
      }

      const watchlist = watchlists.get(watchlistId) || [];
      if (watchlist.includes(body.movieId)) {
        throw new ApiError(409, "Movie is already in this watchlist");
      }

      watchlist.push(body.movieId);
      watchlists.set(watchlistId, watchlist);
      res.status(201).json({ data: { watchlistId, movieId: body.movieId }, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => next(new ApiError(404, "Route not found")));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const isJsonParseError = error instanceof SyntaxError && error.status === 400 && "body" in error;
    const status = isJsonParseError ? 400 : error.status || 500;
    const message = isJsonParseError
      ? "Request body contains invalid JSON"
      : status === 500
        ? "Internal server error"
        : error.message;

    if (status === 500) {
      logger.error({ requestId: req.requestId, error: error.message });
    }

    res.status(status).json({
      error: { message },
      requestId: req.requestId
    });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.info(`Movie discovery API listening on port ${port}`);
  });
}

module.exports = { createApp };
