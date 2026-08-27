// e2e-critical-journeys.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ==================== JOURNEY DEFINITIONS ====================
interface UserJourney {
  name: string;
  description: string;
  steps: JourneyStep[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  assertions: JourneyAssertion[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface JourneyStep {
  id: string;
  action: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  expectedStatus: number;
  expectedResponse?: (response: any) => void;
  validation?: (response: any) => boolean;
  waitFor?: number;
  retry?: number;
}

interface JourneyAssertion {
  description: string;
  condition: (context: JourneyContext) => Promise<boolean> | boolean;
  message: string;
}

interface JourneyContext {
  data: Record<string, any>;
  responses: Record<string, any>;
  errors: any[];
  startTime: Date;
  endTime?: Date;
  metadata: Record<string, any>;
}

// ==================== JOURNEY EXECUTOR ====================
class JourneyExecutor {
  private context: JourneyContext;

  constructor() {
    this.context = {
      data: {},
      responses: {},
      errors: [],
      startTime: new Date(),
      metadata: {}
    };
  }

  async execute(journey: UserJourney): Promise<{
    success: boolean;
    context: JourneyContext;
    errors: any[];
    duration: number;
  }> {
    console.log(`\n🚀 Starting Journey: ${journey.name}`);
    console.log(`📝 ${journey.description}\n`);

    try {
      // Setup
      if (journey.setup) {
        await journey.setup();
      }

      // Execute steps
      for (const step of journey.steps) {
        await this.executeStep(step);
      }

      // Run assertions
      for (const assertion of journey.assertions) {
        const result = await assertion.condition(this.context);
        if (!result) {
          throw new Error(`Assertion failed: ${assertion.message}`);
        }
      }

      this.context.endTime = new Date();
      const duration = this.context.endTime.getTime() - this.context.startTime.getTime();

      console.log(`✅ Journey Complete: ${journey.name} (${duration}ms)\n`);

      return {
        success: true,
        context: this.context,
        errors: [],
        duration
      };
    } catch (error: any) {
      this.context.errors.push(error);
      console.error(`❌ Journey Failed: ${journey.name}`);
      console.error(error.message);

      return {
        success: false,
        context: this.context,
        errors: [error],
        duration: new Date().getTime() - this.context.startTime.getTime()
      };
    } finally {
      if (journey.teardown) {
        await journey.teardown();
      }
    }
  }

  private async executeStep(step: JourneyStep): Promise<void> {
    console.log(`  ➡️ Step: ${step.id}`);

    let attempts = 0;
    const maxAttempts = step.retry || 1;

    while (attempts < maxAttempts) {
      try {
        const response = await this.makeRequest(step);

        if (response.status !== step.expectedStatus) {
          throw new Error(`Expected status ${step.expectedStatus}, got ${response.status}`);
        }

        if (step.expectedResponse) {
          step.expectedResponse(response);
        }

        if (step.validation && !step.validation(response)) {
          throw new Error(`Validation failed for step ${step.id}`);
        }

        // Store response in context
        this.context.responses[step.id] = response.body;
        
        // Extract and store data from response
        if (response.body?.data) {
          this.context.data = {
            ...this.context.data,
            ...response.body.data
          };
        }

        // Wait if specified
        if (step.waitFor) {
          await this.wait(step.waitFor);
        }

        console.log(`    ✅ Step ${step.id} completed successfully`);
        return;
      } catch (error: any) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Step ${step.id} failed after ${maxAttempts} attempts: ${error.message}`);
        }
        console.log(`    ⚠️ Step ${step.id} failed, retrying (${attempts}/${maxAttempts})...`);
        await this.wait(1000);
      }
    }
  }

  private async makeRequest(step: JourneyStep): Promise<any> {
    let path = step.path;
    // Replace path parameters with context data
    Object.keys(this.context.data).forEach(key => {
      path = path.replace(`:${key}`, this.context.data[key]);
    });

    const requestBuilder = request(app)
      [step.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'](path);

    if (step.headers) {
      Object.entries(step.headers).forEach(([key, value]) => {
        // Replace header values with context data
        let processedValue = value;
        Object.keys(this.context.data).forEach(k => {
          processedValue = processedValue.replace(`{{${k}}}`, this.context.data[k]);
        });
        requestBuilder.set(key, processedValue);
      });
    }

    if (step.body) {
      // Process body with context data
      const processedBody = this.processTemplate(step.body);
      requestBuilder.send(processedBody);
    }

    return requestBuilder;
  }

  private processTemplate(data: any): any {
    if (typeof data === 'string') {
      let processed = data;
      Object.keys(this.context.data).forEach(key => {
        processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), this.context.data[key]);
      });
      return processed;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.processTemplate(item));
    }

    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      Object.keys(data).forEach(key => {
        result[key] = this.processTemplate(data[key]);
      });
      return result;
    }

    return data;
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== DATA GENERATORS ====================
class DataGenerator {
  static generateUser() {
    return {
      email: faker.internet.email(),
      password: 'Test@123456',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      phoneNumber: faker.phone.number({ style: 'international' }),
      acceptTerms: true
    };
  }

  static generateProduct() {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price()),
      category: faker.commerce.department(),
      sku: faker.string.alphanumeric(10).toUpperCase(),
      stock: faker.number.int({ min: 0, max: 100 })
    };
  }

  static generateOrder() {
    return {
      items: [
        {
          productId: 1,
          quantity: faker.number.int({ min: 1, max: 5 }),
          price: parseFloat(faker.commerce.price())
        }
      ],
      shippingAddress: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: faker.location.country()
      },
      paymentMethod: faker.helpers.arrayElement(['credit_card', 'paypal', 'bank_transfer'])
    };
  }
}

// ==================== JOURNEY DEFINITIONS ====================

// Journey 1: Complete User Registration and Onboarding
const userRegistrationJourney: UserJourney = {
  name: 'User Registration and Onboarding',
  description: 'Complete user registration flow including email verification and profile setup',
  priority: 'critical',
  steps: [
    {
      id: 'register',
      action: 'Register new user',
      method: 'POST',
      path: '/api/auth/register',
      body: () => DataGenerator.generateUser(),
      expectedStatus: 201,
      expectedResponse: (response) => {
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.verificationToken).toBeDefined();
        expect(response.body.data.user.email).toBeDefined();
      },
      validation: (response) => response.body.data.user.id > 0
    },
    {
      id: 'verify_email',
      action: 'Verify user email',
      method: 'GET',
      path: '/api/auth/verify-email/{{verificationToken}}',
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('verified');
      }
    },
    {
      id: 'login',
      action: 'Login with verified account',
      method: 'POST',
      path: '/api/auth/login',
      body: (context) => ({
        email: context.data.user.email,
        password: context.data.user.password
      }),
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();
        expect(response.body.data.user.isVerified).toBe(true);
      },
      validation: (response) => response.body.data.accessToken.length > 0
    },
    {
      id: 'complete_profile',
      action: 'Complete user profile',
      method: 'PUT',
      path: '/api/users/profile',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        phoneNumber: faker.phone.number({ style: 'international' }),
        preferences: {
          theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
          notifications: faker.datatype.boolean(),
          language: faker.helpers.arrayElement(['en', 'es', 'fr'])
        }
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.user.firstName).toBeDefined();
        expect(response.body.data.user.preferences).toBeDefined();
      }
    },
    {
      id: 'get_profile',
      action: 'Get updated profile',
      method: 'GET',
      path: '/api/users/profile',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.preferences).toBeDefined();
      }
    }
  ],
  assertions: [
    {
      description: 'User should be able to login after registration',
      condition: (context) => context.data.accessToken !== undefined,
      message: 'Access token should be present after login'
    },
    {
      description: 'User profile should be updated successfully',
      condition: (context) => context.data.user.firstName !== undefined,
      message: 'Profile should contain updated fields'
    }
  ],
  setup: async () => {
    // Clean up any existing test users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });
  },
  teardown: async () => {
    // Clean up created user
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });
  }
};

// Journey 2: Password Reset Flow
const passwordResetJourney: UserJourney = {
  name: 'Password Reset Flow',
  description: 'Complete password reset process from request to new login',
  priority: 'high',
  steps: [
    {
      id: 'register_for_reset',
      action: 'Register user for password reset test',
      method: 'POST',
      path: '/api/auth/register',
      body: () => DataGenerator.generateUser(),
      expectedStatus: 201,
      validation: (response) => response.body.data.user.id > 0
    },
    {
      id: 'verify_for_reset',
      action: 'Verify user email',
      method: 'GET',
      path: '/api/auth/verify-email/{{verificationToken}}',
      expectedStatus: 200
    },
    {
      id: 'request_reset',
      action: 'Request password reset',
      method: 'POST',
      path: '/api/auth/forgot-password',
      body: (context) => ({
        email: context.data.user.email
      }),
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.resetToken).toBeDefined();
      }
    },
    {
      id: 'reset_password',
      action: 'Reset password with token',
      method: 'POST',
      path: '/api/auth/reset-password',
      body: (context) => ({
        token: context.data.resetToken,
        newPassword: 'NewPassword@123456',
        confirmPassword: 'NewPassword@123456'
      }),
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.success).toBe(true);
      }
    },
    {
      id: 'login_new_password',
      action: 'Login with new password',
      method: 'POST',
      path: '/api/auth/login',
      body: (context) => ({
        email: context.data.user.email,
        password: 'NewPassword@123456'
      }),
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.accessToken).toBeDefined();
      }
    },
    {
      id: 'logout_after_reset',
      action: 'Logout after password reset',
      method: 'POST',
      path: '/api/auth/logout',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200
    }
  ],
  assertions: [
    {
      description: 'Password reset should be successful',
      condition: (context) => context.data.accessToken !== undefined,
      message: 'Should receive access token after password reset'
    },
    {
      description: 'Old password should no longer work',
      condition: async (context) => {
        try {
          await request(app)
            .post('/api/auth/login')
            .send({
              email: context.data.user.email,
              password: context.data.user.password
            });
          return false;
        } catch (error: any) {
          return error.status === 401;
        }
      },
      message: 'Old password should be invalid after reset'
    }
  ],
  setup: async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'reset'
        }
      }
    });
  },
  teardown: async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'reset'
        }
      }
    });
  }
};

// Journey 3: Shopping Cart and Checkout
const shoppingJourney: UserJourney = {
  name: 'Shopping Cart and Checkout',
  description: 'Complete e-commerce flow from product browsing to checkout',
  priority: 'critical',
  steps: [
    {
      id: 'register_shopper',
      action: 'Register shopper',
      method: 'POST',
      path: '/api/auth/register',
      body: () => DataGenerator.generateUser(),
      expectedStatus: 201
    },
    {
      id: 'verify_shopper',
      action: 'Verify shopper email',
      method: 'GET',
      path: '/api/auth/verify-email/{{verificationToken}}',
      expectedStatus: 200
    },
    {
      id: 'login_shopper',
      action: 'Login shopper',
      method: 'POST',
      path: '/api/auth/login',
      body: (context) => ({
        email: context.data.user.email,
        password: context.data.user.password
      }),
      expectedStatus: 200
    },
    {
      id: 'browse_products',
      action: 'Browse products',
      method: 'GET',
      path: '/api/products',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.products).toBeDefined();
        expect(Array.isArray(response.body.data.products)).toBe(true);
      }
    },
    {
      id: 'add_to_cart',
      action: 'Add product to cart',
      method: 'POST',
      path: '/api/cart/items',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: (context) => ({
        productId: context.data.products[0].id,
        quantity: 2
      }),
      expectedStatus: 201,
      expectedResponse: (response) => {
        expect(response.body.data.cart.totalItems).toBeGreaterThan(0);
      }
    },
    {
      id: 'update_cart',
      action: 'Update cart quantity',
      method: 'PUT',
      path: '/api/cart/items/{{cartItemId}}',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: {
        quantity: 3
      },
      expectedStatus: 200
    },
    {
      id: 'view_cart',
      action: 'View current cart',
      method: 'GET',
      path: '/api/cart',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.cart.totalItems).toBe(3);
        expect(response.body.data.cart.subtotal).toBeGreaterThan(0);
      }
    },
    {
      id: 'checkout',
      action: 'Checkout order',
      method: 'POST',
      path: '/api/orders',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: () => DataGenerator.generateOrder(),
      expectedStatus: 201,
      expectedResponse: (response) => {
        expect(response.body.data.order.id).toBeDefined();
        expect(response.body.data.order.status).toBe('pending');
      }
    },
    {
      id: 'view_order',
      action: 'View order details',
      method: 'GET',
      path: '/api/orders/{{orderId}}',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.order.id).toBeDefined();
        expect(response.body.data.order.items).toBeDefined();
      }
    }
  ],
  assertions: [
    {
      description: 'Cart should contain items after adding',
      condition: (context) => context.data.cart.totalItems > 0,
      message: 'Cart should have items'
    },
    {
      description: 'Order should be created successfully',
      condition: (context) => context.data.orderId !== undefined,
      message: 'Order ID should be present'
    },
    {
      description: 'Cart should be empty after order',
      condition: async (context) => {
        const response = await request(app)
          .get('/api/cart')
          .set('Authorization', `Bearer ${context.data.accessToken}`);
        return response.body.data.cart.totalItems === 0;
      },
      message: 'Cart should be empty after checkout'
    }
  ],
  setup: async () => {
    // Seed products
    await prisma.product.createMany({
      data: [
        {
          name: 'Test Product 1',
          description: 'Test Description 1',
          price: 29.99,
          category: 'Electronics',
          sku: 'TEST001',
          stock: 10
        },
        {
          name: 'Test Product 2',
          description: 'Test Description 2',
          price: 49.99,
          category: 'Books',
          sku: 'TEST002',
          stock: 5
        }
      ]
    });
  },
  teardown: async () => {
    await prisma.product.deleteMany({
      where: {
        sku: {
          in: ['TEST001', 'TEST002']
        }
      }
    });
  }
};

// Journey 4: Admin Dashboard Management
const adminJourney: UserJourney = {
  name: 'Admin Dashboard Management',
  description: 'Complete admin workflow including user management and analytics',
  priority: 'high',
  steps: [
    {
      id: 'register_admin',
      action: 'Register admin user',
      method: 'POST',
      path: '/api/auth/register',
      body: () => ({
        ...DataGenerator.generateUser(),
        role: 'ADMIN'
      }),
      expectedStatus: 201
    },
    {
      id: 'verify_admin',
      action: 'Verify admin email',
      method: 'GET',
      path: '/api/auth/verify-email/{{verificationToken}}',
      expectedStatus: 200
    },
    {
      id: 'login_admin',
      action: 'Login as admin',
      method: 'POST',
      path: '/api/auth/login',
      body: (context) => ({
        email: context.data.user.email,
        password: context.data.user.password
      }),
      expectedStatus: 200
    },
    {
      id: 'get_all_users',
      action: 'Get all users',
      method: 'GET',
      path: '/api/admin/users',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.users).toBeDefined();
        expect(Array.isArray(response.body.data.users)).toBe(true);
        expect(response.body.data.users.length).toBeGreaterThan(0);
      }
    },
    {
      id: 'get_user_stats',
      action: 'Get user statistics',
      method: 'GET',
      path: '/api/admin/stats/users',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.totalUsers).toBeDefined();
        expect(response.body.data.activeUsers).toBeDefined();
        expect(response.body.data.newUsersToday).toBeDefined();
      }
    },
    {
      id: 'update_user_role',
      action: 'Update user role',
      method: 'PUT',
      path: '/api/admin/users/{{userId}}/role',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: {
        role: 'MODERATOR'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.user.role).toBe('MODERATOR');
      }
    },
    {
      id: 'get_revenue_stats',
      action: 'Get revenue statistics',
      method: 'GET',
      path: '/api/admin/stats/revenue',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.totalRevenue).toBeDefined();
        expect(response.body.data.monthlyRevenue).toBeDefined();
        expect(response.body.data.ordersCount).toBeDefined();
      }
    },
    {
      id: 'manage_products',
      action: 'Create new product',
      method: 'POST',
      path: '/api/admin/products',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: () => DataGenerator.generateProduct(),
      expectedStatus: 201,
      expectedResponse: (response) => {
        expect(response.body.data.product.id).toBeDefined();
        expect(response.body.data.product.sku).toBeDefined();
      }
    }
  ],
  assertions: [
    {
      description: 'Admin should have access to user management',
      condition: (context) => context.data.users !== undefined,
      message: 'Admin should be able to fetch all users'
    },
    {
      description: 'Admin should be able to modify user roles',
      condition: (context) => context.data.user.role === 'MODERATOR',
      message: 'Role should be updated to MODERATOR'
    },
    {
      description: 'Admin should have access to analytics',
      condition: (context) => context.data.totalRevenue !== undefined,
      message: 'Revenue stats should be available'
    }
  ],
  setup: async () => {
    // Ensure admin role exists in system
    await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN' }
    });
  },
  teardown: async () => {
    // Clean up admin test data
    await prisma.user.deleteMany({
      where: {
        role: {
          name: 'ADMIN'
        }
      }
    });
  }
};

// Journey 5: Two-Factor Authentication
const twoFactorJourney: UserJourney = {
  name: 'Two-Factor Authentication',
  description: 'Complete 2FA setup and login flow',
  priority: 'high',
  steps: [
    {
      id: 'register_2fa',
      action: 'Register user for 2FA',
      method: 'POST',
      path: '/api/auth/register',
      body: () => DataGenerator.generateUser(),
      expectedStatus: 201
    },
    {
      id: 'verify_2fa',
      action: 'Verify user email',
      method: 'GET',
      path: '/api/auth/verify-email/{{verificationToken}}',
      expectedStatus: 200
    },
    {
      id: 'login_2fa',
      action: 'Login before 2FA setup',
      method: 'POST',
      path: '/api/auth/login',
      body: (context) => ({
        email: context.data.user.email,
        password: context.data.user.password
      }),
      expectedStatus: 200
    },
    {
      id: 'enable_2fa',
      action: 'Enable 2FA',
      method: 'POST',
      path: '/api/auth/2fa/enable',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: {
        method: 'authenticator'
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.secret).toBeDefined();
        expect(response.body.data.qrCode).toBeDefined();
        expect(response.body.data.recoveryCodes).toBeDefined();
        expect(response.body.data.recoveryCodes.length).toBe(10);
      }
    },
    {
      id: 'verify_2fa_token',
      action: 'Verify 2FA token',
      method: 'POST',
      path: '/api/auth/2fa/verify',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      body: {
        token: '123456' // In real test, this would be generated from secret
      },
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.verified).toBe(true);
      }
    },
    {
      id: 'logout_2fa',
      action: 'Logout',
      method: 'POST',
      path: '/api/auth/logout',
      headers: {
        'Authorization': 'Bearer {{accessToken}}'
      },
      expectedStatus: 200
    },
    {
      id: 'login_with_2fa',
      action: 'Login with 2FA required',
      method: 'POST',
      path: '/api/auth/login',
      body: (context) => ({
        email: context.data.user.email,
        password: context.data.user.password
      }),
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.requires2FA).toBe(true);
        expect(response.body.data.tempToken).toBeDefined();
      }
    },
    {
      id: 'complete_2fa_login',
      action: 'Complete login with 2FA',
      method: 'POST',
      path: '/api/auth/2fa/login',
      body: (context) => ({
        tempToken: context.data.tempToken,
        token: '123456' // In real test, this would be generated from secret
      }),
      expectedStatus: 200,
      expectedResponse: (response) => {
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.user).toBeDefined();
      }
    }
  ],
  assertions: [
    {
      description: '2FA should be successfully enabled',
      condition: (context) => context.data.secret !== undefined,
      message: '2FA secret should be generated'
    },
    {
      description: 'User should require 2FA for login',
      condition: (context) => context.data.requires2FA === true,
      message: 'Login should require 2FA token'
    },
    {
      description: '2FA login should complete successfully',
      condition: (context) => context.data.accessToken !== undefined,
      message: 'Should receive access token after 2FA login'
    }
  ],
  setup: async () => {
    // Mock authenticator service
    // In production, you'd mock the actual 2FA library
  },
  teardown: async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '2fa'
        }
      }
    });
  }
};

// ==================== TEST EXECUTION ====================
describe('End-to-End Critical User Journeys', () => {
  const executor = new JourneyExecutor();
  const results: Array<{
    journey: string;
    success: boolean;
    duration: number;
    errors: any[];
  }> = [];

  // Run all journeys with proper timeouts
  const journeys = [
    userRegistrationJourney,
    passwordResetJourney,
    shoppingJourney,
    adminJourney,
    twoFactorJourney
  ];

  it('should execute user registration and onboarding journey', async () => {
    const result = await executor.execute(userRegistrationJourney);
    results.push({
      journey: userRegistrationJourney.name,
      success: result.success,
      duration: result.duration,
      errors: result.errors
    });
    expect(result.success).toBe(true);
  }, 30000);

  it('should execute password reset flow journey', async () => {
    const result = await executor.execute(passwordResetJourney);
    results.push({
      journey: passwordResetJourney.name,
      success: result.success,
      duration: result.duration,
      errors: result.errors
    });
    expect(result.success).toBe(true);
  }, 30000);

  it('should execute shopping cart and checkout journey', async () => {
    const result = await executor.execute(shoppingJourney);
    results.push({
      journey: shoppingJourney.name,
      success: result.success,
      duration: result.duration,
      errors: result.errors
    });
    expect(result.success).toBe(true);
  }, 30000);

  it('should execute admin dashboard management journey', async () => {
    const result = await executor.execute(adminJourney);
    results.push({
      journey: adminJourney.name,
      success: result.success,
      duration: result.duration,
      errors: result.errors
    });
    expect(result.success).toBe(true);
  }, 30000);

  it('should execute two-factor authentication journey', async () => {
    const result = await executor.execute(twoFactorJourney);
    results.push({
      journey: twoFactorJourney.name,
      success: result.success,
      duration: result.duration,
      errors: result.errors
    });
    expect(result.success).toBe(true);
  }, 30000);

  // Generate summary report
  afterAll(() => {
    console.log('\n📊 End-to-End Test Summary');
    console.log('========================');
    
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = total - passed;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Journeys: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Total Duration: ${totalTime}ms`);
    console.log(`📈 Average Duration: ${Math.round(totalTime / total)}ms\n`);

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.journey} (${result.duration}ms)`);
      if (!result.success && result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.map(e => e.message).join(', ')}`);
      }
    });

    console.log('\n' + '='.repeat(40));
  });
});

// ==================== ERROR HANDLING AND RETRY ====================
class JourneyErrorHandler {
  static handleNetworkError(error: any): boolean {
    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      console.log('Network error detected, attempting to reconnect...');
      return true;
    }
    return false;
  }

  static handleRateLimitError(error: any): boolean {
    // Handle rate limit errors
    if (error.response?.status === 429) {
      console.log('Rate limit detected, waiting before retry...');
      return true;
    }
    return false;
  }

  static isRetryableError(error: any): boolean {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.response?.status) ||
           this.handleNetworkError(error) ||
           this.handleRateLimitError(error);
  }

  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }
        console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    throw lastError;
  }
}

// ==================== JOURNEY VALIDATOR ====================
class JourneyValidator {
  static validateJourneyDefinition(journey: UserJourney): boolean {
    if (!journey.name || !journey.steps || !journey.assertions) {
      return false;
    }

    // Validate steps have required fields
    for (const step of journey.steps) {
      if (!step.id || !step.method || !step.path || !step.expectedStatus) {
        return false;
      }
    }

    // Validate assertions have required fields
    for (const assertion of journey.assertions) {
      if (!assertion.description || !assertion.condition) {
        return false;
      }
    }

    return true;
  }

  static validateJourneyResults(results: any[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    results.forEach((result, index) => {
      if (!result.journey) {
        issues.push(`Result ${index} missing journey name`);
      }
      if (result.success === undefined) {
        issues.push(`Result ${index} missing success flag`);
      }
      if (result.duration === undefined) {
        issues.push(`Result ${index} missing duration`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// ==================== PERFORMANCE MONITOR ====================
class PerformanceMonitor {
  private metrics: Map<string, {
    duration: number[];
    errors: number;
    successes: number;
  }> = new Map();

  recordJourneyResult(journeyName: string, success: boolean, duration: number): void {
    if (!this.metrics.has(journeyName)) {
      this.metrics.set(journeyName, {
        duration: [],
        errors: 0,
        successes: 0
      });
    }

    const metric = this.metrics.get(journeyName)!;
    metric.duration.push(duration);
    if (success) {
      metric.successes++;
    } else {
      metric.errors++;
    }
  }

  getMetrics(): any {
    const result: any = {};
    for (const [name, metric] of this.metrics) {
      const durations = metric.duration;
      result[name] = {
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        successRate: (metric.successes / (metric.successes + metric.errors)) * 100,
        totalRuns: metric.successes + metric.errors
      };
    }
    return result;
  }

  generateReport(): string {
    const metrics = this.getMetrics();
    let report = '\n📈 Performance Metrics\n';
    report += '='.repeat(50) + '\n\n';

    for (const [name, metric] of Object.entries(metrics)) {
      report += `Journey: ${name}\n`;
      report += `  Average Duration: ${(metric as any).avgDuration}ms\n`;
      report += `  Min Duration: ${(metric as any).minDuration}ms\n`;
      report += `  Max Duration: ${(metric as any).maxDuration}ms\n`;
      report += `  Success Rate: ${(metric as any).successRate.toFixed(1)}%\n`;
      report += `  Total Runs: ${(metric as any).totalRuns}\n\n`;
    }

    return report;
  }
}

export {
  UserJourney,
  JourneyStep,
  JourneyContext,
  JourneyExecutor,
  JourneyValidator,
  JourneyErrorHandler,
  PerformanceMonitor,
  DataGenerator
};
