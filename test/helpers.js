import WebSocket from 'ws';

/** Minimal WebSocket client that remembers the latest view and lets tests await conditions. */
export class TestClient {
  constructor(ws) {
    this.ws = ws;
    this.view = null;
    this.errors = [];
    this.messages = [];
    this.identity = null;
    this.closedReason = null;
    this.waiters = new Set();
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      this.messages.push(msg);
      if (msg.t === 'welcome') {
        this.identity = { code: msg.code, playerId: msg.playerId, token: msg.token };
        this.view = msg.view;
      } else if (msg.t === 'state') {
        this.view = msg.view;
      } else if (msg.t === 'error') {
        this.errors.push(msg);
      } else if (msg.t === 'closed') {
        this.closedReason = msg.reason;
      }
      for (const w of [...this.waiters]) w();
    });
  }

  static connect(port, { origin, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, origin || Object.keys(headers).length ? { headers: { ...(origin ? { Origin: origin } : {}), ...headers } } : undefined);
      ws.once('open', () => resolve(new TestClient(ws)));
      ws.once('error', reject);
      ws.once('unexpected-response', (_req, res) => reject(Object.assign(new Error('rejected'), { status: res.statusCode })));
    });
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws.close();
  }

  /** Resolves once `check(client)` is truthy; re-evaluated on every incoming message. */
  until(check, label = 'condition', timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const test = () => {
        let ok = false;
        try {
          ok = check(this);
        } catch {
          ok = false;
        }
        if (ok) {
          this.waiters.delete(test);
          clearTimeout(timer);
          resolve(this);
        }
      };
      const timer = setTimeout(() => {
        this.waiters.delete(test);
        reject(new Error(`Timed out waiting for ${label}. Last view: ${JSON.stringify(this.view)?.slice(0, 400)} errors: ${JSON.stringify(this.errors)}`));
      }, timeoutMs);
      this.waiters.add(test);
      test();
    });
  }

  phase(name, timeoutMs) {
    return this.until((c) => c.view?.phase === name, `phase ${name}`, timeoutMs);
  }

  error(code) {
    return this.until((c) => c.errors.some((e) => e.code === code), `error ${code}`);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
