import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9379;
const OUT = resolve(process.cwd(), 'tools', 'shots');
const PROFILE = resolve(process.cwd(), 'tools', 'edge-profile-input4');
const URL = pathToFileURL(resolve(process.cwd(), 'index.html')).href;
mkdirSync(OUT, { recursive: true });
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
  '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1280,720', 'about:blank',
], { detached: true, stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitEndpoint() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('no cdp');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.exceptions = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.exceptions.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 15000);
    });
  }
}
const evalJS = async (cdp, expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};
const shot = async (cdp, name) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(OUT, name + '.png'), Buffer.from(data, 'base64'));
};
const keyDown = (cdp, code, key, vk) => cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
const keyUp = (cdp, code, key, vk) => cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
const tap = async (cdp, code, key, vk, ms = 70) => { await keyDown(cdp, code, key, vk); await sleep(ms); await keyUp(cdp, code, key, vk); };

let pass = 0, fail = 0;
function check(name, ok, info = '') {
  if (ok) { pass++; console.log('PASS', name, info); }
  else { fail++; console.log('FAIL', name, info); }
}

await waitEndpoint();
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const cdp = new CDP(ws);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: URL });
await sleep(2200);

check('boots to title', await evalJS(cdp, `__NF.state === 'title' && !document.getElementById('startBtn').disabled`));
await shot(cdp, 'v_title');

await tap(cdp, 'Enter', 'Enter', 13);
await sleep(1400);
check('starts in play', await evalJS(cdp, `__NF.state === 'play' && __NF.player.hp === 3`));
await shot(cdp, 'v_start');

// movement
const x0 = await evalJS(cdp, `__NF.player.x`);
await keyDown(cdp, 'KeyD', 'd', 68); await sleep(900); await keyUp(cdp, 'KeyD', 'd', 68); await sleep(150);
const x1 = await evalJS(cdp, `__NF.player.x`);
check('runs right', x1 > x0 + 60, `${Math.round(x0)} -> ${Math.round(x1)}`);

// jump
await keyDown(cdp, 'Space', ' ', 32); await sleep(140);
const jumped = await evalJS(cdp, `__NF.player.y`);
await shot(cdp, 'v_jump');
await keyUp(cdp, 'Space', ' ', 32); await sleep(800);
const landed = await evalJS(cdp, `__NF.player.y`);
check('jumps', jumped < 420, `y=${Math.round(jumped)}`);
check('lands', Math.abs(landed - 432) < 3, `y=${Math.round(landed)}`);

// very quick tap (8ms) must still register thanks to event-side buffering
await keyDown(cdp, 'Space', ' ', 32); await sleep(8); await keyUp(cdp, 'Space', ' ', 32);
await sleep(220);
const quickJump = await evalJS(cdp, `__NF.player.y`);
check('quick tap jumps', quickJump < 405, `y=${Math.round(quickJump)}`);
await sleep(900);

// dash direction follows a newly pressed direction
await evalJS(cdp, `__NF.start()`);
await sleep(500);
await keyDown(cdp, 'KeyD', 'd', 68); await sleep(140); await keyUp(cdp, 'KeyD', 'd', 68);
await keyDown(cdp, 'KeyA', 'a', 65);
await keyDown(cdp, 'ShiftLeft', 'Shift', 16);
await sleep(40);
await keyUp(cdp, 'ShiftLeft', 'Shift', 16);
await keyUp(cdp, 'KeyA', 'a', 65);
await sleep(80);
const dashDir = await evalJS(cdp, `({f: __NF.player.facing, vx: Math.round(__NF.player.vx)})`);
check('dash follows input direction', dashDir.f === -1 && dashDir.vx < -100, JSON.stringify(dashDir));
await sleep(500);

// double jump
await keyDown(cdp, 'Space', ' ', 32); await sleep(90); await keyUp(cdp, 'Space', ' ', 32);
await sleep(120);
await keyDown(cdp, 'Space', ' ', 32); await sleep(90); await keyUp(cdp, 'Space', ' ', 32);
await sleep(80);
const air = await evalJS(cdp, `({aj: __NF.player.airJumps, vy: __NF.player.vy, y: __NF.player.y})`);
check('double jump consumes air charge', air.aj === 0, JSON.stringify(air));
await sleep(1100);

// dash (fresh run so we are definitely grounded)
await evalJS(cdp, `__NF.start()`);
await sleep(500);
const dx0 = await evalJS(cdp, `__NF.player.x`);
await tap(cdp, 'ShiftLeft', 'Shift', 16, 60);
await sleep(60);
const dashV = await evalJS(cdp, `Math.abs(__NF.player.vx)`);
const dashing = await evalJS(cdp, `__NF.player.dashT > 0 || __NF.player.dashCd > 0`);
check('dash bursts', dashV > 200 && dashing, `vx=${Math.round(dashV)}`);
await sleep(500);

// core pickup
await evalJS(cdp, `__NF.start()`);
await sleep(500);
await evalJS(cdp, `__NF.teleport(472, 320)`);
await sleep(500);
check('collects a core', await evalJS(cdp, `__NF.cores === 1`), `cores=${await evalJS(cdp, `__NF.cores`)}`);
await shot(cdp, 'v_core');

// quick tap attack (8ms) + attack animation screenshot
await keyDown(cdp, 'KeyJ', 'j', 74); await sleep(8); await keyUp(cdp, 'KeyJ', 'j', 74);
await sleep(80);
check('quick tap attacks', await evalJS(cdp, `__NF.player.attackT > 0`));
await shot(cdp, 'v_attack');
await sleep(300);

// attack actually kills a patrol drone (2 hits)
await evalJS(cdp, `__NF.start()`);
await sleep(450);
await evalJS(cdp, `__NF.teleport(730, 370)`);
await sleep(80);
await tap(cdp, 'KeyJ', 'j', 74, 60);
await sleep(180);
const enemyHp1 = await evalJS(cdp, `__NF.level.enemies[0].hp`);
const dronePos = await evalJS(cdp, `({x: __NF.level.enemies[0].x, y: __NF.level.enemies[0].y})`);
await evalJS(cdp, `__NF.teleport(${dronePos.x - 26}, ${dronePos.y + 8})`);
await sleep(60);
await tap(cdp, 'KeyJ', 'j', 74, 60);
await sleep(250);
const droneDead = await evalJS(cdp, `__NF.level.enemies[0].alive === false`);
check('slash damages drone', enemyHp1 === 1, `hp=${enemyHp1}`);
check('two slashes kill drone', droneDead === true);
await shot(cdp, 'v_attack_hit');

// enemy contact damage
await evalJS(cdp, `__NF.start()`);
await sleep(450);
await evalJS(cdp, `__NF.teleport(__NF.level.enemies[0].x, __NF.level.enemies[0].y + 12)`);
await sleep(350);
const hpAfterEnemy = await evalJS(cdp, `__NF.player.hp`);
check('enemy contact hurts', hpAfterEnemy === 2, `hp=${hpAfterEnemy}`);

// spikes
await evalJS(cdp, `__NF.start()`);
await sleep(450);
await evalJS(cdp, `__NF.teleport(2360, 400)`);
await sleep(350);
const hpAfterSpikes = await evalJS(cdp, `__NF.player.hp`);
check('spikes hurt', hpAfterSpikes === 2, `hp=${hpAfterSpikes}`);

// checkpoint + respawn
await evalJS(cdp, `__NF.start()`);
await sleep(450);
await evalJS(cdp, `__NF.teleport(2248, 400)`);
await sleep(600);
await evalJS(cdp, `__NF.teleport(2248, 800)`);
await sleep(2300);
const resp = await evalJS(cdp, `({state: __NF.state, x: Math.round(__NF.player.x), y: Math.round(__NF.player.y), hp: __NF.player.hp})`);
check('respawns at checkpoint', resp.state === 'play' && Math.abs(resp.x - 2248) < 4 && resp.hp === 3, JSON.stringify(resp));
await shot(cdp, 'v_respawn');

// gate locked
await evalJS(cdp, `__NF.start()`);
await sleep(450);
await evalJS(cdp, `__NF.teleport(3150, 384)`);
await sleep(700);
const locked = await evalJS(cdp, `({open: __NF.level.gate.open, cores: __NF.cores})`);
check('gate stays locked without cores', locked.open === false, JSON.stringify(locked));
await shot(cdp, 'v_gate_closed');

// gate opens
await evalJS(cdp, `__NF.setCores(3)`);
await sleep(700);
const opened = await evalJS(cdp, `({open: __NF.level.gate.open, t: __NF.level.gate.openT})`);
check('gate opens with 3 cores', opened.open === true, JSON.stringify(opened));
await shot(cdp, 'v_gate_open');
await sleep(900);

// ending
await evalJS(cdp, `__NF.teleport(3290, 384)`);
await sleep(1300);
check('reaches ending', await evalJS(cdp, `__NF.state === 'end' && !document.getElementById('ending').classList.contains('hidden')`));
await shot(cdp, 'v_ending');

// pause
await evalJS(cdp, `__NF.start()`);
await sleep(500);
await tap(cdp, 'Escape', 'Escape', 27, 60);
await sleep(450);
check('pause toggles', await evalJS(cdp, `__NF.state === 'pause'`));
await shot(cdp, 'v_pause');
await tap(cdp, 'Escape', 'Escape', 27, 60);
await sleep(250);
check('resumes', await evalJS(cdp, `__NF.state === 'play'`));

const exceptions = cdp.exceptions.slice(0, 8);
check('no runtime exceptions', exceptions.length === 0, exceptions.join(' | '));

console.log(`\nRESULT ${pass} passed, ${fail} failed`);
ws.close();
try { process.kill(edge.pid); } catch {}
await sleep(300);
process.exit(fail ? 1 : 0);





