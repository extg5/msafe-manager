/**
 * Get the base path for the application
 * This should match the Vite base configuration
 */
export function getBasePath(): string {
  // Get base path from environment variable, fallback to default
  const envBasePath = import.meta.env.VITE_BASE_PATH
  if (envBasePath) {
    return envBasePath
  }
  
  // Fallback to default based on environment
  return import.meta.env.PROD ? '/msafe-manager/' : '/'
}

/**
 * Get the basename for React Router (without trailing slash)
 */
export function getRouterBasename(): string {
  const basePath = getBasePath()
  // Remove trailing slash for React Router basename
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
}
