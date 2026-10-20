import net, { type Server, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createLiveBoardTransport, encodeLiveBoardCommand, LiveBoardTransportError } from '../../../electron/main/liveboard/transport'

const servers: Server[] = []
const transports: ReturnType<typeof createLiveBoardTransport>[] = []
afterEach(() => {
  for (const transport of transports.splice(0)) transport.disconnect()
  for (const server of servers.splice(0)) server.close()
})

describe('LiveBoard transport', () => {
  it('encodes LF terminated commands with escaped arguments and UTF-8 content', () => {
    const command = encodeLiveBoardCommand('LBC_SETTEMPLATEOBJECTVALUE', 'titlu "nou"', 'field\\name', 'Bună\nziua\t🙂')
    expect(command).toBe('LBC_SETTEMPLATEOBJECTVALUE "titlu \\"nou\\"", "field\\\\name", "Bună\\nziua\\t🙂"\n')
    expect(Buffer.byteLength(command, 'utf8')).toBeGreaterThan(command.length)
    expect(() => encodeLiveBoardCommand('LBC_PLAYCONTENT', 'bad\0value')).toThrow(/control/)
    expect(() => encodeLiveBoardCommand('PLAYCONTENT', 'headline')).toThrow(/Unsupported/)
    expect(() => encodeLiveBoardCommand('LBC_SETTEMPLATEOBJECTVALUE', 'one')).toThrow(/requires 3/)
    expect(() => encodeLiveBoardCommand('LBC_SETTEMPLATEOBJECTVALUE', 'T', 'F', '\\'.repeat(32760))).toThrow(/65536-byte limit/)
  })

  it('simulates commands without opening a socket or claiming acknowledgement', async () => {
    const transport = createLiveBoardTransport({ mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 5000 })
    transports.push(transport)
    await transport.connect()
    await expect(transport.play('headline')).resolves.toMatchObject({ command: 'LBC_PLAYCONTENT "headline"\n', response: 'SIMULATED OK', acknowledged: false })
  })

  it('handles fragmented welcome and coalesced sequential command replies', async () => {
    const sockets: Socket[] = []
    const server = net.createServer(socket => {
      socket.on('error', () => undefined)
      sockets.push(socket)
      socket.write('Wel')
      setTimeout(() => socket.write('come LiveBoard\r\n'), 5)
      let incoming = ''
      socket.on('data', chunk => {
        incoming += chunk.toString()
        while (incoming.includes('\n')) {
          const i = incoming.indexOf('\n'); incoming = incoming.slice(i + 1)
          socket.write('OK\r\n\n')
        }
      })
    })
    const port = await listen(server)
    const transport = createLiveBoardTransport({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 500 })
    transports.push(transport)
    await transport.connect()
    const first = transport.play('A')
    const second = transport.resume('B')
    await expect(first).resolves.toMatchObject({ command: 'LBC_PLAYCONTENT "A"\n', acknowledged: true })
    await expect(second).resolves.toMatchObject({ command: 'LBC_RESUMECONTENT "B"\n', acknowledged: true })
    expect(sockets).toHaveLength(1)
  })

  it('rejects LiveBoard Error replies', async () => {
    const server = net.createServer(socket => { socket.on('error', () => undefined); socket.write('Welcome LiveBoard\n'); socket.on('data', () => socket.write('Error bad field\n')) })
    const port = await listen(server)
    const transport = createLiveBoardTransport({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 300 })
    transports.push(transport)
    await transport.connect()
    await expect(transport.setField('T', 'F', 'V')).rejects.toMatchObject({ message: 'Error bad field', sent: true })
  })

  it('times out without assigning a late response to a later command', async () => {
    const server = net.createServer(socket => { socket.on('error', () => undefined); socket.write('Welcome LiveBoard\n'); socket.on('data', () => setTimeout(() => socket.write('OK\n'), 100)) })
    const port = await listen(server)
    const transport = createLiveBoardTransport({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 50 })
    transports.push(transport)
    await transport.connect()
    await expect(transport.play('T')).rejects.toBeInstanceOf(LiveBoardTransportError)
    expect(transport.getSnapshot().status).toBe('error')
    await expect(transport.stop('T')).rejects.toMatchObject({ sent: false })
  })

  it('does not assign an extra coalesced OK to the next queued command', async () => {
    let received = 0
    const server = net.createServer(socket => {
      socket.on('error', () => undefined)
      socket.write('Welcome LiveBoard\n')
      socket.on('data', () => { received += 1; socket.write('OK\nOK\n') })
    })
    const port = await listen(server)
    const transport = createLiveBoardTransport({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 300 })
    transports.push(transport)
    await transport.connect()
    const first = transport.play('A')
    const second = transport.stop('B')
    await expect(first).resolves.toMatchObject({ acknowledged: true })
    await expect(second).rejects.toMatchObject({ sent: false, message: expect.stringMatching(/Unexpected LiveBoard response/) })
    expect(received).toBe(1)
  })

  it('resets decoder state and ignores close callbacks from an old socket after reconnect', async () => {
    let connections = 0
    const server = net.createServer(socket => {
      socket.on('error', () => undefined)
      connections += 1
      socket.write(connections === 1 ? 'Welcome LiveBoard\nstale' : 'Welcome LiveBoard\n')
      if (connections > 1) socket.on('data', () => socket.write('OK\n'))
    })
    const port = await listen(server)
    const transport = createLiveBoardTransport({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 300 })
    transports.push(transport)
    await transport.connect()
    await new Promise(resolve => setTimeout(resolve, 10))
    transport.disconnect()
    await transport.connect()
    await expect(transport.play('fresh')).resolves.toMatchObject({ acknowledged: true })
    expect(connections).toBe(2)
    expect(transport.getSnapshot().status).toBe('connected')
  })

  it('marks socket errors after a write as uncertain and caps the pending queue', async () => {
    const server = net.createServer(socket => {
      socket.on('error', () => undefined)
      socket.write('Welcome LiveBoard\n')
      socket.on('data', () => socket.destroy())
    })
    const port = await listen(server)
    const transport = createLiveBoardTransport({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 300 })
    transports.push(transport)
    await transport.connect()
    await expect(transport.play('T')).rejects.toMatchObject({ sent: true })

    // A new explicit connect is allowed after the transport has failed.
    await transport.connect()
    const queued = Array.from({ length: 100 }, (_, index) => transport.play(`Q${index}`).catch(error => error))
    await expect(transport.stop('overflow')).rejects.toMatchObject({ sent: false, message: expect.stringMatching(/queue is full/) })
    transport.disconnect()
    await Promise.all(queued)
  })
})

function listen(server: Server): Promise<number> {
  servers.push(server)
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port)) })
}
