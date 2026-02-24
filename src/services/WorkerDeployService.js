import workerCode from '../../workers/puter-worker.js?raw'

const WORKER_PREFIX = 'clawboard-api'
const WORKER_FILE = 'clawboard-api.js'

/**
 * Retrieves the stored worker name from localStorage.
 * @private
 * @returns {string|null}
 */
function getWorkerName() {
  return localStorage.getItem('clawboard_worker_name') || null
}

/**
 * Generates a unique worker name with a random suffix.
 * @private
 * @returns {string}
 */
function generateWorkerName() {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `${WORKER_PREFIX}-${suffix}`
}

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
 * Checks whether a worker URL has been configured in localStorage.
 * @returns {boolean}
 */
export function isWorkerConfigured() {
  return !!localStorage.getItem('worker_url')
}

/**
 * Checks whether the worker was auto-deployed (vs. manually configured).
 * @returns {boolean}
 */
export function isAutoDeployed() {
  return !!localStorage.getItem('clawboard_worker_name')
}

/**
 * Determines whether the deployed worker code is out of date
 * by comparing the stored code hash against the current bundle.
 * @returns {boolean} True if the worker needs redeployment
 */
export function needsUpdate() {
  const storedHash = localStorage.getItem('worker_code_hash')
  if (!storedHash) return isAutoDeployed()
  return storedHash !== hashCode(workerCode)
}

/**
 * Deploys a new worker to Puter: writes the file, creates the worker,
 * generates an API key, and persists all config to localStorage.
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

  // Persist config in Puter KV so credentials survive localStorage clears
  await puter.kv.set('sb_api_key', apiKey)
  await puter.kv.set('sb_worker_url', url)
  await puter.kv.set('sb_worker_name', workerName)
  await puter.kv.set('sb_worker_code_hash', hashCode(workerCode))

  // Save everything to localStorage
  localStorage.setItem('worker_url', url)
  localStorage.setItem('sb_api_key', apiKey)
  localStorage.setItem('clawboard_worker_name', workerName)
  localStorage.setItem('clawboard_version', __APP_VERSION__)
  localStorage.setItem('worker_code_hash', hashCode(workerCode))

  return { url, apiKey }
}

/**
 * Unconditionally loads worker config and theme from puter.kv into
 * localStorage on every startup. Falls back to worker discovery via
 * puter.workers.list() if URL isn't in KV yet. Also backfills KV
 * from localStorage for existing deploys that predate KV storage.
 * @returns {Promise<void>}
 */
export async function hydrateFromKV() {
  if (typeof puter === 'undefined' || !puter.kv) return

  try {
    // Read everything from KV in one batch
    let [url, name, apiKey, theme, codeHash] = await Promise.all([
      puter.kv.get('sb_worker_url'),
      puter.kv.get('sb_worker_name'),
      puter.kv.get('sb_api_key'),
      puter.kv.get('sb_theme'),
      puter.kv.get('sb_worker_code_hash'),
    ])

    // Backfill: if localStorage has values that KV doesn't, push them up
    const localUrl = localStorage.getItem('worker_url')
    const localKey = localStorage.getItem('sb_api_key')
    const localName = localStorage.getItem('clawboard_worker_name')
    const backfills = []
    if (localUrl && !url) { url = localUrl; backfills.push(puter.kv.set('sb_worker_url', localUrl)) }
    if (localKey && !apiKey) { apiKey = localKey; backfills.push(puter.kv.set('sb_api_key', localKey)) }
    if (localName && !name) { name = localName; backfills.push(puter.kv.set('sb_worker_name', localName)) }
    if (backfills.length) await Promise.all(backfills)

    // If URL isn't in KV (pre-existing deploy), discover it from Puter workers API
    if (!url && apiKey) {
      const workers = await puter.workers.list()
      const match = workers.find(w => w.name.startsWith(WORKER_PREFIX))
      if (match) {
        url = match.url
        name = match.name
        await Promise.all([
          puter.kv.set('sb_worker_url', url),
          puter.kv.set('sb_worker_name', name),
        ])
      }
    }

    // Write KV values into localStorage
    if (url) localStorage.setItem('worker_url', url)
    if (apiKey) localStorage.setItem('sb_api_key', apiKey)
    if (name) localStorage.setItem('clawboard_worker_name', name)
    if (theme) localStorage.setItem('theme', theme)
    if (codeHash) localStorage.setItem('worker_code_hash', codeHash)
  } catch {
    // Silently ignore — app will fall through to install modal if not configured
  }
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
  if (!getWorkerName()) throw new Error('No worker name found — cannot update')

  const newHash = hashCode(workerCode)
  const oldHash = localStorage.getItem('worker_code_hash')
  localStorage.setItem('worker_code_hash', newHash)

  try {
    await puter.fs.write(WORKER_FILE, workerCode)
    await puter.kv.set('sb_worker_code_hash', newHash)
    return { url: localStorage.getItem('worker_url') }
  } catch (err) {
    localStorage.setItem('worker_code_hash', oldHash)
    throw err
  }
}
