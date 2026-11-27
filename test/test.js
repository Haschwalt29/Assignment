const http = require('http');
const assert = require('assert');
const { createApp } = require('../src/app');

process.env.NODE_ENV = 'test';

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  const { app } = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    console.log('Running test suite for Library Lending System Express API...\n');

    // Test 1: Request ID middleware auto-generation
    {
      const res = await makeRequest(server, { path: '/books/book-101/availability', method: 'GET' });
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['x-request-id'], 'Response should have X-Request-Id header');
      assert.strictEqual(res.body.requestId, res.headers['x-request-id']);
      console.log('✔ Passed: Request ID header generated and mirrored in response body');
    }

    // Test 2: Request ID preservation when client sends X-Request-ID
    {
      const customId = 'client-trace-12345';
      const res = await makeRequest(server, {
        path: '/books/book-101/availability',
        method: 'GET',
        headers: { 'x-request-id': customId }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['x-request-id'], customId);
      assert.strictEqual(res.body.requestId, customId);
      console.log('✔ Passed: Preserves incoming client X-Request-ID');
    }

    // Test 3: Valid Book Availability Check
    {
      const res = await makeRequest(server, { path: '/books/book-101/availability', method: 'GET' });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.bookId, 'book-101');
      assert.strictEqual(res.body.data.isAvailableForCheckout, true);
      console.log('✔ Passed: Valid book availability returns book details and hold count');
    }

    // Test 4: Invalid Book Availability Check (Invalid parameter format)
    {
      const res = await makeRequest(server, { path: '/books/invalid@id!/availability', method: 'GET' });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_BOOK_ID');
      console.log('✔ Passed: Invalid bookId param returns 400 INVALID_BOOK_ID');
    }

    // Test 5: Book Not Found Check (404)
    {
      const res = await makeRequest(server, { path: '/books/book-9999/availability', method: 'GET' });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'BOOK_NOT_FOUND');
      console.log('✔ Passed: Non-existent bookId returns 404 BOOK_NOT_FOUND');
    }

    // Test 6: Valid Hold Creation
    {
      const res = await makeRequest(server, {
        path: '/holds',
        method: 'POST'
      }, {
        bookId: 'book-102',
        patronId: 'patron-777',
        pickupLocation: 'Main Desk'
      });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.holdId);
      assert.strictEqual(res.body.data.patronId, 'patron-777');
      console.log('✔ Passed: Valid hold creation returns 201 Created');
    }

    // Test 7: Invalid Hold Creation (Multiple validation errors)
    {
      const res = await makeRequest(server, {
        path: '/holds',
        method: 'POST'
      }, {
        bookId: 'wrong_id',
        patronId: 12345,
        pickupLocation: 'Unknown Desk'
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
      assert.strictEqual(res.body.error.details.length, 3);
      console.log('✔ Passed: Invalid hold fields return structured field errors');
    }

    // Test 8: Duplicate Hold Conflict (409 Conflict)
    {
      const res = await makeRequest(server, {
        path: '/holds',
        method: 'POST'
      }, {
        bookId: 'book-102',
        patronId: 'patron-777',
        pickupLocation: 'Main Desk'
      });
      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'HOLD_ALREADY_EXISTS');
      console.log('✔ Passed: Duplicate hold returns 409 HOLD_ALREADY_EXISTS');
    }

    // Test 9: Valid Overdue Reminders Dispatch
    {
      const res = await makeRequest(server, {
        path: '/reminders/overdue',
        method: 'POST'
      }, {
        daysOverdueMin: 7,
        notificationChannel: 'email'
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.dispatchedCount >= 1);
      console.log('✔ Passed: Overdue reminder dispatch filters and delivers notices');
    }

    // Test 10: Invalid Overdue Reminders Parameters
    {
      const res = await makeRequest(server, {
        path: '/reminders/overdue',
        method: 'POST'
      }, {
        daysOverdueMin: -5,
        notificationChannel: 'carrier-pigeon'
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.error.details.length, 2);
      console.log('✔ Passed: Invalid reminder parameters rejected with 400 VALIDATION_ERROR');
    }

    // Test 11: Malformed JSON body handling (syntax error caught by error handler)
    {
      const res = await makeRequest(server, {
        path: '/holds',
        method: 'POST'
      }, '{"invalid_json: true');
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      console.log('✔ Passed: Centralized error handler catches malformed JSON payloads');
    }

    // Test 12: Route Not Found (404)
    {
      const res = await makeRequest(server, { path: '/non-existent-route', method: 'GET' });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('✔ Passed: Unhandled routes return structured 404 error');
    }

    console.log('\nAll 12 test assertions passed successfully!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
