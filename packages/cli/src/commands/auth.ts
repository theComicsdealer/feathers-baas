import { Command, Option } from 'clipanion'
import { input, select, checkbox, password, confirm } from '@inquirer/prompts'
import { loadApp } from '../utils/app-loader.js'
import * as output from '../utils/output.js'

// ─── Shared types ─────────────────────────────────────────────────────────────

interface Permission {
  service: string
  methods: string[]
}

interface Role {
  id: string
  name: string
  permissions: Permission[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type App = any

const METHOD_CHOICES = [
  { value: '*', name: '* (all methods)' },
  { value: 'find' },
  { value: 'get' },
  { value: 'create' },
  { value: 'update' },
  { value: 'patch' },
  { value: 'remove' },
]

async function fetchRoles(app: App): Promise<Role[]> {
  const result = await app.service('roles')._find({ query: { $limit: 200 }, paginate: false })
  return (Array.isArray(result) ? result : result.data) as Role[]
}

async function promptPermission(): Promise<Permission> {
  const svc = await input({
    message: 'Service name (* for all):',
    validate: (v) => v.trim().length > 0 || 'Required',
  })
  const methods = await checkbox<string>({
    message: 'Methods:',
    choices: METHOD_CHOICES,
    validate: (v) => v.length > 0 || 'Select at least one method',
  })
  return { service: svc.trim(), methods }
}

// ─── auth list-roles ──────────────────────────────────────────────────────────

export class AuthListRolesCommand extends Command {
  static override paths = [['auth', 'list-roles']]

  static override usage = Command.Usage({
    description: 'List all roles and their permissions',
    examples: [
      ['Table format', 'feathers-baas auth list-roles'],
      ['JSON output', 'feathers-baas auth list-roles --json'],
    ],
  })

  json = Option.Boolean('--json', false, { description: 'Output raw JSON' })

  async execute(): Promise<void> {
    try {
      output.info('Booting app...')
      const app = await loadApp()
      const roles = await fetchRoles(app)

      if (this.json) {
        console.log(JSON.stringify(roles, null, 2))
      } else if (roles.length === 0) {
        output.warn('No roles found. Run: feathers-baas seed')
      } else {
        console.log()
        for (const role of roles) {
          console.log(`  ${role.name}  (id: ${role.id})`)
          if (role.permissions.length === 0) {
            console.log('    — no permissions')
          }
          for (const p of role.permissions) {
            console.log(`    ${p.service}: ${p.methods.join(', ')}`)
          }
          console.log()
        }
      }

      process.exit(0)
    } catch (err) {
      output.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    }
  }
}

// ─── auth create-role ─────────────────────────────────────────────────────────

export class AuthCreateRoleCommand extends Command {
  static override paths = [['auth', 'create-role']]

  static override usage = Command.Usage({
    description: 'Create a new role with permissions',
    examples: [
      ['Interactive', 'feathers-baas auth create-role'],
      ['With name pre-filled', 'feathers-baas auth create-role --name editor'],
    ],
  })

  name = Option.String('--name,-n', { required: false, description: 'Role name' })

  async execute(): Promise<void> {
    try {
      const roleName = this.name ?? await input({
        message: 'Role name:',
        validate: (v) =>
          /^[a-z][a-z0-9_-]*$/.test(v.trim()) || 'Lowercase letters, digits, hyphens or underscores',
      })

      const permissions: Permission[] = []
      let addMore = true
      while (addMore) {
        permissions.push(await promptPermission())
        addMore = await confirm({ message: 'Add another permission?', default: false })
      }

      output.info('\nBooting app...')
      const app = await loadApp()

      const existing = (await app.service('roles')._find({
        query: { name: roleName.trim(), $limit: 1 },
        paginate: false,
      })) as Role[]
      if (existing.length > 0) {
        output.error(`Role "${roleName}" already exists (id: ${existing[0]!.id})`)
        process.exitCode = 1
        return
      }

      const now = new Date().toISOString()
      const role = (await app.service('roles')._create({
        name: roleName.trim(),
        permissions,
        createdAt: now,
        updatedAt: now,
      })) as Role

      output.success(`Role "${role.name}" created (id: ${role.id})`)
      process.exit(0)
    } catch (err) {
      output.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    }
  }
}

// ─── auth add-permissions ─────────────────────────────────────────────────────

export class AuthAddPermissionsCommand extends Command {
  static override paths = [['auth', 'add-permissions']]

  static override usage = Command.Usage({
    description: 'Add a permission to an existing role',
    examples: [
      ['Interactive', 'feathers-baas auth add-permissions'],
      ['Non-interactive', 'feathers-baas auth add-permissions --role editor --service posts --methods find,get,create'],
    ],
  })

  roleName = Option.String('--role,-r', { required: false, description: 'Target role name' })
  service  = Option.String('--service,-s', { required: false, description: 'Service name (* for all)' })
  methods  = Option.String('--methods,-m', { required: false, description: 'Comma-separated methods (find,get,… or *)' })

  async execute(): Promise<void> {
    try {
      output.info('Booting app...')
      const app = await loadApp()
      const roles = await fetchRoles(app)

      if (roles.length === 0) {
        output.error('No roles found. Run: feathers-baas seed')
        process.exitCode = 1
        return
      }

      const targetName = this.roleName ?? await select({
        message: 'Role:',
        choices: roles.map((r) => ({ value: r.name, name: `${r.name} (${r.id})` })),
      })

      const role = roles.find((r) => r.name === targetName)
      if (!role) {
        output.error(`Role "${targetName}" not found`)
        process.exitCode = 1
        return
      }

      const permission: Permission =
        this.service && this.methods
          ? { service: this.service, methods: this.methods.split(',').map((m) => m.trim()) }
          : await promptPermission()

      const updated = [...role.permissions, permission]
      await app.service('roles')._patch(role.id, {
        permissions: updated,
        updatedAt: new Date().toISOString(),
      })

      output.success(`Added "${permission.service}: ${permission.methods.join(', ')}" to role "${role.name}"`)
      process.exit(0)
    } catch (err) {
      output.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    }
  }
}

// ─── auth remove-permissions ──────────────────────────────────────────────────

export class AuthRemovePermissionsCommand extends Command {
  static override paths = [['auth', 'remove-permissions']]

  static override usage = Command.Usage({
    description: 'Remove one or more permissions from a role',
    examples: [
      ['Interactive', 'feathers-baas auth remove-permissions'],
      ['Pre-select role', 'feathers-baas auth remove-permissions --role editor'],
    ],
  })

  roleName = Option.String('--role,-r', { required: false, description: 'Target role name' })

  async execute(): Promise<void> {
    try {
      output.info('Booting app...')
      const app = await loadApp()
      const roles = await fetchRoles(app)

      if (roles.length === 0) {
        output.error('No roles found. Run: feathers-baas seed')
        process.exitCode = 1
        return
      }

      const targetName = this.roleName ?? await select({
        message: 'Role:',
        choices: roles.map((r) => ({ value: r.name, name: `${r.name} (${r.id})` })),
      })

      const role = roles.find((r) => r.name === targetName)
      if (!role) {
        output.error(`Role "${targetName}" not found`)
        process.exitCode = 1
        return
      }

      if (role.permissions.length === 0) {
        output.warn(`Role "${role.name}" has no permissions to remove.`)
        process.exit(0)
      }

      const toRemove = await checkbox<number>({
        message: 'Select permissions to remove:',
        choices: role.permissions.map((p, i) => ({
          value: i,
          name: `${p.service}: ${p.methods.join(', ')}`,
        })),
        validate: (v) => v.length > 0 || 'Select at least one',
      })

      const remaining = role.permissions.filter((_, i) => !toRemove.includes(i))

      await app.service('roles')._patch(role.id, {
        permissions: remaining,
        updatedAt: new Date().toISOString(),
      })

      output.success(`Removed ${toRemove.length} permission(s) from role "${role.name}"`)
      process.exit(0)
    } catch (err) {
      output.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    }
  }
}

// ─── auth create-admin ────────────────────────────────────────────────────────

export class AuthCreateAdminCommand extends Command {
  static override paths = [['auth', 'create-admin']]

  static override usage = Command.Usage({
    description: 'Create a new admin user',
    examples: [
      ['Interactive', 'feathers-baas auth create-admin'],
      ['Non-interactive', 'feathers-baas auth create-admin --email admin@example.com --password secret123'],
    ],
  })

  email    = Option.String('--email,-e', { required: false, description: 'Admin email address' })
  pass     = Option.String('--password,-p', { required: false, description: 'Admin password (min 8 chars)' })

  async execute(): Promise<void> {
    try {
      const adminEmail = this.email ?? await input({
        message: 'Email:',
        validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Enter a valid email',
      })

      let adminPassword: string
      if (this.pass) {
        if (this.pass.length < 8) {
          output.error('Password must be at least 8 characters')
          process.exitCode = 1
          return
        }
        adminPassword = this.pass
      } else {
        adminPassword = await password({
          message: 'Password (min 8 chars):',
          validate: (v) => v.length >= 8 || 'Minimum 8 characters',
        })
        const confirm2 = await password({ message: 'Confirm password:' })
        if (adminPassword !== confirm2) {
          output.error('Passwords do not match')
          process.exitCode = 1
          return
        }
      }

      output.info('\nBooting app...')
      const app = await loadApp()

      const existing = (await app.service('users')._find({
        query: { email: adminEmail.trim(), $limit: 1 },
        paginate: false,
      })) as Array<{ id: string }>

      if (existing.length > 0) {
        output.error(`User "${adminEmail}" already exists (id: ${existing[0]!.id})`)
        process.exitCode = 1
        return
      }

      const user = (await app.service('users').create({
        email: adminEmail.trim(),
        password: adminPassword,
        roles: ['admin'],
      })) as { id: string; _id?: string }

      const userId = user.id ?? user._id
      await app.service('users')._patch(userId, { isVerified: true })

      output.success(`Admin user "${adminEmail}" created (id: ${userId})`)
      process.exit(0)
    } catch (err) {
      output.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    }
  }
}
