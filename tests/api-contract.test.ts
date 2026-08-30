// api-contract.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';
import { PrismaClient } from '@prisma/client';
import { validate as validateUUID } from 'uuid';
import Joi from 'joi';
import { Schema } from 'joi';

const prisma = new PrismaClient();

// ==================== CONTRACT DEFINITIONS ====================
interface ApiContract {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  requestSchema?: Schema;
  responseSchema: Schema;
  statusCode: number;
  authentication?: 'none' | 'bearer' | 'apiKey';
  roles?: string[];
}

// ==================== SCHEMA DEFINITIONS ====================
const schemas = {
  // User Schemas
  user: Joi.object({
    id: Joi.number().integer().positive().required(),
    email: Joi.string().email().required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).allow(null),
    role: Joi.string().valid('USER', 'ADMIN', 'MODERATOR').default('USER'),
    isVerified: Joi.boolean().default(false),
    isActive: Joi.boolean().default(true),
    createdAt: Joi.date().iso().required(),
    updatedAt: Joi.date().iso().required(),
    lastLoginAt: Joi.date().iso().allow(null),
    profilePicture: Joi.string().uri().allow(null),
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark', 'system').default('system'),
      notifications: Joi.boolean().default(true),
      language: Joi.string().default('en')
    })
  }),

  userResponse: Joi.object({
    success: Joi.boolean().required(),
    message: Joi.string(),
    data: Joi.object({
      user: schemas.user
    })
  }),

  usersListResponse: Joi.object({
    success: Joi.boolean().required(),
    data: Joi.object({
      users: Joi.array().items(schemas.user).required(),
      pagination: Joi.object({
        page: Joi.number().integer().min(1).required(),
        limit: Joi.number().integer().min(1).max(100).required(),
        total: Joi.number().integer().min(0).required(),
        totalPages: Joi.number().integer().min(0).required(),
        hasNext: Joi.boolean().required(),
        hasPrevious: Joi.boolean().required()
      }).required()
    })
  }),

  // Auth Schemas
  loginRequest: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required()
  }),

  loginResponse: Joi.object({
    success: Joi.boolean().required(),
    data: Joi.object({
      accessToken: Joi.string().required(),
      refreshToken: Joi.string().required(),
      user: schemas.user,
      requires2FA: Joi.boolean().default(false),
      tempToken: Joi.string().when('requires2FA', { is: true, then: Joi.required() })
    })
  }),

  registerRequest: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .max(100)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
    acceptTerms: Joi.boolean().valid(true).required()
  }),

  registerResponse: Joi.object({
    success: Joi.boolean().required(),
    message: Joi.string().required(),
    data: Joi.object({
      user: schemas.user,
      verificationToken: Joi.string().required()
    })
  }),

  // Error Response
  errorResponse: Joi.object({
    success: Joi.boolean().valid(false).required(),
    error: Joi.string().required(),
    statusCode: Joi.number().integer().min(400).max(599),
    timestamp: Joi.date().iso(),
    path: Joi.string(),
    method: Joi.string(),
    validationErrors: Joi.array().items(
      Joi.object({
        field: Joi.string().required(),
        message: Joi.string().required(),
        value: Joi.any()
      })
    )
  }),

  // Validation Error Response
  validationErrorResponse: Joi.object({
    success: Joi.boolean().valid(false).required(),
    error: Joi.string().required(),
    statusCode: Joi.number().integer().min(400).max(599),
    validationErrors: Joi.array().items(
      Joi.object({
        field: Joi.string().required(),
        message: Joi.string().required(),
        value: Joi.any()
      })
    ).required()
  }),

  // Token Response
  tokenResponse: Joi.object({
    success: Joi.boolean().required(),
    data: Joi.object({
      accessToken: Joi.string().required(),
      refreshToken: Joi.string().required()
    })
  }),

  // Pagination Query
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('id', 'email', 'firstName', 'lastName', 'createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    search: Joi.string().max(100)
  }),

  // Password Reset
  forgotPasswordRequest: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPasswordRequest: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .max(100)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  // 2FA
  twoFactorEnableRequest: Joi.object({
    method: Joi.string().valid('authenticator', 'sms', 'email').default('authenticator')
  }),

  twoFactorVerifyRequest: Joi.object({
    token: Joi.string().min(6).max(6).required()
  }),

  twoFactorLoginRequest: Joi.object({
    tempToken: Joi.string().required(),
    token: Joi.string().min(6).max(6).required()
  })
};

// ==================== CONTRACT REGISTRY ====================
const contractRegistry: Record<string, ApiContract> = {
  // Auth Contracts
  'POST /api/auth/register': {
    path: '/api/auth/register',
    method: 'POST',
    requestSchema: schemas.registerRequest,
    responseSchema: schemas.registerResponse,
    statusCode: 201,
    authentication: 'none'
  },
  'POST /api/auth/login': {
    path: '/api/auth/login',
    method: 'POST',
    requestSchema: schemas.loginRequest,
    responseSchema: schemas.loginResponse,
    statusCode: 200,
    authentication: 'none'
  },
  'POST /api/auth/logout': {
    path: '/api/auth/logout',
    method: 'POST',
    responseSchema: Joi.object({
      success: Joi.boolean().required(),
      message: Joi.string().required()
    }),
    statusCode: 200,
    authentication: 'bearer'
  },
  'POST /api/auth/refresh-token': {
    path: '/api/auth/refresh-token',
    method: 'POST',
    responseSchema: schemas.tokenResponse,
    statusCode: 200,
    authentication: 'none'
  },
  'POST /api/auth/forgot-password': {
    path: '/api/auth/forgot-password',
    method: 'POST',
    requestSchema: schemas.forgotPasswordRequest,
    responseSchema: Joi.object({
      success: Joi.boolean().required(),
      message: Joi.string().required(),
      data: Joi.object({
        resetToken: Joi.string().optional()
      })
    }),
    statusCode: 200,
    authentication: 'none'
  },
  'POST /api/auth/reset-password': {
    path: '/api/auth/reset-password',
    method: 'POST',
    requestSchema: schemas.resetPasswordRequest,
    responseSchema: Joi.object({
      success: Joi.boolean().required(),
      message: Joi.string().required()
    }),
    statusCode: 200,
    authentication: 'none'
  },

  // User Contracts
  'GET /api/users/profile': {
    path: '/api/users/profile',
    method: 'GET',
    responseSchema: schemas.userResponse,
    statusCode: 200,
    authentication: 'bearer'
  },
  'PUT /api/users/profile': {
    path: '/api/users/profile',
    method: 'PUT',
    requestSchema: Joi.object({
      firstName: Joi.string().min(1).max(50),
      lastName: Joi.string().min(1).max(50),
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
      preferences: Joi.object({
        theme: Joi.string().valid('light', 'dark', 'system'),
        notifications: Joi.boolean(),
        language: Joi.string()
      })
    }).min(1),
    responseSchema: schemas.userResponse,
    statusCode: 200,
    authentication: 'bearer'
  },
  'GET /api/users': {
    path: '/api/users',
    method: 'GET',
    responseSchema: schemas.usersListResponse,
    statusCode: 200,
    authentication: 'bearer',
    roles: ['ADMIN']
  },
  'GET /api/users/:id': {
    path: '/api/users/:id',
    method: 'GET',
    responseSchema: schemas.userResponse,
    statusCode: 200,
    authentication: 'bearer'
  },

  // 2FA Contracts
  'POST /api/auth/2fa/enable': {
    path: '/api/auth/2fa/enable',
    method: 'POST',
    requestSchema: schemas.twoFactorEnableRequest,
    responseSchema: Joi.object({
      success: Joi.boolean().required(),
      data: Joi.object({
        secret: Joi.string().required(),
        qrCode: Joi.string().required(),
        recoveryCodes: Joi.array().items(Joi.string()).length(10)
      })
    }),
    statusCode: 200,
    authentication: 'bearer'
  },
  'POST /api/auth/2fa/verify': {
    path: '/api/auth/2fa/verify',
    method: 'POST',
    requestSchema: schemas.twoFactorVerifyRequest,
    responseSchema: Joi.object({
      success: Joi.boolean().required(),
      data: Joi.object({
        verified: Joi.boolean().required()
      })
    }),
    statusCode: 200,
    authentication: 'bearer'
  },
  'POST /api/auth/2fa/login': {
    path: '/api/auth/2fa/login',
    method: 'POST',
    requestSchema: schemas.twoFactorLoginRequest,
    responseSchema: schemas.loginResponse,
    statusCode: 200,
    authentication: 'none'
  }
};

// ==================== TEST SUITE ====================
describe('API Contract and Validation Tests', () => {
  let authToken: string;
  let testUserId: number;

  // Test data
  const testUser = {
    email: 'contract-test@example.com',
    password: 'Contract@123456',
    firstName: 'Contract',
    lastName: 'Test',
    phoneNumber: '+1234567890',
    acceptTerms: true
  };

  // Setup
  beforeAll(async () => {
    // Clean up existing test data
    await prisma.user.deleteMany({
      where: {
        email: testUser.email
      }
    });

    // Register test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    // Verify user
    await prisma.user.update({
      where: { email: testUser.email },
      data: { isVerified: true }
    });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    authToken = loginResponse.body.data.accessToken;
    testUserId = loginResponse.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: testUser.email
      }
    });
    await prisma.$disconnect();
  });

  // ==================== CONTRACT VALIDATION HELPERS ====================
  const validateContract = (contract: ApiContract, response: any) => {
    // Validate status code
    expect(response.status).toBe(contract.statusCode);

    // Validate response schema
    const { error, value } = contract.responseSchema.validate(response.body, {
      abortEarly: false,
      allowUnknown: true
    });

    if (error) {
      console.error('Response validation failed:', error.details);
    }
    expect(error).toBeUndefined();

    return value;
  };

  const validateErrorResponse = (response: any) => {
    const { error } = schemas.errorResponse.validate(response.body, {
      abortEarly: false,
      allowUnknown: true
    });
    expect(error).toBeUndefined();
  };

  // ==================== AUTH CONTRACT TESTS ====================
  describe('Authentication Contracts', () => {
    it('POST /api/auth/register - valid request', async () => {
      const uniqueEmail = `contract-${Date.now()}@example.com`;
      const requestData = {
        ...testUser,
        email: uniqueEmail
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(requestData)
        .expect(201);

      const validated = validateContract(contractRegistry['POST /api/auth/register'], response);
      expect(validated.data.user.email).toBe(uniqueEmail);
      expect(validated.data.verificationToken).toBeDefined();

      // Clean up
      await prisma.user.delete({ where: { email: uniqueEmail } });
    });

    it('POST /api/auth/register - validation errors', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: '',
        acceptTerms: false
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      const { error } = schemas.validationErrorResponse.validate(response.body);
      expect(error).toBeUndefined();
      expect(response.body.validationErrors).toBeInstanceOf(Array);
      expect(response.body.validationErrors.length).toBeGreaterThan(0);
    });

    it('POST /api/auth/login - valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const validated = validateContract(contractRegistry['POST /api/auth/login'], response);
      expect(validated.data.accessToken).toBeDefined();
      expect(validated.data.refreshToken).toBeDefined();
      expect(validated.data.user.email).toBe(testUser.email);
    });

    it('POST /api/auth/login - invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        })
        .expect(401);

      validateErrorResponse(response);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('POST /api/auth/login - validation errors', async () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'short'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      const { error } = schemas.validationErrorResponse.validate(response.body);
      expect(error).toBeUndefined();
    });

    it('POST /api/auth/refresh-token - valid refresh token', async () => {
      // First get a refresh token from login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      const validated = validateContract(contractRegistry['POST /api/auth/refresh-token'], response);
      expect(validated.data.accessToken).toBeDefined();
      expect(validated.data.accessToken).not.toBe(authToken);
    });

    it('POST /api/auth/refresh-token - invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      validateErrorResponse(response);
    });

    it('POST /api/auth/logout - valid logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      validateContract(contractRegistry['POST /api/auth/logout'], response);
    });

    it('POST /api/auth/logout - missing token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(401);

      validateErrorResponse(response);
    });
  });

  // ==================== USER CONTRACT TESTS ====================
  describe('User Contracts', () => {
    it('GET /api/users/profile - valid request', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const validated = validateContract(contractRegistry['GET /api/users/profile'], response);
      expect(validated.data.user.email).toBe(testUser.email);
      expect(validated.data.user.id).toBe(testUserId);
    });

    it('GET /api/users/profile - missing token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      validateErrorResponse(response);
      expect(response.body.error).toContain('No token');
    });

    it('PUT /api/users/profile - update profile', async () => {
      const updateData = {
        firstName: 'UpdatedFirstName',
        lastName: 'UpdatedLastName',
        preferences: {
          theme: 'dark',
          notifications: false
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      const validated = validateContract(contractRegistry['PUT /api/users/profile'], response);
      expect(validated.data.user.firstName).toBe(updateData.firstName);
      expect(validated.data.user.lastName).toBe(updateData.lastName);
      expect(validated.data.user.preferences.theme).toBe(updateData.preferences.theme);
    });

    it('PUT /api/users/profile - invalid data', async () => {
      const invalidData = {
        firstName: '', // Empty string
        preferences: {
          theme: 'invalid-theme' // Invalid value
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      const { error } = schemas.validationErrorResponse.validate(response.body);
      expect(error).toBeUndefined();
      expect(response.body.validationErrors).toBeInstanceOf(Array);
    });

    it('GET /api/users - admin only (should be forbidden for regular user)', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      validateErrorResponse(response);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('GET /api/users/:id - get specific user', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const validated = validateContract(contractRegistry['GET /api/users/:id'], response);
      expect(validated.data.user.id).toBe(testUserId);
    });

    it('GET /api/users/:id - non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      validateErrorResponse(response);
      expect(response.body.error).toContain('User not found');
    });
  });

  // ==================== PASSWORD MANAGEMENT CONTRACT TESTS ====================
  describe('Password Management Contracts', () => {
    it('POST /api/auth/forgot-password - valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      validateContract(contractRegistry['POST /api/auth/forgot-password'], response);
      expect(response.body.data.resetToken).toBeDefined();
    });

    it('POST /api/auth/forgot-password - invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      const { error } = schemas.validationErrorResponse.validate(response.body);
      expect(error).toBeUndefined();
    });

    it('POST /api/auth/reset-password - valid reset', async () => {
      // First get reset token
      const forgotResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email });

      const resetToken = forgotResponse.body.data.resetToken;
      const newPassword = 'NewContract@123456';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword,
          confirmPassword: newPassword
        })
        .expect(200);

      validateContract(contractRegistry['POST /api/auth/reset-password'], response);

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body.data.accessToken).toBeDefined();

      // Update auth token for subsequent tests
      authToken = loginResponse.body.data.accessToken;
    });

    it('POST /api/auth/reset-password - mismatched passwords', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'Password@123',
          confirmPassword: 'DifferentPassword@123'
        })
        .expect(400);

      const { error } = schemas.validationErrorResponse.validate(response.body);
      expect(error).toBeUndefined();
      expect(response.body.validationErrors.some((e: any) => 
        e.message.includes('match')
      )).toBe(true);
    });

    it('POST /api/auth/reset-password - weak password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'weak',
          confirmPassword: 'weak'
        })
        .expect(400);

      const { error } = schemas.validationErrorResponse.validate(response.body);
      expect(error).toBeUndefined();
    });
  });

  // ==================== 2FA CONTRACT TESTS ====================
  describe('2FA Contracts', () => {
    it('POST /api/auth/2fa/enable - enable 2FA', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ method: 'authenticator' })
        .expect(200);

      validateContract(contractRegistry['POST /api/auth/2fa/enable'], response);
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.recoveryCodes).toBeInstanceOf(Array);
      expect(response.body.data.recoveryCodes.length).toBe(10);
    });

    it('POST /api/auth/2fa/enable - missing authentication', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .send({ method: 'authenticator' })
        .expect(401);

      validateErrorResponse(response);
    });

    it('POST /api/auth/2fa/verify - verify 2FA setup', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: '123456' }) // Mock token
        .expect(200);

      validateContract(contractRegistry['POST /api/auth/2fa/verify'], response);
      expect(response.body.data.verified).toBe(true);
    });
  });

  // ==================== SECURITY HEADERS TESTS ====================
  describe('Security Headers', () => {
    it('should have appropriate security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
      
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      
      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers['strict-transport-security']).toContain('max-age');
    });

    it('should have CORS headers when applicable', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  // ==================== RATE LIMITING TESTS ====================
  describe('Rate Limiting', () => {
    it('should enforce rate limits on login endpoints', async () => {
      const requests = 6; // Assuming limit is 5
      const responses = [];

      for (let i = 0; i < requests; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123'
          });
        responses.push(response);
      }

      // The last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      
      const { error } = schemas.errorResponse.validate(lastResponse.body);
      expect(error).toBeUndefined();
      expect(lastResponse.body.error).toContain('Too many');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  // ==================== VERSIONING TESTS ====================
  describe('API Versioning', () => {
    it('should support API versioning', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('version', 'v1');
      expect(response.body).toHaveProperty('status', 'healthy');
    });

    it('should return 404 for unsupported versions', async () => {
      const response = await request(app)
        .get('/api/v999/health')
        .expect(404);

      validateErrorResponse(response);
    });
  });

  // ==================== PERFORMANCE TESTS ====================
  describe('Performance', () => {
    it('should respond within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      // Should respond within 500ms
      expect(responseTime).toBeLessThan(500);
      
      // Should have response time header
      expect(response.headers).toHaveProperty('x-response-time');
    });

    it('should handle concurrent requests', async () => {
      const requests = 10;
      const promises = [];

      for (let i = 0; i < requests; i++) {
        promises.push(
          request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});

// ==================== CONTRACT VALIDATION UTILITIES ====================
export class ContractValidator {
  static validateRequest(contract: ApiContract, data: any): { valid: boolean; errors?: any[] } {
    if (!contract.requestSchema) {
      return { valid: true };
    }

    const { error, value } = contract.requestSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return {
        valid: false,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      };
    }

    return { valid: true, errors: [] };
  }

  static validateResponse(contract: ApiContract, data: any): { valid: boolean; errors?: any[] } {
    const { error, value } = contract.responseSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return {
        valid: false,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      };
    }

    return { valid: true, errors: [] };
  }

  static validateStatus(contract: ApiContract, statusCode: number): boolean {
    return statusCode === contract.statusCode;
  }

  static generateContractReport(contracts: ApiContract[], results: any[]): string {
    let report = '=== API Contract Validation Report ===\n\n';
    
    results.forEach((result, index) => {
      const contract = contracts[index];
      report += `Endpoint: ${contract.method} ${contract.path}\n`;
      report += `Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      
      if (!result.passed) {
        report += `Errors:\n`;
        result.errors.forEach((error: any) => {
          report += `  - ${error}\n`;
        });
      }
      
      report += '\n';
    });

    return report;
  }
}

// ==================== SCHEMA GENERATOR ====================
export class SchemaGenerator {
  static generateMockData(schema: Schema): any {
    // This would generate mock data based on Joi schema
    // Implementation depends on your testing needs
    return {};
  }

  static generateTestCases(schema: Schema): Array<{ data: any; expected: 'valid' | 'invalid' }> {
    // This would generate test cases based on Joi schema
    // Implementation depends on your testing needs
    return [];
  }
}

// ==================== CONTRACT MONITOR ====================
export class ContractMonitor {
  private violations: Array<{
    endpoint: string;
    timestamp: Date;
    violation: string;
    request: any;
    response: any;
  }> = [];

  logViolation(endpoint: string, violation: string, request: any, response: any): void {
    this.violations.push({
      endpoint,
      timestamp: new Date(),
      violation,
      request,
      response
    });
  }

  getViolations(): Array<any> {
    return this.violations;
  }

  generateViolationReport(): string {
    let report = '=== API Contract Violations ===\n\n';
    
    this.violations.forEach(violation => {
      report += `Endpoint: ${violation.endpoint}\n`;
      report += `Timestamp: ${violation.timestamp.toISOString()}\n`;
      report += `Violation: ${violation.violation}\n`;
      report += `Request: ${JSON.stringify(violation.request, null, 2)}\n`;
      report += `Response: ${JSON.stringify(violation.response, null, 2)}\n`;
      report += '\n---\n\n';
    });

    return report;
  }

  clearViolations(): void {
    this.violations = [];
  }
}
