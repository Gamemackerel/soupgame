// Music.
//   Menus: the menu theme loops in every menu (title, settings, journal from settings, level select) and fades out
//   when cooking, judging or a cutscene starts. It starts over from the top each time you come back.
//   Kitchen: track 5 plays as soon as you start cooking, then now and then a random one of the short tracks,
//   just to add a little life. Most of the time it's quiet.
// The music volume (a slider in Settings) is saved per browser.
//
// audio/menu-theme.flac is exactly one loop: 21.573 s (8 bars at 89 BPM), 951,369 samples at 44.1 kHz. It was
// cut from the composer's MP3, which carries ~24 ms of encoder padding at the start that browsers don't strip
// (it has no gapless header), so looping the MP3 at 21.573 s would land early. FLAC has no padding: every browser
// decodes this file to the same exact samples, and looping the whole buffer is seamless.
const MUSIC_FADE = 0.6;   // seconds to fade out
const KITCHEN_TRACKS = ['audio/kitchen-2.mp3', 'audio/kitchen-3.mp3', 'audio/kitchen-4.mp3', 'audio/kitchen-5.mp3'];
const KITCHEN_GAP = [45, 110];   // seconds of quiet between kitchen tracks
const KITCHEN_OPENER = 3;        // track 5 always plays first when you start cooking
const SETTINGS_KEY = 'soupgame.settings.v1';

const Music = {
  ctx: null, theme: null, tracks: [], play: null, sting: null, nextSting: null, lastSting: -1, opener: false,
  volume: 0.7,

  // Decode up front (an offline context needs no permission), so it's ready the moment sound is allowed.
  load() {
    try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); if (typeof s.music === 'number') this.volume = s.music; } catch (e) {}
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    const decode = (url) => fetch(url).then((r) => r.arrayBuffer()).then((b) => new OAC(2, 44100, 44100).decodeAudioData(b));
    decode('audio/menu-theme.flac').then((buf) => { this.theme = buf; }).catch(() => {});
    KITCHEN_TRACKS.forEach((url, n) => decode(url).then((buf) => { this.tracks[n] = buf; }).catch(() => {}));
  },
  // Browsers only allow sound after the player clicks or presses a key: called from those handlers.
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx && AC) this.ctx = new AC();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    for (const p of [this.play, this.sting]) if (p && !p.fading) p.gain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: this.volume })); } catch (e) {}
  },
  start(buf, loop) {
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    src.buffer = buf; src.loop = loop;   // looping: the whole buffer is the loop
    gain.gain.value = this.volume;
    src.connect(gain); gain.connect(this.ctx.destination); src.start();
    return { src, gain, ends: loop ? Infinity : this.ctx.currentTime + buf.duration };
  },
  fade(p) {
    const now = this.ctx.currentTime;
    p.fading = true;
    p.gain.gain.setValueAtTime(p.gain.gain.value, now); p.gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE);
    p.src.stop(now + MUSIC_FADE + 0.05);
  },
  // Called every frame with where the player is: 'menu', 'kitchen' or neither.
  update(where) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, rand = ([a, b]) => a + Math.random() * (b - a);
    // The menu theme.
    if (where === 'menu' && !this.play && this.theme) this.play = this.start(this.theme, true);
    else if (where !== 'menu' && this.play) { this.fade(this.play); this.play = null; }
    // Kitchen tracks: the opener right away (as the menu theme finishes fading), then quiet for a while between
    // random tracks.
    if (where !== 'kitchen') {
      if (this.sting) { this.fade(this.sting); this.sting = null; }
      this.nextSting = null;
      return;
    }
    if (this.sting && now >= this.sting.ends) { this.sting = null; this.nextSting = now + rand(KITCHEN_GAP); }
    if (this.nextSting === null) { this.nextSting = now + MUSIC_FADE; this.opener = true; }
    if (!this.sting && now >= this.nextSting) {
      if (this.opener) {
        if (!this.tracks[KITCHEN_OPENER]) return;   // (still loading)
        this.opener = false; this.lastSting = KITCHEN_OPENER;
      } else {
        const ready = this.tracks.map((b, n) => (b ? n : -1)).filter((n) => n >= 0 && n !== this.lastSting);
        if (!ready.length) return;
        this.lastSting = ready[(Math.random() * ready.length) | 0];   // never the same one twice in a row
      }
      this.sting = this.start(this.tracks[this.lastSting], false);
    }
  },
};
Music.load();
