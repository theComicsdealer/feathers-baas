import 'dotenv/config'
import { createApp, seedDatabase } from '@feathers-baas/core'

const app = await createApp()
await seedDatabase(app)
process.exit(0)
