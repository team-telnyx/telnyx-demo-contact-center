// Set test environment variables
process.env.JWT_SECRET = 'a'.repeat(32);
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.TELNYX_API = 'KEYtest123';
process.env.TELNYX_CONNECTION_ID = 'test-connection-id';
process.env.APP_HOST = 'localhost';
process.env.APP_PORT = '3000';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';
process.env.CORS_ORIGINS = '*';
