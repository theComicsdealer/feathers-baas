---
'@feathers-baas/core': patch
---

Fix MongoDB support: service configurators now branch on database type, using MongoDBService classes when MongoDB is configured instead of requiring Knex
