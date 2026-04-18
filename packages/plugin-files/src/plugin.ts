export interface FeathersBaasPlugin {
  name: string
  version: string
  install(app: unknown, options: Record<string, unknown>): Promise<void>
}
