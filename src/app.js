const express = require('express');
const crypto = require('crypto');

// In-memory library lending data store
const books = [
  { id: 'book-101', title: 'Design Patterns', author: 'Gang of Four', totalCopies: 3, availableCopies: 2 },
  { id: 'book-102', title: 'Clean Architecture', author: 'Robert C. Martin', totalCopies: 2, availableCopies: 0 },
  { id: 'book-103', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', totalCopies: 4, availableCopies: 1 }
];

const holds = [
  { id: 'hold-1', bookId: 'book-102', patronId: 'patron-88', priority: 1, pickupLocation: 'Main Desk', createdAt: '2026-11-20T10:00:00.000Z' }
];

const loans = [
  {
    id: 'loan-1',
    bookId: 'book-102',
    patronId: 'patron-12',
    patronEmail: 'patron12@example.com',
    dueDate: '2026-11-15T00:00:00.000Z',
    status: 'overdue',
    remindersSent: 1
  },
  {
    id: 'loan-2',
    bookId: 'book-103',
    patronId: 'patron-34',
    patronEmail: 'patron34@example.com',
    dueDate: '2026-11-20T00:00:00.000Z',
    status: 'overdue',
    remindersSent: 0
  },
  {
    id: 'loan-3',
    bookId: 'book-101',
    patronId: 'patron-56',
    patronEmail: 'patron56@example.com',
    dueDate: '2026-12-10T00:00:00.000Z',
    status: 'active',
    remindersSent: 0
  }
];

function createApp() {
  const app = express();

  // Parse incoming JSON payloads
  app.use(express.json());

  // 1. Custom Middleware: Request ID and structured Logging middleware
  app.use((req, res, next) => {
    // Reuse incoming X-Request-ID or generate a cryptographically secure UUID
    const incomingRequestId = req.header('x-request-id');
    const requestId = (incomingRequestId && typeof incomingRequestId === 'string' && incomingRequestId.trim())
      ? incomingRequestId.trim()
      : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startTime = process.hrtime.bigint();

    // Hook response finish to log response summary
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      const logEntry = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: `${durationMs.toFixed(2)}ms`
      };
      if (process.env.NODE_ENV !== 'test') {
        console.log(JSON.stringify(logEntry));
      }
    });

    next();
  });

  // --- Input Validation Middlewares ---

  // Validation: GET /books/:bookId/availability
  const validateAvailabilityParams = (req, res, next) => {
    const { bookId } = req.params;
    if (!bookId || typeof bookId !== 'string' || !/^book-[a-zA-Z0-9_-]+$/.test(bookId.trim())) {
      const err = new Error("Invalid or missing 'bookId' parameter. Expected format: 'book-<id>' (e.g. 'book-101').");
      err.status = 400;
      err.code = 'INVALID_BOOK_ID';
      return next(err);
    }
    req.params.bookId = bookId.trim();
    next();
  };

  // Validation: POST /holds
  const validatePlaceHold = (req, res, next) => {
    const { bookId, patronId, pickupLocation } = req.body || {};
    const errors = [];

    if (!bookId || typeof bookId !== 'string' || !/^book-[a-zA-Z0-9_-]+$/.test(bookId.trim())) {
      errors.push({ field: 'bookId', message: "Must be a valid book ID string in format 'book-<id>'." });
    }

    if (!patronId || typeof patronId !== 'string' || !/^patron-[a-zA-Z0-9_-]+$/.test(patronId.trim())) {
      errors.push({ field: 'patronId', message: "Must be a valid patron ID string in format 'patron-<id>'." });
    }

    const allowedLocations = ['Main Desk', 'North Branch', 'South Branch', 'Curbside Locker'];
    if (!pickupLocation || typeof pickupLocation !== 'string' || !allowedLocations.includes(pickupLocation.trim())) {
      errors.push({
        field: 'pickupLocation',
        message: `Must be one of the permitted pickup locations: ${allowedLocations.join(', ')}.`
      });
    }

    if (errors.length > 0) {
      const err = new Error('Validation failed for hold request.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = errors;
      return next(err);
    }

    req.body.bookId = bookId.trim();
    req.body.patronId = patronId.trim();
    req.body.pickupLocation = pickupLocation.trim();
    next();
  };

  // Validation: POST /reminders/overdue
  const validateOverdueReminders = (req, res, next) => {
    const { daysOverdueMin, notificationChannel } = req.body || {};
    const errors = [];

    if (daysOverdueMin === undefined || daysOverdueMin === null) {
      errors.push({ field: 'daysOverdueMin', message: 'Required parameter specifying minimum days overdue.' });
    } else if (typeof daysOverdueMin !== 'number' || !Number.isInteger(daysOverdueMin) || daysOverdueMin < 1 || daysOverdueMin > 365) {
      errors.push({ field: 'daysOverdueMin', message: 'Must be an integer between 1 and 365.' });
    }

    const allowedChannels = ['email', 'sms', 'in-app'];
    if (!notificationChannel || typeof notificationChannel !== 'string' || !allowedChannels.includes(notificationChannel.toLowerCase())) {
      errors.push({
        field: 'notificationChannel',
        message: `Must be one of allowed notification channels: ${allowedChannels.join(', ')}.`
      });
    }

    if (errors.length > 0) {
      const err = new Error('Validation failed for overdue reminder dispatch.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = errors;
      return next(err);
    }

    req.body.daysOverdueMin = daysOverdueMin;
    req.body.notificationChannel = notificationChannel.toLowerCase();
    next();
  };

  // --- Routes ---

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'library-lending-system',
      timestamp: new Date().toISOString()
    });
  });

  // Route 1: Check book availability and current hold count
  app.get('/books/:bookId/availability', validateAvailabilityParams, (req, res, next) => {
    const { bookId } = req.params;
    const book = books.find(b => b.id === bookId);

    if (!book) {
      const err = new Error(`Book with ID '${bookId}' not found.`);
      err.status = 404;
      err.code = 'BOOK_NOT_FOUND';
      return next(err);
    }

    const activeHolds = holds.filter(h => h.bookId === bookId);
    const isAvailable = book.availableCopies > 0;

    res.json({
      success: true,
      requestId: req.requestId,
      data: {
        bookId: book.id,
        title: book.title,
        author: book.author,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        activeHoldCount: activeHolds.length,
        isAvailableForCheckout: isAvailable,
        recommendation: isAvailable
          ? 'Available for immediate checkout.'
          : 'All copies checked out. Place a hold to reserve the next returned copy.'
      }
    });
  });

  // Route 2: Place a hold on a book
  app.post('/holds', validatePlaceHold, (req, res, next) => {
    const { bookId, patronId, pickupLocation } = req.body;
    const book = books.find(b => b.id === bookId);

    if (!book) {
      const err = new Error(`Cannot place hold: Book with ID '${bookId}' does not exist.`);
      err.status = 404;
      err.code = 'BOOK_NOT_FOUND';
      return next(err);
    }

    // Business rule: Check if patron already has an active hold on this book
    const existingHold = holds.find(h => h.bookId === bookId && h.patronId === patronId);
    if (existingHold) {
      const err = new Error(`Patron '${patronId}' already has an active hold for '${bookId}'.`);
      err.status = 409;
      err.code = 'HOLD_ALREADY_EXISTS';
      err.details = { existingHoldId: existingHold.id, queuePosition: existingHold.priority };
      return next(err);
    }

    const currentBookHolds = holds.filter(h => h.bookId === bookId);
    const queuePosition = currentBookHolds.length + 1;

    const newHold = {
      id: `hold-${Date.now()}`,
      bookId,
      patronId,
      priority: queuePosition,
      pickupLocation,
      createdAt: new Date().toISOString()
    };

    holds.push(newHold);

    res.status(201).json({
      success: true,
      requestId: req.requestId,
      message: 'Hold placed successfully.',
      data: {
        holdId: newHold.id,
        bookTitle: book.title,
        patronId: newHold.patronId,
        pickupLocation: newHold.pickupLocation,
        queuePosition: newHold.priority,
        createdAt: newHold.createdAt
      }
    });
  });

  // Route 3: Trigger batch overdue reminders
  app.post('/reminders/overdue', validateOverdueReminders, (req, res, next) => {
    const { daysOverdueMin, notificationChannel } = req.body;
    const now = new Date('2026-11-27T12:00:00.000Z'); // Fixed reference time for demo/system context

    const qualifyingLoans = loans.filter(loan => {
      if (loan.status !== 'overdue') return false;
      const due = new Date(loan.dueDate);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue >= daysOverdueMin;
    });

    const dispatched = qualifyingLoans.map(loan => {
      loan.remindersSent += 1;
      const due = new Date(loan.dueDate);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return {
        loanId: loan.id,
        patronId: loan.patronId,
        patronEmail: loan.patronEmail,
        daysOverdue,
        channel: notificationChannel,
        reminderSequence: loan.remindersSent,
        dispatchedAt: now.toISOString()
      };
    });

    res.json({
      success: true,
      requestId: req.requestId,
      message: `Overdue reminders dispatched to ${dispatched.length} patron(s).`,
      data: {
        criteria: {
          daysOverdueMin,
          notificationChannel,
          evaluatedAt: now.toISOString()
        },
        dispatchedCount: dispatched.length,
        dispatchedReminders: dispatched
      }
    });
  });

  // Catch-all 404 for unhandled routes
  app.use((req, res, next) => {
    const err = new Error(`Cannot ${req.method} ${req.originalUrl}`);
    err.status = 404;
    err.code = 'NOT_FOUND';
    next(err);
  });

  // Centralized Error Handling Middleware (4 arguments: err, req, res, next)
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const responsePayload = {
      success: false,
      requestId: req.requestId || null,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected internal error occurred.'
      }
    };

    if (err.details) {
      responsePayload.error.details = err.details;
    }

    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        status,
        code: responsePayload.error.code,
        message: responsePayload.error.message,
        stack: status >= 500 ? err.stack : undefined
      }));
    }

    res.status(status).json(responsePayload);
  });

  return { app, books, holds, loans };
}

module.exports = { createApp };
