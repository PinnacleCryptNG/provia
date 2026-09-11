import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const extraViteArgs = process.argv.slice(2)
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))

const server = spawn(process.execPath, ['--experimental-strip-types', 'server/index.ts'], {
  stdio: 'inherit',
  env: process.env,
})

const client = spawn(process.execPath, [viteBin, ...extraViteArgs], {
  stdio: 'inherit',
  env: process.env,
})

function shutdown() {
  if (!server.killed) {
    server.kill('SIGTERM')
  }
  if (!client.killed) {
    client.kill('SIGTERM')
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.on('exit', (code) => {
  if (!client.killed) {
    client.kill('SIGTERM')
  }
  if (code) {
    process.exitCode = code
  }
})

client.on('exit', (code) => {
  if (!server.killed) {
    server.kill('SIGTERM')
  }
  if (code) {
    process.exitCode = code
  }
})
