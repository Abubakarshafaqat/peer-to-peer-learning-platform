import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peer-learning-test';

let app;
let mongoAvailable = false;

beforeAll(async () => {
  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    app = createApp();
    mongoAvailable = true;
  } catch (err) {
    console.warn(
      `\n[auth.test] MongoDB not reachable at ${TEST_URI} — auth cases skipped.\n` +
        `Start MongoDB and re-run: npm test --prefix server\n` +
        `Reason: ${err.message}\n`,
    );
  }
}, 20000);

afterEach(async () => {
  if (!mongoAvailable) return;
  // Native driver bypasses tenantPlugin (test cleanup only)
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

function authIt(name, fn) {
  it(name, async () => {
    if (!mongoAvailable) return;
    await fn();
  });
}

const student = {
  fullName: 'Test Student',
  username: 'teststudent',
  email: 'student@example.com',
  phone: '03001234567',
  password: 'Password1',
};

describe('Auth API (SRS-01..29)', () => {
  it('reports whether MongoDB was available for this run', () => {
    expect(typeof mongoAvailable).toBe('boolean');
  });

  authIt('registers a student (never admin via public form)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(student);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.email).toBe(student.email);
  });

  authIt('rejects duplicate email/username', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const res = await request(app).post('/api/v1/auth/register').send(student);
    expect(res.status).toBe(409);
  });

  authIt('logs in with email and returns access token + refresh cookie', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: student.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.join(';')).toMatch(/pl_refresh/);
  });

  authIt('logs in with username', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.username, password: student.password });
    expect(res.status).toBe(200);
  });

  authIt('rejects weak passwords on register', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...student, password: 'weak' });
    expect(res.status).toBe(400);
  });

  authIt('returns current user with bearer token', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: student.password });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(student.username);
  });

  authIt('refreshes access token using cookie', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: student.password });

    const cookies = login.headers['set-cookie'];
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  authIt('changes password and revokes old credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: student.password });

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ currentPassword: student.password, newPassword: 'NewPass12' });

    expect(change.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: student.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: 'NewPass12' });
    expect(newLogin.status).toBe(200);
  });

  authIt('updates profile fields', async () => {
    await request(app).post('/api/v1/auth/register').send(student);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: student.email, password: student.password });

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ fullName: 'Updated Name', phone: '03111234567' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.fullName).toBe('Updated Name');
  });

  authIt('requires auth for /me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  authIt('ignores role field on register — always student', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...student, role: 'tenantAdmin' });
    const user = await User.findOne({ email: student.email });
    expect(user.role).toBe('student');
  });
});
