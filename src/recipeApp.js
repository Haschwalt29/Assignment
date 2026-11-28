const express = require('express');
const {
  hashPassword,
  verifyPassword,
  generateJwt,
  verifyJwt
} = require('./recipeAuthUtils');

function createRecipeApp() {
  const app = express();
  app.use(express.json());

  // In-memory Users store with pre-hashed passwords
  // Roles: 'chef' (full edit/curation rights), 'member' (regular home cook)
  const users = [
    {
      id: 'usr-chef-1',
      email: 'chef.gordon@kitchen.org',
      passwordHash: hashPassword('ChefSecure2026!'),
      role: 'chef',
      name: 'Chef Gordon'
    },
    {
      id: 'usr-member-1',
      email: 'alice@homecook.com',
      passwordHash: hashPassword('AliceP@ss123'),
      role: 'member',
      name: 'Alice'
    },
    {
      id: 'usr-member-2',
      email: 'bob@homecook.com',
      passwordHash: hashPassword('BobSecret456!'),
      role: 'member',
      name: 'Bob'
    }
  ];

  // In-memory Grocery Lists owned by users
  const groceryLists = [
    {
      id: 'list-101',
      ownerId: 'usr-member-1',
      recipeTitle: 'Creamy Mushroom Risotto',
      items: [
        { name: 'Arborio rice', quantity: '2 cups', substituted: false },
        { name: 'Cremini mushrooms', quantity: '300g', substituted: false },
        { name: 'Vegetable broth', quantity: '1L', substituted: true, original: 'Chicken stock' }
      ]
    },
    {
      id: 'list-102',
      ownerId: 'usr-member-2',
      recipeTitle: 'Gluten-Free Banana Bread',
      items: [
        { name: 'Almond flour', quantity: '2 cups', substituted: true, original: 'All-purpose flour' },
        { name: 'Ripe bananas', quantity: '3 units', substituted: false }
      ]
    }
  ];

  // In-memory Ingredient Substitutions (Curated globally by 'chef' role)
  const ingredientSubstitutions = [
    {
      id: 'sub-1',
      originalIngredient: 'buttermilk',
      substitute: 'milk + 1 tbsp lemon juice',
      dietaryTag: 'acidic dairy equivalent',
      curatedBy: 'usr-chef-1'
    },
    {
      id: 'sub-2',
      originalIngredient: 'heavy cream',
      substitute: 'coconut cream or blended silken tofu',
      dietaryTag: 'dairy-free / vegan',
      curatedBy: 'usr-chef-1'
    }
  ];

  // --- Authentication Middleware ---
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authorization header missing. Bearer token required.' }
      });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_AUTH_SCHEME', message: "Authorization format must be 'Bearer <token>'." }
      });
    }

    try {
      const decodedUser = verifyJwt(token);
      req.user = decodedUser;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired. Please log in again.' }
        });
      }
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token signature or structure is invalid.' }
      });
    }
  };

  // --- Role Check Middleware ---
  const requireRole = (allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: '${req.user ? req.user.role : 'none'}'.`
        }
      });
    }
    next();
  };

  // --- Ownership or Role Check Middleware ---
  const requireListOwnershipOrChef = (req, res, next) => {
    const { listId } = req.params;
    const list = groceryLists.find((l) => l.id === listId);

    if (!list) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Grocery list '${listId}' not found.` }
      });
    }

    // Chefs can inspect any grocery list; members can only access their own lists
    const isOwner = req.user && req.user.id === list.ownerId;
    const isChef = req.user && req.user.role === 'chef';

    if (!isOwner && !isChef) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_RESOURCE',
          message: 'Access denied: You do not own this grocery list.'
        }
      });
    }

    req.groceryList = list;
    next();
  };

  // --- Routes ---

  // 1. Public Login Route: Authenticates credentials & issues JWT with 1-hour expiry
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Email and password are required.' }
      });
    }

    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
    }

    // Token payload: minimal, no sensitive data like password hash
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    // Default 1 hour expiry (3600 seconds)
    const token = generateJwt(tokenPayload, 3600);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: tokenPayload
      }
    });
  });

  // 2. Protected Route with Ownership Check: View specific grocery list with substitutions
  app.get('/api/grocery-lists/:listId', authenticateToken, requireListOwnershipOrChef, (req, res) => {
    res.json({
      success: true,
      data: req.groceryList
    });
  });

  // 3. Protected Route: Add ingredient substitution to user's grocery list (Owner only)
  app.post('/api/grocery-lists/:listId/substitute', authenticateToken, requireListOwnershipOrChef, (req, res) => {
    const { originalIngredient, substituteIngredient, quantity } = req.body || {};

    if (!originalIngredient || !substituteIngredient) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'originalIngredient and substituteIngredient are required.' }
      });
    }

    // Only owner can mutate their personal grocery list
    if (req.user.id !== req.groceryList.ownerId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_MUTATION', message: 'Only the grocery list owner may apply substitutions.' }
      });
    }

    const newItem = {
      name: substituteIngredient,
      quantity: quantity || '1 portion',
      substituted: true,
      original: originalIngredient
    };

    req.groceryList.items.push(newItem);

    res.status(201).json({
      success: true,
      message: `Substituted '${originalIngredient}' with '${substituteIngredient}' in grocery list.`,
      data: req.groceryList
    });
  });

  // 4. Role-Protected Route: Curate master ingredient substitutions (Chef role only)
  app.post('/api/substitutions/curate', authenticateToken, requireRole(['chef']), (req, res) => {
    const { originalIngredient, substitute, dietaryTag } = req.body || {};

    if (!originalIngredient || !substitute) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'originalIngredient and substitute are required.' }
      });
    }

    const newSub = {
      id: `sub-${ingredientSubstitutions.length + 1}`,
      originalIngredient,
      substitute,
      dietaryTag: dietaryTag || 'general substitution',
      curatedBy: req.user.id
    };

    ingredientSubstitutions.push(newSub);

    res.status(201).json({
      success: true,
      message: 'Master culinary ingredient substitution curated successfully.',
      data: newSub
    });
  });

  // Centralized Error Handler
  app.use((err, req, res, next) => {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Unexpected server error.' }
    });
  });

  return { app, users, groceryLists, ingredientSubstitutions };
}

module.exports = { createRecipeApp };
