# @feathers-baas/plugin-files

File storage plugin for [feathers-baas](https://github.com/anthropics/feathers-baas) — local filesystem, AWS S3, and Google Cloud Storage drivers.

## Installation

```bash
pnpm add @feathers-baas/plugin-files
```

## Setup

Call `configureFiles` in your app bootstrap **after** database and auth configuration:

```ts
import { configureFiles, LocalDriver } from '@feathers-baas/plugin-files'

configureFiles(app, {
  driver: new LocalDriver({
    directory: './uploads',
    jwtSecret: config.jwtSecret,
    baseUrl: 'http://localhost:3030',
  }),
  driverType: 'local',
  bucket: 'uploads',
  maxFileSize: 52_428_800,           // 50 MB (default)
  allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'], // optional
})
```

Then run the migration to create the `files` table:

```bash
pnpm migrate
```

## Drivers

### Local filesystem

```ts
import { LocalDriver } from '@feathers-baas/plugin-files'

new LocalDriver({
  directory: './uploads',
  jwtSecret: config.jwtSecret,
  baseUrl: 'http://localhost:3030',
})
```

### AWS S3 (+ MinIO, LocalStack)

```ts
import { S3Driver } from '@feathers-baas/plugin-files'

new S3Driver({
  bucket: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // endpoint: 'http://localhost:9000',  // MinIO
  // forcePathStyle: true,               // required for MinIO
})
```

### Google Cloud Storage

```ts
import { GCSDriver } from '@feathers-baas/plugin-files'

new GCSDriver({
  bucket: 'my-gcs-bucket',
  // keyFilename: '/path/to/service-account.json',  // or use ADC
})
```

## API

| Method   | Path         | Description                        |
|----------|--------------|------------------------------------|
| `POST`   | `/files`     | Upload a file (`multipart/form-data`) |
| `GET`    | `/files`     | List file records (paginated)      |
| `GET`    | `/files/:id` | Get a file record                  |
| `PATCH`  | `/files/:id` | Update metadata                    |
| `DELETE` | `/files/:id` | Delete record + binary             |

All endpoints require a valid JWT. Uploads are streamed directly to the driver with no temporary buffering.

### Upload example

```bash
curl -X POST http://localhost:3030/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg"
```

Only the `metadata` field is patchable after upload. Deleting a file record also deletes the binary from the storage driver.

## Plugin interface

This package exports a `FeathersBaasPlugin` default export and is auto-discovered by `@feathers-baas/core` when listed as a dependency. The `configureFiles()` function must be called manually since it requires driver configuration.

## License

MIT
