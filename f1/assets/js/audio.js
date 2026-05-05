// --- AUDIO RENDSZER ---
let audioCtx, engineOsc, engineGain;
var globalVolume = 1.0;

function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
}

function updateAudio(speed, rpm) {
    if (!audioCtx) return;
    let absSpeed = Math.abs(speed);
    let freq = 100 + (rpm * 500);
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);

    let baseVol = absSpeed > 1 ? 0.02 : 0.005;
    engineGain.gain.setTargetAtTime(baseVol * globalVolume, audioCtx.currentTime, 0.1);
}

function stopEngineSound() {
    if (engineGain && audioCtx) {
        engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    }
}

function playCrashSound() {
    if (!audioCtx || globalVolume === 0) return;

    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);

    let crashVol = Math.max(0.0001, 0.05 * globalVolume);
    gain.gain.setValueAtTime(crashVol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);

    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function playCountdownTone(freq, duration = 180) {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2 * globalVolume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration / 1000);
}

function playStartSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 400;
    gain.gain.setValueAtTime(0.22 * globalVolume, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(950, audioCtx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    osc.stop(audioCtx.currentTime + 0.25);
}

function playLapFinishSound() {
    if (!audioCtx) initAudio();
    const chordFreqs = [440, 550, 660];
    const now = audioCtx.currentTime;
    chordFreqs.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08 * globalVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.02);
        osc.stop(now + 0.28);
    });
}

function playFastestLapSound() {
    if (!audioCtx) initAudio();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const now = audioCtx.currentTime;
    notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12 * globalVolume, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.1 + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.1);
        osc.stop(now + index * 0.1 + 0.15);
    });
}
