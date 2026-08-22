// auth.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../app'; // Assuming your Express app is exported
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

describe('Authentication Integration Tests', () => {
  // Test data
  const testUser = {
    email: 'testuser@example.com',
    password: 'Test@123456',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '+1234567890'
  };

  const testAdmin = {
    email: 'admin@example.com',
    password: 'Admin@123456',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN'
  };

  let accessToken: string;
  let refreshToken: string;
  let resetToken: string;
  let verificationToken: string;

  // Setup and cleanup
  beforeAll(async () => {
    // Clean up existing test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUser.email, testAdmin.email]
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up after tests
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUser.email, testAdmin.email]
        }
      }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset tokens before each test
    accessToken = '';
    refreshToken = '';
    resetToken = '';
    verificationToken = '';
  });

  // ==================== REGISTRATION TESTS ====================
  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data).toHaveProperty('verificationToken');
      
      verificationToken = response.body.data.verificationToken;
    });

    it('should not register user with existing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should validate password strength', async () => {
      const weakPasswordUser = {
        ...testUser,
        email: 'weak@example.com',
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });

    it('should validate email format', async () => {
      const invalidEmailUser = {
        ...testUser,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('should validate required fields', async () => {
      const incompleteUser = {
        email: testUser.email,
        // Missing password and other fields
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ==================== EMAIL VERIFICATION TESTS ====================
  describe('Email Verification', () => {
    it('should verify user email with valid token', async () => {
      const response = await request(app)
        .get(`/api/auth/verify-email/${verificationToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('verified');

      // Verify user is now verified in database
      const user = await prisma.user.findUnique({
        where: { email: testUser.email }
      });
      expect(user?.isVerified).toBe(true);
    });

    it('should not verify with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email/invalid-token')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should not verify expired token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { email: testUser.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get(`/api/auth/verify-email/${expiredToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('expired');
    });
  });

  // ==================== LOGIN TESTS ====================
  describe('User Login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).toHaveProperty('isVerified', true);
      
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should not login unverified user', async () => {
      // Create unverified user
      const unverifiedUser = {
        email: 'unverified@example.com',
        password: 'Unverified@123',
        firstName: 'Unverified',
        lastName: 'User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(unverifiedUser)
        .expect(201);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: unverifiedUser.email,
          password: unverifiedUser.password
        })
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('verify your email');

      // Clean up
      await prisma.user.delete({
        where: { email: unverifiedUser.email }
      });
    });

    it('should handle rate limiting on login attempts', async () => {
      const loginAttempts = 6; // Assuming rate limit is 5 attempts
      
      for (let i = 0; i < loginAttempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123'
          });

        if (i === loginAttempts - 1) {
          expect(response.status).toBe(429);
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toContain('Too many');
        }
      }
    });
  });

  // ==================== TOKEN TESTS ====================
  describe('Token Management', () => {
    it('should refresh access token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.accessToken).not.toBe(accessToken);
      
      // Update access token for subsequent tests
      accessToken = response.body.data.accessToken;
    });

    it('should not refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should not refresh with expired refresh token', async () => {
      // Create expired refresh token
      const expiredRefreshToken = jwt.sign(
        { userId: 1 },
        process.env.REFRESH_TOKEN_SECRET || 'refresh-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: expiredRefreshToken })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('expired');
    });

    it('should validate access token', async () => {
      const response = await request(app)
        .get('/api/auth/validate-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('valid', true);
      expect(response.body.data).toHaveProperty('user');
    });

    it('should reject invalid access token', async () => {
      const response = await request(app)
        .get('/api/auth/validate-token')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/validate-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No token');
    });
  });

  // ==================== PASSWORD MANAGEMENT TESTS ====================
  describe('Password Management', () => {
    it('should request password reset for existing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('resetToken');
      
      resetToken = response.body.data.resetToken;
    });

    it('should not reveal user existence for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Should return success even for non-existent email to prevent user enumeration
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'NewPassword@123';
      
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword,
          confirmPassword: newPassword
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('success', true);
      expect(loginResponse.body.data).toHaveProperty('accessToken');
    });

    it('should not reset with mismatched passwords', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword@123',
          confirmPassword: 'DifferentPassword@123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('match');
    });

    it('should not reset with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'weak',
          confirmPassword: 'weak'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('password');
    });

    it('should not reset with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword@123',
          confirmPassword: 'NewPassword@123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ==================== LOGOUT TESTS ====================
  describe('User Logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should not access protected route after logout', async () => {
      const response = await request(app)
        .get('/api/auth/validate-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should handle logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ==================== ROLE-BASED ACCESS TESTS ====================
  describe('Role-Based Access Control', () => {
    let adminAccessToken: string;

    beforeAll(async () => {
      // Create admin user
      await request(app)
        .post('/api/auth/register')
        .send(testAdmin)
        .expect(201);

      // Login as admin
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testAdmin.email,
          password: testAdmin.password
        })
        .expect(200);

      adminAccessToken = loginResponse.body.data.accessToken;
    });

    it('should allow admin to access admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('users');
    });

    it('should deny regular user access to admin routes', async () => {
      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword@123'
        })
        .expect(200);

      const userAccessToken = loginResponse.body.data.accessToken;

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==================== SECURITY TESTS ====================
  describe('Security Tests', () => {
    it('should prevent SQL injection in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR '1'='1",
          password: "' OR '1'='1"
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should prevent XSS in registration', async () => {
      const xssUser = {
        ...testUser,
        email: 'xss@example.com',
        firstName: '<script>alert("XSS")</script>',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(xssUser)
        .expect(201);

      // Check that XSS was sanitized
      const user = await prisma.user.findUnique({
        where: { email: xssUser.email }
      });
      
      expect(user?.firstName).not.toContain('<script>');
      expect(user?.firstName).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');

      // Clean up
      await prisma.user.delete({
        where: { email: xssUser.email }
      });
    });

    it('should handle concurrent login attempts properly', async () => {
      const promises = [];
      const attempts = 3;

      for (let i = 0; i < attempts; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: testUser.email,
              password: 'NewPassword@123'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });
  });

  // ==================== SESSION MANAGEMENT TESTS ====================
  describe('Session Management', () => {
    it('should invalidate all sessions on password change', async () => {
      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword@123'
        })
        .expect(200);

      const oldAccessToken = loginResponse.body.data.accessToken;
      const oldRefreshToken = loginResponse.body.data.refreshToken;

      // Change password
      const resetResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      const resetToken = resetResponse.body.data.resetToken;

      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'AnotherPassword@123',
          confirmPassword: 'AnotherPassword@123'
        })
        .expect(200);

      // Old tokens should be invalid
      const validateResponse = await request(app)
        .get('/api/auth/validate-token')
        .set('Authorization', `Bearer ${oldAccessToken}`)
        .expect(401);

      expect(validateResponse.body).toHaveProperty('success', false);

      // Refresh with old refresh token should fail
      const refreshResponse = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);

      expect(refreshResponse.body).toHaveProperty('success', false);
    });
  });

  // ==================== TWO-FACTOR AUTHENTICATION TESTS ====================
  describe('Two-Factor Authentication', () => {
    let twoFactorSecret: string;
    let twoFactorToken: string;

    it('should enable 2FA for user', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data).toHaveProperty('qrCode');
      
      twoFactorSecret = response.body.data.secret;
    });

    it('should verify 2FA setup', async () => {
      // Generate token from secret (in real test, use authenticator library)
      const token = '123456'; // Mock token
      
      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('verified', true);
    });

    it('should login with 2FA enabled', async () => {
      // First login without 2FA should return 2FA required
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'AnotherPassword@123'
        })
        .expect(200);

      expect(loginResponse.body.data).toHaveProperty('requires2FA', true);
      
      const tempToken = loginResponse.body.data.tempToken;

      // Complete login with 2FA
      const completeResponse = await request(app)
        .post('/api/auth/2fa/login')
        .send({
          tempToken,
          token: '123456' // Mock token
        })
        .expect(200);

      expect(completeResponse.body).toHaveProperty('success', true);
      expect(completeResponse.body.data).toHaveProperty('accessToken');
    });
  });
});

// ==================== HELPER FUNCTIONS ====================
export class AuthTestHelper {
  static generateToken(userId: number, expiresIn: string = '1h'): string {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn }
    );
  }

  static generateRefreshToken(userId: number): string {
    return jwt.sign(
      { userId },
      process.env.REFRESH_TOKEN_SECRET || 'refresh-secret',
      { expiresIn: '7d' }
    );
  }

  static async createTestUser(prisma: PrismaClient, userData: any) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    return prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        isVerified: true
      }
    });
  }

  static async cleanupTestUsers(prisma: PrismaClient, emails: string[]) {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: emails
        }
      }
    });
  }
}
