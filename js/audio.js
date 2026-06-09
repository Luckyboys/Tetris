(function (global) {
    function SoundEngine() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.bgmGain = null;
        this.muted = false;
        this.bgmVolume = 0.18;
        this.sfxVolume = 0.35;
        this.bgmTimer = null;
        this.bgmStep = 0;
        this.bgmPlaying = false;
        this._bgmActiveNotes = [];
    }

    SoundEngine.prototype._ensureCtx = function () {
        if (this.ctx) {
            if (this.ctx.state === "suspended") {
                this.ctx.resume();
            }
            return;
        }
        var Ctor = global.AudioContext || global.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;
        this.sfxGain.connect(this.masterGain);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.bgmVolume;
        this.bgmGain.connect(this.masterGain);
    };

    SoundEngine.prototype._envTone = function (opts) {
        if (!this.ctx) return;
        var ctx = this.ctx;
        var now = ctx.currentTime + (opts.delay || 0);
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = opts.type || "square";
        osc.frequency.setValueAtTime(opts.startFreq, now);
        if (opts.endFreq !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(0.0001, opts.endFreq),
                now + opts.duration
            );
        }
        var peak = opts.peak !== undefined ? opts.peak : 0.4;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

        osc.connect(gain);
        gain.connect(opts.target || this.sfxGain);
        osc.start(now);
        osc.stop(now + opts.duration + 0.02);
    };

    SoundEngine.prototype._noiseBurst = function (opts) {
        if (!this.ctx) return;
        var ctx = this.ctx;
        var now = ctx.currentTime + (opts.delay || 0);
        var duration = opts.duration || 0.18;
        var bufferSize = Math.floor(ctx.sampleRate * duration);
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        var filter = ctx.createBiquadFilter();
        filter.type = opts.filterType || "bandpass";
        filter.frequency.value = opts.filterFreq || 1200;
        filter.Q.value = opts.filterQ || 1.2;
        var gain = ctx.createGain();
        var peak = opts.peak !== undefined ? opts.peak : 0.3;
        gain.gain.setValueAtTime(peak, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(opts.target || this.sfxGain);
        source.start(now);
        source.stop(now + duration + 0.02);
    };

    SoundEngine.prototype.play = function (name) {
        this._ensureCtx();
        if (!this.ctx) return;
        switch (name) {
            case "move":
                this._envTone({ type: "square", startFreq: 320, endFreq: 280, duration: 0.05, peak: 0.18 });
                break;
            case "rotate":
                this._envTone({ type: "triangle", startFreq: 480, endFreq: 720, duration: 0.08, peak: 0.22 });
                break;
            case "land":
                this._envTone({ type: "square", startFreq: 180, endFreq: 90, duration: 0.12, peak: 0.32 });
                this._noiseBurst({ duration: 0.08, filterType: "lowpass", filterFreq: 600, peak: 0.18 });
                break;
            case "hardDrop":
                this._envTone({ type: "sawtooth", startFreq: 600, endFreq: 80, duration: 0.18, peak: 0.35 });
                this._noiseBurst({ duration: 0.16, filterType: "lowpass", filterFreq: 900, peak: 0.28 });
                break;
            case "clear1":
                this._envTone({ type: "square", startFreq: 660, endFreq: 990, duration: 0.18, peak: 0.32 });
                this._envTone({ type: "triangle", startFreq: 880, endFreq: 1320, duration: 0.18, peak: 0.22, delay: 0.02 });
                break;
            case "clear2":
                this._envTone({ type: "square", startFreq: 660, endFreq: 990, duration: 0.22, peak: 0.32 });
                this._envTone({ type: "triangle", startFreq: 880, endFreq: 1320, duration: 0.22, peak: 0.22, delay: 0.04 });
                this._envTone({ type: "square", startFreq: 1180, endFreq: 1580, duration: 0.18, peak: 0.18, delay: 0.1 });
                break;
            case "clear3":
                this._envTone({ type: "sawtooth", startFreq: 520, endFreq: 1040, duration: 0.28, peak: 0.32 });
                this._envTone({ type: "square", startFreq: 880, endFreq: 1320, duration: 0.24, peak: 0.26, delay: 0.05 });
                this._envTone({ type: "triangle", startFreq: 1320, endFreq: 1760, duration: 0.22, peak: 0.22, delay: 0.12 });
                break;
            case "tetris":
                var notes = [523, 659, 784, 1047, 1319, 1568];
                for (var i = 0; i < notes.length; i++) {
                    this._envTone({
                        type: "square",
                        startFreq: notes[i],
                        endFreq: notes[i] * 1.05,
                        duration: 0.18,
                        peak: 0.3,
                        delay: i * 0.06
                    });
                    this._envTone({
                        type: "triangle",
                        startFreq: notes[i] * 2,
                        endFreq: notes[i] * 2.05,
                        duration: 0.16,
                        peak: 0.18,
                        delay: i * 0.06
                    });
                }
                this._noiseBurst({ duration: 0.4, filterType: "highpass", filterFreq: 2000, peak: 0.12, delay: 0.05 });
                break;
            case "levelUp":
                var lu = [523, 659, 784, 1047];
                for (var j = 0; j < lu.length; j++) {
                    this._envTone({
                        type: "triangle",
                        startFreq: lu[j],
                        endFreq: lu[j] * 1.02,
                        duration: 0.14,
                        peak: 0.28,
                        delay: j * 0.07
                    });
                }
                break;
            case "pause":
                this._envTone({ type: "sine", startFreq: 700, endFreq: 500, duration: 0.16, peak: 0.22 });
                break;
            case "resume":
                this._envTone({ type: "sine", startFreq: 500, endFreq: 760, duration: 0.16, peak: 0.22 });
                break;
            case "gameOver":
                this._envTone({ type: "sawtooth", startFreq: 440, endFreq: 220, duration: 0.32, peak: 0.32 });
                this._envTone({ type: "square", startFreq: 330, endFreq: 165, duration: 0.36, peak: 0.26, delay: 0.18 });
                this._envTone({ type: "sawtooth", startFreq: 220, endFreq: 80, duration: 0.6, peak: 0.32, delay: 0.36 });
                this._noiseBurst({ duration: 0.5, filterType: "lowpass", filterFreq: 500, peak: 0.18, delay: 0.2 });
                break;
            case "start":
                var st = [392, 523, 659, 784];
                for (var k = 0; k < st.length; k++) {
                    this._envTone({
                        type: "square",
                        startFreq: st[k],
                        endFreq: st[k],
                        duration: 0.1,
                        peak: 0.28,
                        delay: k * 0.05
                    });
                }
                break;
        }
    };

    SoundEngine.prototype.startBGM = function () {
        this._ensureCtx();
        if (!this.ctx) return;
        if (this.bgmPlaying) return;

        var self = this;
        if (this.ctx.state === "suspended") {
            var resumePromise = this.ctx.resume();
            if (resumePromise && typeof resumePromise.then === "function") {
                resumePromise.then(function () {
                    if (!self.bgmPlaying) self._startBGMNow();
                });
                return;
            }
        }
        this._startBGMNow();
    };

    SoundEngine.prototype._startBGMNow = function () {
        if (!this.ctx) return;
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;

        var REST = 0;
        var A1 = 55.00, B1 = 61.74;
        var C2 = 65.41, Cs2 = 69.30, D2 = 73.42, Ds2 = 77.78, E2 = 82.41, F2 = 87.31, Fs2 = 92.50, G2 = 98.00, Gs2 = 103.83, A2 = 110.00, B2 = 123.47;
        var C3 = 130.81, Cs3 = 138.59, D3 = 146.83, Ds3 = 155.56, E3 = 164.81, F3 = 174.61, Fs3 = 185.00, G3 = 196.00, Gs3 = 207.65, A3 = 220.00, B3 = 246.94;
        var C4 = 261.63, Cs4 = 277.18, D4 = 293.66, Ds4 = 311.13, E4 = 329.63, F4 = 349.23, Fs4 = 369.99, G4 = 392.00, Gs4 = 415.30, A4 = 440.00, B4 = 493.88;
        var C5 = 523.25, Cs5 = 554.37, D5 = 587.33, Ds5 = 622.25, E5 = 659.25, F5 = 698.46, Fs5 = 739.99, G5 = 783.99, Gs5 = 830.61, A5 = 880.00, B5 = 987.77;
        var C6 = 1046.50;

        var melody = [
            [E5, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [C5, 0.5], [B4, 0.5],   // m2  E
            [A4, 1], [A4, 0.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],   // m3  Am
            [B4, 1.5], [C5, 0.5], [D5, 1], [E5, 1],                         // m4  E/G#
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m5  Am

            [REST, 0.5], [D5, 1], [F5, 0.5], [A5, 1], [G5, 0.5], [F5, 0.5], // m6  Dm
            [E5, 1.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],            // m7  C
            [B4, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [E5, 1],                // m8  E/B
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m9  Am

            [E5, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [C5, 0.5], [B4, 0.5],   // m10 E （Part.1）
            [A4, 1], [A4, 0.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],   // m11 Am
            [B4, 1.5], [C5, 0.5], [D5, 1], [E5, 1],                         // m12 E/G#
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m13 Am

            [REST, 0.5], [D5, 1], [F5, 0.5], [A5, 1], [G5, 0.5], [F5, 0.5], // m14 Dm
            [E5, 1.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],            // m15 C
            [B4, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [E5, 1],                // m16 E
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m17 Am

            [E5, 2], [C5, 2],   // m18 E/G# (双音 G#3+B4)
            [D5, 2], [B4, 2],   // m19 Am   (双音 A3+C5)  原谱: E/G# - Am 交替
            [C5, 2], [A4, 2],   // m20 E/G#
            [Gs4, 2], [B4, 2],  // m21 Am

            [E5, 2], [C5, 2],          // m22 E/G#
            [D5, 2], [B4, 2],          // m23 Am
            [C5, 1], [E5, 1], [A5, 1], [A5, 1], // m24 E (上行连接)
            [Gs5, 4],                   // m25 E (三和弦延音 G#4+D#5+B4，此处用 G#5 作高音线)

            [E5, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [C5, 0.5], [B4, 0.5], // m26 E
            [A4, 1], [A4, 0.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5], // m27 Am
            [B4, 1.5], [C5, 0.5], [D5, 1], [E5, 1],                       // m28 E/G#
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                         // m29 Am

            [REST, 0.5], [D5, 1], [F5, 0.5], [A5, 1], [G5, 0.5], [F5, 0.5], // m30 Dm
            [E5, 1.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],            // m31 C
            [B4, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [E5, 1],                // m32 E
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m33 Am (半终止)

            [E5, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [C5, 0.5], [B4, 0.5],   // m10 E （Part.2）
            [A4, 1], [A4, 0.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],   // m11 Am
            [B4, 1.5], [C5, 0.5], [D5, 1], [E5, 1],                         // m12 E/G#
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m13 Am

            [REST, 0.5], [D5, 1], [F5, 0.5], [A5, 1], [G5, 0.5], [F5, 0.5], // m14 Dm
            [E5, 1.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],            // m15 C
            [B4, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [E5, 1],                // m16 E
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m17 Am

            [E5, 2], [C5, 2],   // m18 E/G# (双音 G#3+B4)
            [D5, 2], [B4, 2],   // m19 Am   (双音 A3+C5)  原谱: E/G# - Am 交替
            [C5, 0.5], [Gs4, 0.5], [A4, 0.5], [B4, 0.5], [C5, 0.5], [D5, 0.5], [E5, 0.5], [F5, 0.5],  // m20 E/G#
            [E5, 2], [B4, 2],  // m21 Am

            [E5, 2], [C5, 2],          // m22 E/G#
            [D5, 2], [B4, 2],          // m23 Am
            [C5, 1], [E5, 1], [A5, 1], [A5, 1], // m24 E (上行连接)
            [Gs5, 4],                   // m25 E (三和弦延音 G#4+D#5+B4，此处用 G#5 作高音线)

            [E5, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [C5, 0.5], [B4, 0.5], // m26 E
            [A4, 1], [A4, 0.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5], // m27 Am
            [B4, 1.5], [C5, 0.5], [D5, 1], [E5, 1],                       // m28 E/G#
            [C5, 1], [A4, 1], [A4, 1], [REST, 1],                         // m29 Am

            [REST, 0.5], [D5, 1], [F5, 0.5], [A5, 1], [G5, 0.5], [F5, 0.5], // m30 Dm
            [E5, 1.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],            // m31 C
            [B4, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [E5, 1],                // m32 E
            [C5, 1], [A4, 1], [A4, 1], [REST, 1]                            // m33 Am (终止)
        ];

        var harmory = [
            // [E5, 1], [B4, 0.5], [C5, 0.5], [D5, 1], [C5, 0.5], [B4, 0.5],   // m2  E
            [REST, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [A4, 0.5], [Gs4, 0.5], // m2
            // [A4, 1], [A4, 0.5], [C5, 0.5], [E5, 1], [D5, 0.5], [C5, 0.5],   // m3  Am
            [E4, 1], [E4, 0.5], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m3
            // [B4, 1.5], [C5, 0.5], [D5, 1], [E5, 1],                         // m4  E/G#
            [Gs4, 1.5], [A4, 0.5], [B4, 1], [C5, 1], // m4
            // [C5, 1], [A4, 1], [A4, 1], [REST, 1],                           // m5  Am
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m5

            [REST, 0.5], [F4, 1], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m6
            [G4, 1.5], [E4, 0.5], [G4, 1], [F4, 0.5], [E4, 0.5], // m7
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [C5, 1], // m8
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m9

            // [REST, 1], [Gs4, 0.5], [REST, 1.5], [A4, 0.5], [Gs4, 0.5], // m10（part.1）
            [C5, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [A4, 0.5], [Gs4, 0.5], // m10
            // [E4, 1], [REST, 3], // m11
            [E4, 1], [E4, 0.5], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m11
            // [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [REST, 1], // m12
            [Gs4, 1.5], [A4, 0.5], [B4, 1], [C5, 1], // m12
            // [REST, 4], // m13
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m13

            [REST, 0.5], [F4, 1], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m14
            [G4, 1.5], [E4, 0.5], [G4, 1], [F4, 0.5], [E4, 0.5], // m15
            // [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [REST, 1], // m16
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [C5, 1], // m16
            // [REST, 4], // m17
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m17

            [C4, 2], [A3, 2], // m18
            [B3, 2], [Gs3, 2], // m19
            [A3, 2], [E3, 2], // m20
            [Gs3, 2], [D3, 2], // m21

            [C4, 2], [A3, 2], // m22
            [B3, 2], [Gs3, 2], // m23
            [A3, 1], [C4, 1], [E4, 1], [A4, 1],//m24
            [E4, 4], // m25

            [C5, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [A4, 0.5], [Gs4, 0.5], // m26
            [E4, 1], [E4, 0.5], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m27
            [Gs4, 1.5], [A4, 0.5], [B4, 1],  [C5, 1], // m28
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m29

            [REST, 0.5], [F4, 1], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m30
            [G4, 1.5], [E4, 0.5], [G4, 1], [F4, 0.5], [E4, 0.5], // m31
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [C5, 1], // m32
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m33（半终止）

            [REST, 1], [Gs4, 0.5], [REST, 1.5], [A4, 0.5], [Gs4, 0.5], // m10
            [E4, 1], [REST, 3], // m11
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [REST, 1], // m12
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m13

            [REST, 0.5], [F4, 1], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m14
            [G4, 1.5], [E4, 0.5], [G4, 1], [F4, 0.5], [E4, 0.5], // m15
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [REST, 1], // m16
            [A4, 1], [E4, 1], [E4, 1], [REST, 1], // m17

            [C5, 2], [A4, 2], // m18
            [B4, 2], [Gs4, 2], // m19
            // [C5, 0.5], [Gs4, 0.5], [A4, 0.5], [B4, 0.5], [C5, 0.5], [D5, 0.5], [E5, 0.5], [F5, 0.5], ,   // m20 E/G#
            [A4, 0.5], [E4, 0.5], [F4, 0.5], [Gs4, 0.5], [A4, 0.5], [B4, 0.5], [C5, 0.5], [D5, 0.5], // m20
            // [E5, 2], [B4, 2],  // m21 Am
            [B4, 2], [E4, 2], // m21

            [C4, 2], [A3, 2], // m22
            [B3, 2], [Gs3, 2], // m23
            [A3, 1], [C4, 1], [E4, 1], [E4, 1],//m24
            [E4, 4], // m25

            [REST, 1], [Gs4, 0.5], [REST, 1.5], [A4, 0.5], [Gs4, 0.5], // m26
            [E4, 1], [REST, 3], // m27
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [REST, 1], // m28
            [REST, 4], // m29

            [REST, 0.5], [F4, 1], [A4, 0.5], [C5, 1], [B4, 0.5], [A4, 0.5], // m30
            [G4, 1.5], [E4, 0.5], [G4, 1], [F4, 0.5], [E4, 0.5], // m31
            [Gs4, 1], [Gs4, 0.5], [A4, 0.5], [B4, 1], [REST, 1], // m32
            [REST, 4] // m33（终止）
        ];

        var bass = [
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m2  E
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5],     // m3  Am
            [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], // m4  E/G#
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [B2, 0.5], [C3, 0.5],     // m5  Am

            [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5],     // m6  Dm
            [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5],     // m7  C
            [B1, 0.5], [B2, 0.5], [B1, 0.5], [B2, 0.5], [B1, 0.5], [B2, 0.5], [B1, 0.5], [B2, 0.5],   // m8  E/B
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5],     // m9  Am

            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m10 E    (Part.1)
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5],     // m11 Am
            [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], // m12 E/G#
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [B2, 0.5], [C3, 0.5],     // m13 Am

            [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5],     // m14 Dm
            [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5],     // m15 C
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m16 E
            [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],     // m17 Am

            [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5],     // m18 Am
            [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], // m19 E/G#
            [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5],     // m20 Am
            [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], // m21 E/G#

            [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5],     // m22 Am
            [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], // m23 E/G#
            [A2, 0.5], [E3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],     // m24 Am
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m25 E

            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m26 E
            [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],     // m27 Am
            [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], // m28 E/G#
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [B2, 0.5], [C3, 0.5],     // m29 Am

            [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5],     // m30 Dm
            [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5],     // m31 C
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m32 E
            [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],      // m33 Am (半终止)

            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m10 E    (Part.2)
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5],     // m11 Am
            [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], // m12 E/G#
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [B2, 0.5], [C3, 0.5],     // m13 Am

            [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5],     // m14 Dm
            [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5],     // m15 C
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m16 E
            [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],     // m17 Am

            [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5],     // m18 Am
            [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], // m19 E/G#
            [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5],     // m20 Am
            [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], // m21 E/G#

            [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5], [A2, 0.5], [E3, 0.5],     // m22 Am
            [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], [Gs2, 0.5], [E3, 0.5], // m23 E/G#
            [A2, 0.5], [E3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],     // m24 Am
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m25 E

            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m26 E
            [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5],     // m27 Am
            [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], [Gs2, 0.5], [Gs3, 0.5], // m28 E/G#
            [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [A1, 0.5], [A2, 0.5], [B2, 0.5], [C3, 0.5],     // m29 Am

            [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5], [D2, 0.5], [D3, 0.5],     // m30 Dm
            [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5], [C2, 0.5], [C3, 0.5],     // m31 C
            [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5], [E2, 0.5], [E3, 0.5],     // m32 E
            [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5], [A2, 0.5], [A3, 0.5]      // m33 Am (终止)
        ];

        var bpm = this.bgmBpm || 100;
        var beat = 60 / bpm;

        var loopDuration = 0;
        for (var m = 0; m < melody.length; m++) {
            loopDuration += melody[m][1] * beat;
        }

        this._bgmMelody = melody;
        this._bgmHarmory = harmory;
        this._bgmBass = bass;
        this._bgmBeat = beat;
        this._bgmLoopDuration = loopDuration;
        this._bgmNextStart = this.ctx.currentTime + 0.1;

        this._scheduleBGMLoop();
    };

    SoundEngine.prototype._scheduleBGMLoop = function () {
        if (!this.bgmPlaying || !this.ctx) return;
        var ctx = this.ctx;
        var melody = this._bgmMelody;
        var harmory = this._bgmHarmory;
        var bass = this._bgmBass;
        var beat = this._bgmBeat;
        var loopDuration = this._bgmLoopDuration;
        var startTime = this._bgmNextStart;

        var t = startTime;
        for (var i = 0; i < melody.length; i++) {
            var freq = melody[i][0];
            var dur = melody[i][1] * beat;
            if (freq > 0) {
                this._bgmNote(freq, t, dur * 0.95, "square", 0.18);
            }
            t += dur;
        }
        var ht = startTime;
        for (var i = 0; i < harmory.length; i++) {
            var freq = harmory[i][0];
            var dur = harmory[i][1] * beat;
            if (freq > 0) {
                this._bgmNote(freq, ht, dur * 0.95, "sawtooth", 0.18);
            }
            ht += dur;
        }
        var bt = startTime;
        for (var b = 0; b < bass.length; b++) {
            var bf = bass[b][0];
            var bd = bass[b][1] * beat;
            if (bf > 0) {
                this._bgmNote(bf, bt, bd * 0.9, "triangle", 0.22);
            }
            bt += bd;
        }

        this._bgmNextStart = startTime + loopDuration;

        var aheadMs = 250;
        var msUntilNext = (this._bgmNextStart - ctx.currentTime) * 1000 - aheadMs;
        if (msUntilNext < 30) msUntilNext = 30;

        var self = this;
        this.bgmTimer = setTimeout(function () {
            self._scheduleBGMLoop();
        }, msUntilNext);
    };

    SoundEngine.prototype._bgmNote = function (freq, absStartTime, duration, type, peak) {
        if (!this.ctx) return;
        var ctx = this.ctx;
        var now = absStartTime;
        if (now < ctx.currentTime + 0.005) {
            now = ctx.currentTime + 0.005;
        }
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        var sustainEnd = now + duration * 0.85;
        var releaseEnd = now + duration;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
        gain.gain.setValueAtTime(peak, sustainEnd);
        gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(now);
        osc.stop(releaseEnd + 0.02);

        var self = this;
        var entry = { osc: osc, gain: gain };
        this._bgmActiveNotes.push(entry);
        osc.onended = function () {
            var idx = self._bgmActiveNotes.indexOf(entry);
            if (idx !== -1) self._bgmActiveNotes.splice(idx, 1);
        };
    };

    SoundEngine.prototype.stopBGM = function () {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
        if (!this.ctx) {
            this._bgmActiveNotes = [];
            return;
        }
        var now = this.ctx.currentTime;
        var notes = this._bgmActiveNotes;
        this._bgmActiveNotes = [];
        for (var i = 0; i < notes.length; i++) {
            var n = notes[i];
            try {
                n.gain.gain.cancelScheduledValues(now);
                n.gain.gain.setTargetAtTime(0, now, 0.005);
            } catch (e) { }
            try {
                n.osc.stop(now + 0.05);
            } catch (e) { }
        }
    };

    SoundEngine.prototype.setBGMBpm = function (bpm) {
        bpm = Math.max(60, Math.min(180, bpm | 0));
        if (this.bgmBpm === bpm) return;
        this.bgmBpm = bpm;
        if (!this.bgmPlaying) return;
        var beat = 60 / bpm;
        this._bgmBeat = beat;
        var loopDuration = 0;
        for (var m = 0; m < this._bgmMelody.length; m++) {
            loopDuration += this._bgmMelody[m][1] * beat;
        }
        this._bgmLoopDuration = loopDuration;
    };

    SoundEngine.prototype.setMuted = function (muted) {
        this.muted = muted;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
        }
    };

    SoundEngine.prototype.toggleMute = function () {
        this.setMuted(!this.muted);
        return this.muted;
    };

    global.SoundEngine = SoundEngine;
})(window);
