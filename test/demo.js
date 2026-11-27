const http = require('http');
const { createApp } = require('../src/app');

// Turn off silent test mode so console logs are formatted
process.env.NODE_ENV = 'demo';

function request(server, options, body = null) {
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
          status: res.statusCode,
          headers: res.headers,
          data: json
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

function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(` ${title}`);
  console.log('='.repeat(70));
}

async function runDemo() {
  const { app } = createApp();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

  try {
    console.log('--- DEMONSTRATION: Express Middleware & Validation in Library Lending ---');

    // Scenario 1: Valid Availability Check
    printSection('1. VALID REQUEST: Book Availability Check');
    console.log('Request: GET /books/book-101/availability (Custom Header X-Request-Id: trace-client-99)');
    const res1 = await request(server, {
      path: '/books/book-101/availability',
      method: 'GET',
      headers: { 'x-request-id': 'trace-client-99' }
    });
    console.log(`HTTP Status: ${res1.status}`);
    console.log('Response Body:', JSON.stringify(res1.data, null, 2));

    // Scenario 2: Invalid Availability Check (Bad Param format)
    printSection('2. INVALID REQUEST: Malformed Book ID Parameter');
    console.log('Request: GET /books/not-a-valid-id!/availability');
    const res2 = await request(server, { path: '/books/not-a-valid-id!/availability', method: 'GET' });
    console.log(`HTTP Status: ${res2.status}`);
    console.log('Response Body:', JSON.stringify(res2.data, null, 2));

    // Scenario 3: Valid Hold Placement
    printSection('3. VALID REQUEST: Place Hold on Checked-out Book');
    console.log('Request: POST /holds with valid body');
    const res3 = await request(server, { path: '/holds', method: 'POST' }, {
      bookId: 'book-102',
      patronId: 'patron-202',
      pickupLocation: 'Curbside Locker'
    });
    console.log(`HTTP Status: ${res3.status}`);
    console.log('Response Body:', JSON.stringify(res3.data, null, 2));

    // Scenario 4: Invalid Hold Placement (Schema Validation Failures)
    printSection('4. INVALID REQUEST: Place Hold with Schema & Enum Violations');
    console.log('Request: POST /holds with missing patronId and invalid pickupLocation');
    const res4 = await request(server, { path: '/holds', method: 'POST' }, {
      bookId: 'invalid-book-code',
      patronId: '',
      pickupLocation: 'Downtown Coffee Shop'
    });
    console.log(`HTTP Status: ${res4.status}`);
    console.log('Response Body:', JSON.stringify(res4.data, null, 2));

    // Scenario 5: Business Rule Error: Duplicate Hold Conflict
    printSection('5. CONFLICT REQUEST: Duplicate Hold on Same Book by Same Patron');
    console.log('Request: POST /holds with patron-202 on book-102 again');
    const res5 = await request(server, { path: '/holds', method: 'POST' }, {
      bookId: 'book-102',
      patronId: 'patron-202',
      pickupLocation: 'Curbside Locker'
    });
    console.log(`HTTP Status: ${res5.status}`);
    console.log('Response Body:', JSON.stringify(res5.data, null, 2));

    // Scenario 6: Valid Overdue Reminders Dispatch
    printSection('6. VALID REQUEST: Trigger Overdue Reminders Batch');
    console.log('Request: POST /reminders/overdue with min 5 days overdue');
    const res6 = await request(server, { path: '/reminders/overdue', method: 'POST' }, {
      daysOverdueMin: 5,
      notificationChannel: 'email'
    });
    console.log(`HTTP Status: ${res6.status}`);
    console.log('Response Body:', JSON.stringify(res6.data, null, 2));

    // Scenario 7: Invalid Overdue Reminders Request
    printSection('7. INVALID REQUEST: Overdue Reminders with Out-of-Range Days & Unsupported Channel');
    console.log('Request: POST /reminders/overdue with negative days and channel "fax"');
    const res7 = await request(server, { path: '/reminders/overdue', method: 'POST' }, {
      daysOverdueMin: -2,
      notificationChannel: 'fax'
    });
    console.log(`HTTP Status: ${res7.status}`);
    console.log('Response Body:', JSON.stringify(res7.data, null, 2));

    // Scenario 8: Malformed JSON Payload
    printSection('8. INVALID REQUEST: Malformed Raw JSON Syntax');
    console.log('Request: POST /holds with broken JSON syntax');
    const res8 = await request(server, { path: '/holds', method: 'POST' }, '{ "bookId": "book-101", ');
    console.log(`HTTP Status: ${res8.status}`);
    console.log('Response Body:', JSON.stringify(res8.data, null, 2));

    console.log('\nDemonstration completed successfully.');
  } finally {
    server.close();
  }
}

runDemo().catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
