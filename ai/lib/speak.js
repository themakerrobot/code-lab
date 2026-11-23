// ═══════════════════════════════════════════════════════════
// 목소리 — 브라우저 내장 음성 (Web Speech API · speechSynthesis)
// ═══════════════════════════════════════════════════════════
// 놀이실에서 규칙이 맞으면 정한 말을 소리 내어 읽고, 순서 놀이를 끝내면 "성공!" 이라고 한다.
//
//  · 이 컴퓨터 안에 있는 목소리(voice.localService === true)만 쓴다.
//    크롬의 "Google …" 목소리처럼 인터넷 목소리는 읽을 문장을 서버로 보낸다.
//    "사진·소리는 컴퓨터 밖으로 나가지 않아요" 약속을 지키려고 쓰지 않는다.
//  · 목소리 목록은 늦게 도착한다 (크롬은 voiceschanged 뒤에야 채워진다).
//  · 브라우저는 사용자가 한 번이라도 누른 뒤에야 말하게 해 준다.
//    놀이실은 카메라 켜기·카드 누르기가 먼저라 문제없다.
//  · 맞는 목소리가 없으면 조용히 넘어간다 (화면의 답은 그대로 나온다).

const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
let voices = [];
const listeners = [];

function refresh() {
  voices = synth ? synth.getVoices() : [];
  listeners.forEach(fn => { try { fn(); } catch (e) { /* 무시 */ } });
}
if (synth) {
  refresh();
  if (synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
  else synth.onvoiceschanged = refresh;
}

export function onVoicesChanged(fn) { listeners.push(fn); }

// lang: 'ko' | 'en'. 기기 안 목소리 중 그 언어를 고른다 (기본 목소리 먼저).
export function pickVoice(lang) {
  const want = lang === 'en' ? 'en' : 'ko';
  const local = voices.filter(v => v.localService && String(v.lang || '').toLowerCase().startsWith(want));
  if (!local.length) return null;
  return local.find(v => v.default) || local.find(v => /-(KR|US)$/i.test(v.lang)) || local[0];
}

export function canSpeak(lang) { return !!(synth && pickVoice(lang)); }

// 그 언어의 기기 안 목소리 전부 (AI 목소리 체험에서 고르게)
export function localVoices(lang) {
  const want = lang === 'en' ? 'en' : 'ko';
  return voices.filter(v => v.localService && String(v.lang || '').toLowerCase().startsWith(want));
}

// opts: { voice, rate, pitch, max, onWord(charIndex, len), onEnd() } — 안 주면 예전과 같다
export function speak(text, lang, opts) {
  opts = opts || {};
  if (!synth || !text) return false;
  const v = (opts.voice && opts.voice.localService) ? opts.voice : pickVoice(lang);
  if (!v) return false;
  try {
    synth.cancel();                     // 앞 말이 길어도 지금 말을 바로 한다
    const u = new SpeechSynthesisUtterance(String(text).slice(0, opts.max || 80));
    u.voice = v;
    u.lang = v.lang;
    u.rate = opts.rate || 1.0;
    u.pitch = opts.pitch || 1.15;       // 살짝 밝게
    if (opts.onWord) u.onboundary = e => { if (e.name !== 'sentence') opts.onWord(e.charIndex, e.charLength || 0); };
    if (opts.onEnd) { u.onend = opts.onEnd; u.onerror = opts.onEnd; }
    synth.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

export function stopSpeaking() { try { synth && synth.cancel(); } catch (e) { /* 무시 */ } }

// ── 짧은 효과음 (순서 놀이 한 칸 통과) ──
// 목소리가 없는 기기에서도 들리도록 웹 오디오로 직접 만든다.
let actx = null;
export function ding(high) {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(high ? 1046 : 784, t);   // C6 · G5
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + 0.27);
  } catch (e) { /* 무시 */ }
}
