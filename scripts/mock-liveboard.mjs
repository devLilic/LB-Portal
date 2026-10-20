import net from 'node:net'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
const port = Number(option('--port') ?? 9010)
const delay = Number(option('--response-delay') ?? 0)
const failMatch = option('--fail-match')
const failAfter = Number(option('--fail-after') ?? 0)
let matchingCommandsSeen = 0
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(delay) || delay < 0 || !Number.isInteger(failAfter) || failAfter < 0) throw new Error('Invalid mock server options.')

function decode(line) {
  const match = line.match(/^(LBC_[A-Z]+)(?:\s+(.*))?$/)
  if (!match) return null
  const arity = { LBC_PLAYCONTENT: 1, LBC_RESUMECONTENT: 1, LBC_STOPCONTENT: 1, LBC_SETTEMPLATEOBJECTVALUE: 3 }[match[1]]
  if (!arity) return null
  const values = []
  let input = match[2] ?? ''
  while (input.length) {
    const part = input.match(/^\s*"((?:\\.|[^"\\])*)"/)
    if (!part) return null
    values.push(part[1].replace(/\\([\\"nrt])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] ?? c)))
    input = input.slice(part[0].length)
    if (values.length < arity) {
      const separator = input.match(/^\s*,\s*/)
      if (!separator) return null
      input = input.slice(separator[0].length)
    }
  }
  if (values.length !== arity) return null
  return { command: match[1], values }
}

const sockets = new Set()
const server = net.createServer(socket => {
  sockets.add(socket)
  socket.on('close', () => sockets.delete(socket))
  socket.on('error', () => undefined)
  socket.setEncoding('utf8')
  socket.write('Welcome to LiveBoard mock\n')
  let buffer = ''
  const timers = new Set()
  socket.on('close', () => { for (const timer of timers) clearTimeout(timer); timers.clear() })
  socket.on('data', chunk => {
    buffer += chunk
    if (Buffer.byteLength(buffer, 'utf8') > 65536) { socket.destroy(); return }
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '')
      buffer = buffer.slice(index + 1)
      const parsed = decode(line)
      console.log(parsed ? JSON.stringify(parsed) : `Invalid command: ${line}`)
      const timer = setTimeout(() => {
        timers.delete(timer)
        const matchesFailure = !!failMatch && line.includes(failMatch)
        if (matchesFailure) matchingCommandsSeen += 1
        const shouldFail = matchesFailure && matchingCommandsSeen > failAfter
        if (!socket.destroyed) socket.write(!parsed ? 'Error invalid command\n' : shouldFail ? 'Error simulated failure\n' : 'OK\n')
      }, delay)
      timers.add(timer)
    }
  })
})
server.listen(port, '127.0.0.1', () => console.log(`LiveBoard mock listening on 127.0.0.1:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const socket of sockets) socket.destroy()
  server.close(() => process.exit(0))
})
