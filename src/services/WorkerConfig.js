/**
 * @module WorkerConfig
 * In-memory config store for worker-related settings, backed by Puter KV.
 * All worker config reads come from this module (no localStorage).
 */

const WORKER_PREFIX = 'clawboard-api'

/** KV key → config field mapping */
const KV_KEYS = {
  sb_worker_url: 'workerUrl',
  sb_api_key: 'apiKey',
  sb_worker_name: 'workerName',
  sb_worker_code_hash: 'codeHash',
}

/** In-memory cache */
let config = {
  workerUrl: null,
  apiKey: null,
  workerName: null,
  codeHash: null,
}

/**
 * Normalizes a puter.kv.get() return value to a plain string.
 * @param {*} v
 * @returns {string|null}
 */
function kvString(v) {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.value != null) return String(v.value)
  return String(v)
}

/**
 * Loads all worker config from Puter KV into memory.
 * Falls back to worker discovery via puter.workers.list() if URL isn't in KV.
 * @returns {Promise<void>}
 */
export async function loadFromKV() {
  if (typeof puter === 'undefined' || !puter.kv) return

  try {
    const [url, name, apiKey, codeHash] = (await Promise.all([
      puter.kv.get('sb_worker_url'),
      puter.kv.get('sb_worker_name'),
      puter.kv.get('sb_api_key'),
      puter.kv.get('sb_worker_code_hash'),
    ])).map(kvString)

    config.workerUrl = url
    config.workerName = name
    config.apiKey = apiKey
    config.codeHash = codeHash

    // Discover worker if URL or name is missing (covers partial KV state)
    if ((!config.workerUrl || !config.workerName) && config.apiKey) {
      const workers = await puter.workers.list()
      const match = workers.find(w => w.name.startsWith(WORKER_PREFIX))
      if (match) {
        config.workerUrl = match.url
        config.workerName = match.name
        await Promise.all([
          puter.kv.set('sb_worker_url', match.url),
          puter.kv.set('sb_worker_name', match.name),
        ])
      }
    }
  } catch (e) {
    console.warn('[WorkerConfig] KV load failed:', e?.message || e)
  }
}

/** @returns {string|null} */
export function getWorkerUrl() { return config.workerUrl }

/** @returns {string|null} */
export function getApiKey() { return config.apiKey }

/** @returns {string|null} */
export function getWorkerName() { return config.workerName }

/** @returns {string|null} */
export function getCodeHash() { return config.codeHash }

/** @returns {boolean} */
export function isWorkerConfigured() { return !!config.workerUrl }

/** @returns {boolean} */
export function isAutoDeployed() { return !!config.workerName }

/**
 * Updates a single config value in memory and persists to KV.
 * @param {string} field - Config field name (workerUrl, apiKey, workerName, codeHash)
 * @param {string|null} value
 * @returns {Promise<void>}
 */
export async function set(field, value) {
  config[field] = value
  const kvKey = Object.entries(KV_KEYS).find(([, f]) => f === field)?.[0]
  if (kvKey && typeof puter !== 'undefined' && puter.kv) {
    await puter.kv.set(kvKey, value)
  }
}

/**
 * Updates multiple config values in memory and persists all to KV.
 * @param {Object} values - Object with config field names as keys
 * @returns {Promise<void>}
 */
export async function setAll(values) {
  const kvWrites = []
  for (const [field, value] of Object.entries(values)) {
    config[field] = value
    const kvKey = Object.entries(KV_KEYS).find(([, f]) => f === field)?.[0]
    if (kvKey && typeof puter !== 'undefined' && puter.kv) {
      kvWrites.push(puter.kv.set(kvKey, value))
    }
  }
  if (kvWrites.length) await Promise.all(kvWrites)
}

/**
 * Clears all worker config from memory and KV.
 * @returns {Promise<void>}
 */
export async function clearAll() {
  config = { workerUrl: null, apiKey: null, workerName: null, codeHash: null }
  if (typeof puter !== 'undefined' && puter.kv) {
    await Promise.all(Object.keys(KV_KEYS).map(k => puter.kv.del(k)))
  }
}
