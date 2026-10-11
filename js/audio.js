// Music: the menu theme loops in every menu (title, settings, journal from settings, level select) and fades
// out when cooking, judging or a cutscene starts. It starts over from the top each time you come back.
//
// audio/menu-theme.flac is exactly one loop: 21.573 s (8 bars at 89 BPM), 951,369 samples at 44.1 kHz. It was
// cut from the composer's MP3, which carries ~24 ms of encoder padding at the start that browsers don't strip
// (it has no gapless header), so looping the MP3 at 21.573 s would land early. FLAC has no padding: every browser
// decodes this file to the same exact samples, and looping the whole buffer is seamless.
const MUSIC_VOLUME = 0.7, MUSIC_FADE = 0.6;   // seconds to fade out
const Music = {
  ctx: null, buf: null, play: null,

  // Decode up front (an offline context needs no permission), so it's ready the moment sound is allowed.
  load() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    fetch('audio/menu-theme.flac').then((r) => r.arrayBuffer())
      .then((b) => new OAC(2, 44100, 44100).decodeAudioData(b))
      .then((buf) => { this.buf = buf; }).catch(() => {});
  },
  // Browsers only allow sound after the player clicks or presses a key: called from those handlers.
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx && AC) this.ctx = new AC();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  // Called every frame with whether the menu theme should be playing.
  update(want) {
    if (!this.ctx || !this.buf || this.ctx.state !== 'running') return;
    if (want && !this.play) {
      const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      src.buffer = this.buf; src.loop = true;   // the whole buffer is the loop
      gain.gain.value = MUSIC_VOLUME;
      src.connect(gain); gain.connect(this.ctx.destination); src.start();
      this.play = { src, gain };
    } else if (!want && this.play) {
      const { src, gain } = this.play, now = this.ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now); gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE);
      src.stop(now + MUSIC_FADE + 0.05);
      this.play = null;
    }
  },
};
Music.load();
