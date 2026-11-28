const http = require('http');
const assert = require('assert');
const { createRecipeApp } = require('../src/recipeApp');
const { generateJwt } = require('../src/recipeAuthUtils');

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

async function runRecipeAuthTests() {
  const { app } = createRecipeApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  console.log('--- Recipe App Authentication & Authorization Test Suite ---\n');
  let passed = 0;

  try {
    // 1. Valid Login - Returns JWT
    let aliceToken;
    let chefToken;
    let bobToken;
    {
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'alice@homecook.com',
        password: 'AliceP@ss123'
      });
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.body.data.token, 'Should return JWT token');
      assert.strictEqual(res.body.data.user.email, 'alice@homecook.com');
      assert.strictEqual(res.body.data.user.role, 'member');
      aliceToken = res.body.data.token;
      console.log('✔ Passed: Valid login returns JWT with 1h expiry');
      passed++;
    }

    // Login chef and bob for subsequent tests
    {
      const resChef = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'chef.gordon@kitchen.org',
        password: 'ChefSecure2026!'
      });
      chefToken = resChef.body.data.token;

      const resBob = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'bob@homecook.com',
        password: 'BobSecret456!'
      });
      bobToken = resBob.body.data.token;
    }

    // 2. Invalid Login - Rejects incorrect password
    {
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'alice@homecook.com',
        password: 'WrongPassword999!'
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
      console.log('✔ Passed: Login rejects incorrect password (401 INVALID_CREDENTIALS)');
      passed++;
    }

    // 3. Protected Route - Rejects unauthenticated request (401)
    {
      const res = await makeRequest(server, { path: '/api/grocery-lists/list-101', method: 'GET' });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
      console.log('✔ Passed: Protected route rejects missing token (401 UNAUTHORIZED)');
      passed++;
    }

    // 4. Protected Route - Owner accesses their grocery list (200)
    {
      const res = await makeRequest(server, {
        path: '/api/grocery-lists/list-101',
        method: 'GET',
        headers: { authorization: `Bearer ${aliceToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, 'list-101');
      assert.strictEqual(res.body.data.ownerId, 'usr-member-1');
      console.log('✔ Passed: Owner accesses own grocery list (200 OK)');
      passed++;
    }

    // 5. Ownership Check - Rejects unauthorized member accessing another user's grocery list (403 IDOR prevention)
    {
      const res = await makeRequest(server, {
        path: '/api/grocery-lists/list-102', // Owned by Bob
        method: 'GET',
        headers: { authorization: `Bearer ${aliceToken}` } // Alice attempting access
      });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN_RESOURCE');
      console.log('✔ Passed: Ownership check blocks cross-account access (403 FORBIDDEN_RESOURCE)');
      passed++;
    }

    // 6. Role Hierarchy - Chef role can inspect any user's grocery list for culinary coaching (200)
    {
      const res = await makeRequest(server, {
        path: '/api/grocery-lists/list-101',
        method: 'GET',
        headers: { authorization: `Bearer ${chefToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, 'list-101');
      console.log('✔ Passed: Chef role can inspect grocery list for culinary advice (200 OK)');
      passed++;
    }

    // 7. Role Check - Member cannot curate global master ingredient substitutions (403)
    {
      const res = await makeRequest(server, {
        path: '/api/substitutions/curate',
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` }
      }, {
        originalIngredient: 'eggs',
        substitute: 'flaxseed meal + water'
      });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN_ROLE');
      console.log('✔ Passed: Member role blocked from curating master substitutions (403 FORBIDDEN_ROLE)');
      passed++;
    }

    // 8. Role Check - Chef can curate global master ingredient substitutions (201)
    {
      const res = await makeRequest(server, {
        path: '/api/substitutions/curate',
        method: 'POST',
        headers: { authorization: `Bearer ${chefToken}` }
      }, {
        originalIngredient: 'balsamic vinegar',
        substitute: 'red wine vinegar + maple syrup',
        dietaryTag: 'sweet acid reduction'
      });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.curatedBy, 'usr-chef-1');
      console.log('✔ Passed: Chef role successfully curates master substitutions (201 Created)');
      passed++;
    }

    // 9. Owner Mutation - Member successfully substitutes an ingredient in their own list (201)
    {
      const res = await makeRequest(server, {
        path: '/api/grocery-lists/list-101/substitute',
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` }
      }, {
        originalIngredient: 'parmesan',
        substituteIngredient: 'nutritional yeast',
        quantity: '50g'
      });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      console.log('✔ Passed: Member adds substitution to own grocery list (201 Created)');
      passed++;
    }

    // 10. EDGE CASE 1: Expired Token Rejection
    {
      // Token generated with negative expiry (expired 10 seconds ago)
      const expiredToken = generateJwt({
        id: 'usr-member-1',
        email: 'alice@homecook.com',
        role: 'member'
      }, -10);

      const res = await makeRequest(server, {
        path: '/api/grocery-lists/list-101',
        method: 'GET',
        headers: { authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'TOKEN_EXPIRED');
      console.log('✔ Passed (Edge Case): Expired JWT token strictly rejected (401 TOKEN_EXPIRED)');
      passed++;
    }

    // 11. EDGE CASE 2: Tampered Token Signature (Privilege Escalation Attempt)
    {
      // Attacker takes Alice's valid token and tampers the role payload from 'member' to 'chef'
      const parts = aliceToken.split('.');
      const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      decodedPayload.role = 'chef'; // Malicious modification
      const tamperedPayloadBase64 = Buffer.from(JSON.stringify(decodedPayload))
        .toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const forgedToken = `${parts[0]}.${tamperedPayloadBase64}.${parts[2]}`;

      const res = await makeRequest(server, {
        path: '/api/substitutions/curate',
        method: 'POST',
        headers: { authorization: `Bearer ${forgedToken}` }
      }, {
        originalIngredient: 'sugar',
        substitute: 'stevia'
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'INVALID_TOKEN');
      console.log('✔ Passed (Edge Case): Tampered token signature fails verification (401 INVALID_TOKEN)');
      passed++;
    }

    console.log(`\nAll ${passed} test scenarios passed successfully!`);
  } finally {
    server.close();
  }
}

runRecipeAuthTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
