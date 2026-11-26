import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const project = 'cateringhub-e2e-' + randomUUID().slice(0, 8)
const windows = process.platform === 'win32'
const servers = []

async function reservePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server
}

const listeners = await Promise.all(Array.from({ length: 7 }, reservePort))
const [postgres, rabbitmq, management, orders, inventory, fulfillment, web] = listeners.map(
  (server) => server.address().port,
)
const servicePorts = { orders, inventory, fulfillment }
await Promise.all(listeners.map((server) => new Promise((resolve) => server.close(resolve))))
const origin = (port) => 'http://127.0.0.1:' + port
const secret = () => randomBytes(32).toString('hex')
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PORT: String(postgres),
  RABBITMQ_HOST: '127.0.0.1',
  RABBITMQ_PORT: String(rabbitmq),
  RABBITMQ_MANAGEMENT_PORT: String(management),
  RABBITMQ_NODE_HOSTNAME: 'rabbitmq',
  RABBITMQ_VHOST: 'cateringhub',
  RABBITMQ_USER: 'cateringhub',
  RABBITMQ_PASSWORD: secret(),
  POSTGRES_ADMIN_PASSWORD: secret(),
  ORDERS_DB_PASSWORD: secret(),
  INVENTORY_DB_PASSWORD: secret(),
  FULFILLMENT_DB_PASSWORD: secret(),
  DJANGO_SECRET_KEY: secret(),
  JWT_SIGNING_KEY: secret(),
  DJANGO_DEBUG: 'true',
  DJANGO_ALLOWED_HOSTS: 'localhost,127.0.0.1,testserver',
  COOKIE_SECURE: 'false',
  CSRF_TRUSTED_ORIGINS: origin(web),
  ORDER_CUTOFF_HOUR: '18',
  ORDERS_API_URL: origin(orders),
  CATERINGHUB_ORDERS_ORIGIN: origin(orders),
  CATERINGHUB_INVENTORY_ORIGIN: origin(inventory),
  CATERINGHUB_FULFILLMENT_ORIGIN: origin(fulfillment),
  CATERINGHUB_E2E_URL: origin(web),
}

function start(command, args, options = {}) {
  return spawn(command, args, { cwd: root, env, stdio: 'inherit', ...options })
}

async function run(command, args) {
  const [code, signal] = await once(start(command, args), 'exit')
  if (code !== 0) throw new Error(command + ' zakończono z kodem ' + (code ?? signal))
}

const compose = (...args) =>
  run('docker', ['compose', '-p', project, '--env-file', '.env.example', ...args])
const pythonArgs = (service, ...args) => [
  'run',
  '--project',
  'backend',
  '--locked',
  '--no-sync',
  '--env-file',
  '.env.example',
  '--package',
  'cateringhub-' + service,
  'python',
  ...args,
]
const manageArgs = (service, ...args) =>
  pythonArgs(service, 'backend/services/' + service + '/manage.py', ...args)

function startServer(command, args) {
  const child = start(command, args, { detached: !windows })
  child.on('error', (error) => console.error(error.message))
  servers.push(child)
}

async function waitForServices() {
  const endpoints = [
    origin(web),
    ...Object.entries(servicePorts).map(
      ([service, port]) => origin(port) + '/api/' + service + '/v1/health/',
    ),
  ]
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (
      interrupted ||
      servers.some((child) => !child.pid || child.exitCode !== null || child.signalCode)
    ) {
      throw new Error('Proces aplikacji zakończył się podczas startu.')
    }
    const ready = await Promise.all(
      endpoints.map(async (url) => {
        try {
          return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok
        } catch {
          return false
        }
      }),
    )
    if (ready.every(Boolean)) return
    await delay(300)
  }
  throw new Error('Aplikacja nie jest gotowa do testów.')
}

async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode) return
  if (windows) {
    await once(
      start('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }),
      'exit',
    )
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
}

let interrupted = false
let playwright
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    interrupted = true
    if (playwright) void stop(playwright)
  })
}

try {
  await compose('up', '-d', '--wait')
  for (const service of Object.keys(servicePorts)) {
    await run('uv', manageArgs(service, 'migrate', '--noinput'))
    if (service !== 'fulfillment') await run('uv', manageArgs(service, 'seed_demo'))
    if (process.argv.includes('--backend')) {
      await run('uv', manageArgs(service, 'check'))
      await run('uv', manageArgs(service, 'makemigrations', '--check', '--dry-run'))
      await run(
        'uv',
        pythonArgs(
          service,
          '-m',
          'pytest',
          '-c',
          'backend/services/' + service + '/pyproject.toml',
          'backend/services/' + service + '/tests',
        ),
      )
    }
  }
  // Keep pending messages on disk while replacing the broker container.
  await run('uv', manageArgs('orders', 'publish_events', '--once'))
  await compose('up', '-d', '--wait', '--force-recreate', 'rabbitmq')
  for (const [service, port] of Object.entries(servicePorts)) {
    const settings = service === 'orders' ? ['--settings=e2e_settings'] : []
    startServer(
      'uv',
      manageArgs(service, 'runserver', '127.0.0.1:' + port, '--noreload', ...settings),
    )
    startServer('uv', manageArgs(service, 'publish_events', '--consume'))
  }
  startServer(process.execPath, [
    'frontend/node_modules/vite/bin/vite.js',
    'frontend',
    '--host',
    '127.0.0.1',
    '--port',
    String(web),
    '--strictPort',
  ])
  await waitForServices()
  playwright = start(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
    cwd: fileURLToPath(new URL('../frontend/', import.meta.url)),
    detached: !windows,
  })
  const [code] = await once(playwright, 'exit')
  process.exitCode = interrupted ? 130 : (code ?? 1)
} finally {
  try {
    await Promise.all(servers.map(stop))
  } finally {
    await compose('down', '--volumes')
  }
}
