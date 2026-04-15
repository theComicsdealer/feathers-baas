// Test setup — runs before all tests in packages/core
// Requires TEST_DATABASE_URL or DATABASE_URL to be set for integration tests.
import 'dotenv/config'

// Ensure we're in test mode
process.env['NODE_ENV'] = 'test'
// Suppress pino-pretty in tests
process.env['LOG_LEVEL'] = 'silent'
