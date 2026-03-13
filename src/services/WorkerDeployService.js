import workerCode from '../../workers/puter-worker.js?raw'
import * as WorkerConfig from '@/services/WorkerConfig.js'

const WORKER_FILE = 'clawboard-api.js'

/**
 * Computes a numeric hash of a string (DJB2 algorithm).
 * @private
 * @param {string} str
 * @returns {string} Hash as an unsigned integer string
 */
function hashCode(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return String(hash >>> 0)
}

/**
 * Generates a unique worker name with a random suffix.
 * @private
 * @returns {string}
 */
function generateWorkerName() {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `clawboard-api-${suffix}`
}

/**
 * Checks whether a worker URL has been configured.
 * @returns {boolean}
 */
export function isWorkerConfigured() {
  return WorkerConfig.isWorkerConfigured()
}

/**
 * Checks whether the worker was auto-deployed (vs. manually configured).
 * @returns {boolean}
 */
export function isAutoDeployed() {
  return WorkerConfig.isAutoDeployed()
}

/**
 * Determines whether the deployed worker code is out of date
 * by comparing the stored code hash against the current bundle.
 * @returns {boolean} True if the worker needs redeployment
 */
export function needsUpdate() {
  const storedHash = WorkerConfig.getCodeHash()
  if (!storedHash) return isAutoDeployed()
  return storedHash !== hashCode(workerCode)
}

/**
 * Deploys a new worker to Puter: writes the file, creates the worker,
 * generates an API key, and persists all config to KV via WorkerConfig.
 * @returns {Promise<{url: string, apiKey: string}>} Deployed worker URL and generated API key
 */
export async function deploy() {
  const workerName = generateWorkerName()

  // Write worker file to Puter filesystem
  await puter.fs.write(WORKER_FILE, workerCode)

  // Create the worker
  const result = await puter.workers.create(workerName, WORKER_FILE)
  const url = result.url

  // Generate API key
  const apiKey = 'sb_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24)

  // Persist config to KV and in-memory cache
  await WorkerConfig.setAll({
    workerUrl: url,
    apiKey,
    workerName,
    codeHash: hashCode(workerCode),
  })

  return { url, apiKey }
}

/**
 * Updates an existing worker by rewriting its source file.
 * Writing with puter.fs.write() automatically redeploys every worker
 * that references the file — no delete/create needed.
 * Worker URL and name stay the same.
 * @returns {Promise<{url: string}>} Existing worker URL
 * @throws {Error} If no worker name is found or file write fails
 */
export async function update() {
  if (!WorkerConfig.getWorkerName()) throw new Error('No worker name found — cannot update')

  const newHash = hashCode(workerCode)
  const oldHash = WorkerConfig.getCodeHash()

  // Optimistically set the new hash
  await WorkerConfig.set('codeHash', newHash)

  try {
    await puter.fs.write(WORKER_FILE, workerCode)
    return { url: WorkerConfig.getWorkerUrl() }
  } catch (err) {
    // Restore old hash on failure
    await WorkerConfig.set('codeHash', oldHash)
    throw err
  }
}
