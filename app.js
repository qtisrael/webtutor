/**
 * Grammar In Use - Hands-Free British Audio Shadowing Engine
 * Audio-first native audio player + Web Speech STT (en-GB) + Web Audio Synthesizer
 */

// --- GLOBAL STATE ---
let currentChapter = 1;
let currentUnitFilter = 'all';
let allChapterData = {};
for (let i = 1; i <= 16; i++) {
    allChapterData[i] = [];
}
let filteredItems = [];
let currentIndex = 0;

// Progress stats
const completedSet = new Set();
const scoresMap = new Map();

// Theme state ('light' default)
let currentTheme = localStorage.getItem('giu_theme') || 'light';

// Hands-free master loop state
let isHandsFreeActive = false;
let handsFreeStep = 'idle'; // 'playing_native' | 'chime' | 'listening' | 'evaluating' | 'waiting_next'
let currentRetryCount = 0;
const MAX_RETRIES = 2;

// Audio & Playback state
let nativeAudio = null;
let currentSpeed = 1.0;
let playbackAnimFrame = null;

// Speech Recognition & Visualizer
let recognition = null;
let isRecording = false;
let audioContext = null;
let micStream = null;
let silenceTimer = null;
let visualizerCanvas = null;
let canvasCtx = null;
let analyserNode = null;
let visualizerAnimFrame = null;

// Audio files
const AUDIO_SOURCES = {};
for (let i = 1; i <= 16; i++) {
    AUDIO_SOURCES[i] = `audio/chapter${i}.m4a`;
}

// Chapter Titles
const CHAPTER_TITLES = {
    1: "Chapter 1: Present & Past Tenses (현재 및 과거 시제)",
    2: "Chapter 2: Present Perfect & Past (현재완료 및 과거완료)",
    3: "Chapter 3: Future Forms (미래 표현 - will, going to)",
    4: "Chapter 4: Modals (조동사 - can, could, must, should)",
    5: "Chapter 5: Conditionals & Wish (조건문 및 가정법)",
    6: "Chapter 6: Passive Voice (수동태)",
    7: "Chapter 7: Reported Speech (간접 화법)",
    8: "Chapter 8: Questions & Auxiliary Verbs (의문문 및 조동사)",
    9: "Chapter 9: -ing & to-infinitive (동명사와 부정사)",
    10: "Chapter 10: Articles & Nouns (관사 및 명사)",
    11: "Chapter 11: Pronouns & Determiners (대명사와 한정사)",
    12: "Chapter 12: Relative Clauses (관계사절)",
    13: "Chapter 13: Adjectives & Adverbs (형용사와 부사, 비교급)",
    14: "Chapter 14: Conjunctions & Prepositions (접속사와 전치사)",
    15: "Chapter 15: Prepositions of Time & Place (시간/장소 전치사)",
    16: "Chapter 16: Phrasal Verbs (구동사 / 이어동사)"
};

// --- DOM ELEMENTS ---
const elements = {
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    themeText: document.getElementById('theme-text'),
    statCompleted: document.getElementById('stat-completed'),
    statAverage: document.getElementById('stat-average'),

    chapterChips: document.querySelectorAll('#chapter-button-group .chapter-chip'),
    activeChapterTitle: document.getElementById('active-chapter-title'),
    unitSelect: document.getElementById('unit-select'),
    stopOffsetSelect: document.getElementById('stop-offset-select'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    itemCounter: document.getElementById('item-counter'),

    // Hands-Free Master Bar
    btnMasterHandsfree: document.getElementById('btn-master-handsfree'),
    masterIcon: document.getElementById('master-icon'),
    masterText: document.getElementById('master-text'),
    handsfreeStepText: document.getElementById('handsfree-step-text'),

    // Visualizer Card
    unitTag: document.getElementById('unit-tag'),
    sentenceId: document.getElementById('sentence-id'),
    audioTimingBadge: document.getElementById('audio-timing-badge'),
    visualizerCanvas: document.getElementById('visualizer-canvas'),
    audioPlayingIndicator: document.getElementById('audio-playing-indicator'),
    micListeningIndicator: document.getElementById('mic-listening-indicator'),

    btnReplayAudio: document.getElementById('btn-replay-audio'),
    btnManualRecord: document.getElementById('btn-manual-record'),
    btnMockTest: document.getElementById('btn-mock-test'),
    speedButtons: document.querySelectorAll('.speed-toggle-group .btn-speed'),

    // Prompt Card
    englishSentence: document.getElementById('english-sentence'),
    koreanSentence: document.getElementById('korean-sentence'),

    // Evaluation Card
    transcriptContent: document.getElementById('transcript-content'),
    evalScoreBadge: document.getElementById('eval-score-badge'),
    scoreVal: document.getElementById('score-val'),
    diffChipsContainer: document.getElementById('diff-chips-container'),
    feedbackRow: document.getElementById('feedback-row'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackMsg: document.getElementById('feedback-msg'),
    autoNextBarWrapper: document.getElementById('auto-next-bar-wrapper'),
    countdownNumber: document.getElementById('countdown-number'),
    autoNextFill: document.getElementById('auto-next-fill'),

    // Footer
    footerStatusText: document.getElementById('footer-status-text')
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initAudioElement();
    initVisualizerCanvas();
    initSpeechRecognition();
    setupEventListeners();
    await loadCurriculum();
    populateUnitDropdown();
    applyFilter();
    updateStatistics();
});

// --- THEME MANAGEMENT (Light by default) ---
function initTheme() {
    applyTheme(currentTheme);
}

function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('giu_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    if (elements.themeIcon && elements.themeText) {
        if (theme === 'dark') {
            elements.themeIcon.textContent = '🌙';
            elements.themeText.textContent = '다크';
        } else {
            elements.themeIcon.textContent = '☀️';
            elements.themeText.textContent = '라이트';
        }
    }
    drawIdleWaveform();
}

function toggleTheme() {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
}

// --- AUDIO ELEMENT INIT ---
function initAudioElement() {
    nativeAudio = document.getElementById('native-audio');
    nativeAudio.src = AUDIO_SOURCES[currentChapter];
    nativeAudio.playbackRate = currentSpeed;

    nativeAudio.addEventListener('error', (e) => {
        console.warn('Native audio load notice:', e);
    });
}

// --- WEB AUDIO API & SYNTHESIZER CHIMES ---
function getAudioContext() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

// Pleasant Synthesizer Chimes (Zero external sound file dependencies)
function playToneChime(type) {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        if (type === 'startSpeak') {
            // Gentle two-tone chime: E5 (659Hz) -> A5 (880Hz)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.36);

        } else if (type === 'success') {
            // Cheerful major arpeggio: C5 -> E5 -> G5 -> C6
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + idx * 0.08;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.001, startTime);
                gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.28);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.29);
            });

        } else if (type === 'retry') {
            // Warm gentle low tone: A4 -> F#4
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(369.99, now + 0.2);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.33);
        }
    } catch (err) {
        console.warn('Chime playback error:', err);
    }
}

// --- CANVAS AUDIO WAVEFORM VISUALIZER ---
function initVisualizerCanvas() {
    visualizerCanvas = elements.visualizerCanvas;
    canvasCtx = visualizerCanvas.getContext('2d');
    drawIdleWaveform();
}

function drawIdleWaveform() {
    if (!canvasCtx || !visualizerCanvas) return;
    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;

    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, h / 2);
    canvasCtx.lineTo(w, h / 2);
    canvasCtx.stroke();
}

function startVisualizerAnimation(isMic = false) {
    stopVisualizerAnimation();

    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;
    let phase = 0;

    const render = () => {
        canvasCtx.clearRect(0, 0, w, h);

        const barCount = 48;
        const barWidth = w / barCount - 3;
        let color = '#4f46e5';
        if (isMic) {
            color = currentTheme === 'dark' ? '#ef4444' : '#dc2626';
        } else {
            color = currentTheme === 'dark' ? '#818cf8' : '#4f46e5';
        }

        canvasCtx.fillStyle = color;

        for (let i = 0; i < barCount; i++) {
            const freq = Math.sin(phase + i * 0.25) * 0.5 + 0.5;
            const barHeight = Math.max(4, freq * (h * 0.7));
            const x = i * (barWidth + 3);
            const y = (h - barHeight) / 2;

            canvasCtx.beginPath();
            canvasCtx.roundRect(x, y, barWidth, barHeight, 3);
            canvasCtx.fill();
        }

        phase += 0.12;
        visualizerAnimFrame = requestAnimationFrame(render);
    };

    render();
}

function stopVisualizerAnimation() {
    if (visualizerAnimFrame) {
        cancelAnimationFrame(visualizerAnimFrame);
        visualizerAnimFrame = null;
    }
    drawIdleWaveform();
}

// --- DATA LOADER ---
async function loadCurriculum() {
    if (window.GRAMMAR_CHAPTERS) {
        let totalCount = 0;
        for (let i = 1; i <= 16; i++) {
            allChapterData[i] = window.GRAMMAR_CHAPTERS[`chapter${i}`] || [];
            totalCount += allChapterData[i].length;
        }
        console.log(`Loaded ${totalCount} items across all 16 chapters from window.GRAMMAR_CHAPTERS.`);
        return;
    }

    try {
        const fetchPromises = [];
        for (let i = 1; i <= 16; i++) {
            fetchPromises.push(
                fetch(`data/chapter${i}.json`).then(r => r.ok ? r.json() : []).catch(() => [])
            );
        }
        const results = await Promise.all(fetchPromises);
        results.forEach((data, idx) => {
            allChapterData[idx + 1] = data;
        });
    } catch (err) {
        console.warn('Could not load curriculum JSON:', err);
    }
}

function populateUnitDropdown() {
    const items = allChapterData[currentChapter] || [];
    const unitsMap = new Map();

    items.forEach(item => {
        if (!unitsMap.has(item.unit)) {
            unitsMap.set(item.unit, item.unitTitle);
        }
    });

    elements.unitSelect.innerHTML = '<option value="all">전체 유닛 보기 (All Units)</option>';
    unitsMap.forEach((title, unitNum) => {
        const opt = document.createElement('option');
        opt.value = unitNum;
        opt.textContent = title;
        elements.unitSelect.appendChild(opt);
    });
}

function applyFilter() {
    const chapterItems = allChapterData[currentChapter] || [];
    if (currentUnitFilter === 'all') {
        filteredItems = [...chapterItems];
    } else {
        const uNum = parseInt(currentUnitFilter, 10);
        filteredItems = chapterItems.filter(item => item.unit === uNum);
    }

    currentIndex = 0;
    renderCurrentItem();
}

function renderCurrentItem() {
    cancelPendingTimers();

    if (filteredItems.length === 0) {
        elements.englishSentence.textContent = "조건에 일치하는 문장이 없습니다.";
        elements.koreanSentence.textContent = "";
        elements.itemCounter.textContent = "0 / 0";
        elements.btnPrev.disabled = true;
        elements.btnNext.disabled = true;
        return;
    }

    const item = filteredItems[currentIndex];

    elements.itemCounter.textContent = `${currentIndex + 1} / ${filteredItems.length}`;
    elements.btnPrev.disabled = (currentIndex === 0);
    elements.btnNext.disabled = (currentIndex === filteredItems.length - 1);

    elements.unitTag.textContent = item.unitTitle;
    elements.sentenceId.textContent = item.id;
    elements.englishSentence.textContent = item.english;
    elements.koreanSentence.textContent = item.korean;

    const fmt = (sec) => {
        const m = Math.floor(sec / 60);
        const s = (sec % 60).toFixed(1);
        return `${m.toString().padStart(2, '0')}:${s.padStart(4, '0')}`;
    };
    elements.audioTimingBadge.textContent = `⏱️ ${fmt(item.startTime)} ~ ${fmt(item.endTime)} (${item.duration}s)`;

    resetEvaluationView();
}

function resetEvaluationView() {
    elements.transcriptContent.textContent = "(원어민 음성을 듣고 말씀해보세요)";
    elements.transcriptContent.style.color = "var(--text-muted)";
    elements.transcriptContent.style.fontStyle = "italic";
    elements.diffChipsContainer.innerHTML = "";
    elements.scoreVal.textContent = "0.0%";
    elements.evalScoreBadge.className = "eval-score-badge";
    elements.feedbackIcon.textContent = "💡";
    elements.feedbackMsg.textContent = "[핸즈프리 자동 학습 시작]을 누르면 원어민 발음 청취부터 채점, 다음 문장까지 무한 자동 순환됩니다.";
    elements.autoNextBarWrapper.classList.add('hidden');
}

function selectChapter(chNum) {
    currentChapter = chNum;
    currentUnitFilter = 'all';

    // Update chip active classes and scroll into view
    if (elements.chapterChips) {
        elements.chapterChips.forEach(chip => {
            const num = parseInt(chip.dataset.chapter, 10);
            if (num === chNum) {
                chip.classList.add('active');
                chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // Update active banner
    if (elements.activeChapterTitle) {
        elements.activeChapterTitle.textContent = CHAPTER_TITLES[chNum] || `Chapter ${chNum}`;
    }

    // Switch audio source
    if (nativeAudio) {
        nativeAudio.src = AUDIO_SOURCES[currentChapter];
        nativeAudio.load();
    }

    populateUnitDropdown();
    applyFilter();
}

// --- PRECISION NATIVE AUDIO SEGMENT PLAYBACK ---
function playCurrentSentenceAudio(onFinished) {
    if (filteredItems.length === 0 || !nativeAudio) return;
    const item = filteredItems[currentIndex];

    stopAudioPlayback();

    // Check stop safety gap
    const stopOffset = parseFloat(elements.stopOffsetSelect.value) || 0.35;
    const effectiveEndTime = Math.max(item.startTime + 0.6, item.endTime - stopOffset);

    nativeAudio.currentTime = item.startTime;
    nativeAudio.playbackRate = currentSpeed;

    elements.audioPlayingIndicator.classList.remove('hidden');
    elements.micListeningIndicator.classList.add('hidden');
    startVisualizerAnimation(false);

    nativeAudio.play().then(() => {
        // High-frequency requestAnimationFrame watcher to stop cleanly before the next sentence starts
        const checkTime = () => {
            if (!nativeAudio || nativeAudio.paused) {
                stopAudioPlayback();
                return;
            }

            if (nativeAudio.currentTime >= effectiveEndTime) {
                nativeAudio.pause();
                stopAudioPlayback();
                if (typeof onFinished === 'function') {
                    onFinished();
                }
                return;
            }

            playbackAnimFrame = requestAnimationFrame(checkTime);
        };

        playbackAnimFrame = requestAnimationFrame(checkTime);
    }).catch(err => {
        console.warn('Audio play request error:', err);
        stopAudioPlayback();
        if (typeof onFinished === 'function') {
            onFinished();
        }
    });
}

function stopAudioPlayback() {
    if (playbackAnimFrame) {
        cancelAnimationFrame(playbackAnimFrame);
        playbackAnimFrame = null;
    }
    if (nativeAudio && !nativeAudio.paused) {
        nativeAudio.pause();
    }
    elements.audioPlayingIndicator.classList.add('hidden');
    stopVisualizerAnimation();
}

// --- SPEECH RECOGNITION (British en-GB) ---
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('SpeechRecognition API not available.');
        setMasterStatus('⚠️ 브라우저 음성 인식을 지원하지 않습니다 (Chrome/Edge 권장).');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-GB';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        elements.micListeningIndicator.classList.remove('hidden');
        elements.audioPlayingIndicator.classList.add('hidden');
        startVisualizerAnimation(true);
        setMasterStatus('🎙️ 귀 기울여 듣고 있습니다... 따라 말씀하세요!');
    };

    recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += transcript;
            } else {
                interim += transcript;
            }
        }

        if (final) {
            elements.transcriptContent.textContent = final;
            elements.transcriptContent.style.color = "var(--text-white)";
            elements.transcriptContent.style.fontStyle = "normal";
            evaluateSubmission(final);
        } else if (interim) {
            elements.transcriptContent.textContent = interim + " ...";
            elements.transcriptContent.style.color = "var(--text-sub)";

            // Silence timer reset: if user stops speaking for 1.2s, auto-trigger evaluation
            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                if (isRecording && interim.trim()) {
                    stopRecording();
                    elements.transcriptContent.textContent = interim;
                    evaluateSubmission(interim);
                }
            }, 1200);
        }
    };

    recognition.onspeechend = () => {
        // Speech ended, wait a tiny moment then stop
        setTimeout(() => {
            if (isRecording) {
                stopRecording();
            }
        }, 300);
    };

    recognition.onerror = (event) => {
        console.warn('SpeechRecognition notice:', event.error);
        stopRecording();
        if (event.error === 'not-allowed') {
            alert('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
            stopHandsFreeMaster();
        } else if (event.error === 'no-speech') {
            handleNoSpeechDetected();
        }
    };

    recognition.onend = () => {
        stopRecording();
    };
}

function startRecording() {
    if (!recognition) return;
    if (isRecording) return;

    try {
        recognition.lang = 'en-GB';
        recognition.start();
    } catch (e) {
        console.warn('Recognition start exception:', e);
    }
}

function stopRecording() {
    isRecording = false;
    clearTimeout(silenceTimer);
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }
    elements.micListeningIndicator.classList.add('hidden');
    stopVisualizerAnimation();
}

// --- EVALUATION LOGIC ---
function normalizeText(text) {
    if (!text) return "";
    return text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function levenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    const d = [];

    for (let i = 0; i <= len1; i++) d[i] = [i];
    for (let j = 0; j <= len2; j++) d[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost
            );
        }
    }
    return d[len1][len2];
}

function evaluateSubmission(userTranscript) {
    if (filteredItems.length === 0) return;
    const item = filteredItems[currentIndex];

    const normUser = normalizeText(userTranscript);
    const normTarget = normalizeText(item.english);

    const maxLen = Math.max(normUser.length, normTarget.length);
    let similarity = 0;
    if (maxLen > 0) {
        const dist = levenshteinDistance(normUser, normTarget);
        similarity = Math.max(0, (1 - dist / maxLen) * 100);
    } else {
        similarity = 100;
    }

    renderWordDiffChips(normUser, normTarget);
    elements.scoreVal.textContent = `${similarity.toFixed(1)}%`;

    const isPassed = similarity >= 80.0;
    if (isPassed) {
        elements.evalScoreBadge.className = "eval-score-badge pass";
        elements.feedbackIcon.textContent = "🎉";
        elements.feedbackMsg.textContent = `훌륭한 영국 발음입니다! 일치율 ${similarity.toFixed(1)}%로 통과되었습니다.`;
        playToneChime('success');
    } else if (similarity >= 50.0) {
        elements.evalScoreBadge.className = "eval-score-badge retry";
        elements.feedbackIcon.textContent = "🧐";
        elements.feedbackMsg.textContent = `노란색/빨간색 표시된 단어의 억양에 유의해보세요 (${similarity.toFixed(1)}%).`;
        playToneChime('retry');
    } else {
        elements.evalScoreBadge.className = "eval-score-badge";
        elements.feedbackIcon.textContent = "💪";
        elements.feedbackMsg.textContent = `원어민 발음을 다시 들려드립니다. 천천히 따라해보세요.`;
        playToneChime('retry');
    }

    completedSet.add(item.id);
    scoresMap.set(item.id, similarity);
    updateStatistics();

    // HANDS-FREE AUTOMATIC BRANCHING
    if (isHandsFreeActive) {
        if (isPassed) {
            currentRetryCount = 0;
            triggerHandsFreeAutoAdvance();
        } else {
            handleHandsFreeRetry();
        }
    }
}

function renderWordDiffChips(userNorm, targetNorm) {
    elements.diffChipsContainer.innerHTML = "";
    const userWords = userNorm.split(' ').filter(Boolean);
    const targetWords = targetNorm.split(' ').filter(Boolean);

    targetWords.forEach((tw, idx) => {
        const uw = userWords[idx];
        const chip = document.createElement('span');

        if (uw === tw) {
            chip.className = "diff-chip match";
            chip.textContent = tw;
            chip.title = "정확히 일치";
        } else if (uw !== undefined) {
            chip.className = "diff-chip mismatch";
            chip.textContent = `${tw} (${uw})`;
            chip.title = `인식 차이: 원문 "${tw}" ↔ 발화 "${uw}"`;
        } else {
            chip.className = "diff-chip missing";
            chip.textContent = tw;
            chip.title = "누락된 단어";
        }
        elements.diffChipsContainer.appendChild(chip);
    });

    if (userWords.length > targetWords.length) {
        for (let i = targetWords.length; i < userWords.length; i++) {
            const chip = document.createElement('span');
            chip.className = "diff-chip extra";
            chip.textContent = `+${userWords[i]}`;
            chip.title = "추가 발화된 단어";
            elements.diffChipsContainer.appendChild(chip);
        }
    }
}

// --- HANDS-FREE MASTER AUTO LOOP (The Core Flow) ---
function toggleHandsFreeMaster() {
    if (isHandsFreeActive) {
        stopHandsFreeMaster();
    } else {
        startHandsFreeMaster();
    }
}

function startHandsFreeMaster() {
    isHandsFreeActive = true;
    currentRetryCount = 0;
    elements.btnMasterHandsfree.classList.add('active');
    elements.masterIcon.textContent = '⏹️';
    elements.masterText.textContent = '핸즈프리 자동 학습 일시정지';
    runHandsFreeStep();
}

function stopHandsFreeMaster() {
    isHandsFreeActive = false;
    handsFreeStep = 'idle';
    elements.btnMasterHandsfree.classList.remove('active');
    elements.masterIcon.textContent = '▶';
    elements.masterText.textContent = '핸즈프리 자동 학습 시작';
    cancelPendingTimers();
    stopAudioPlayback();
    stopRecording();
    setMasterStatus('핸즈프리 학습이 일시정지되었습니다.');
}

function runHandsFreeStep() {
    if (!isHandsFreeActive) return;

    // Step 1: Play native British audio
    handsFreeStep = 'playing_native';
    setMasterStatus(`🎧 [1/3] 원어민 영국 발음 듣는 중...`);

    playCurrentSentenceAudio(() => {
        if (!isHandsFreeActive) return;

        // Step 2: Play chime and start recording
        handsFreeStep = 'chime';
        setMasterStatus(`🔔 말할 준비...`);

        setTimeout(() => {
            if (!isHandsFreeActive) return;
            playToneChime('startSpeak');

            setTimeout(() => {
                if (!isHandsFreeActive) return;
                handsFreeStep = 'listening';
                startRecording();
            }, 350);
        }, 300);
    });
}

function triggerHandsFreeAutoAdvance() {
    handsFreeStep = 'waiting_next';
    setMasterStatus(`🎉 [통과!] 1.2초 후 다음 문장으로 자동 이동합니다...`);

    elements.autoNextBarWrapper.classList.remove('hidden');
    elements.countdownNumber.textContent = "1.2s";
    elements.autoNextFill.style.width = "100%";

    setTimeout(() => {
        elements.autoNextFill.style.width = "0%";
    }, 50);

    setTimeout(() => {
        elements.autoNextBarWrapper.classList.add('hidden');
        if (!isHandsFreeActive) return;

        if (currentIndex < filteredItems.length - 1) {
            currentIndex++;
            renderCurrentItem();
            // Automatically start step 1 for the next sentence!
            runHandsFreeStep();
        } else {
            alert('축하합니다! 현재 유닛의 모든 문장을 완주하셨습니다!');
            stopHandsFreeMaster();
        }
    }, 1200);
}

function handleHandsFreeRetry() {
    currentRetryCount++;
    if (currentRetryCount < MAX_RETRIES) {
        setMasterStatus(`💡 [재시도 ${currentRetryCount}/${MAX_RETRIES}] 1초 후 원어민 발음을 다시 듣고 도전합니다...`);
        setTimeout(() => {
            if (!isHandsFreeActive) return;
            runHandsFreeStep();
        }, 1100);
    } else {
        // Tried twice, advance to next sentence to keep rhythm
        currentRetryCount = 0;
        setMasterStatus(`💪 [2회 도전 완료] 리듬을 유지하기 위해 다음 문장으로 자동 이동합니다...`);
        setTimeout(() => {
            if (!isHandsFreeActive) return;
            if (currentIndex < filteredItems.length - 1) {
                currentIndex++;
                renderCurrentItem();
                runHandsFreeStep();
            } else {
                stopHandsFreeMaster();
            }
        }, 1500);
    }
}

function handleNoSpeechDetected() {
    if (isHandsFreeActive) {
        setMasterStatus('⚠️ 음성이 감지되지 않았습니다. 원어민 발음을 한 번 더 들려드립니다.');
        setTimeout(() => {
            if (isHandsFreeActive) {
                runHandsFreeStep();
            }
        }, 1000);
    } else {
        setMasterStatus('⚠️ 음성이 감지되지 않았습니다. 다시 시도해보세요.');
    }
}

function cancelPendingTimers() {
    clearTimeout(silenceTimer);
    if (elements.autoNextBarWrapper) {
        elements.autoNextBarWrapper.classList.add('hidden');
    }
}

function setMasterStatus(text) {
    if (elements.handsfreeStepText) {
        elements.handsfreeStepText.textContent = text;
    }
    if (elements.footerStatusText) {
        elements.footerStatusText.textContent = text;
    }
}

function updateStatistics() {
    let totalCount = 0;
    for (let i = 1; i <= 16; i++) {
        totalCount += (allChapterData[i] || []).length;
    }
    if (totalCount === 0) totalCount = 3646;
    elements.statCompleted.textContent = `${completedSet.size} / ${totalCount.toLocaleString()}`;

    let totalScore = 0;
    scoresMap.forEach(score => totalScore += score);
    const avg = scoresMap.size > 0 ? (totalScore / scoresMap.size).toFixed(1) : "0.0";
    elements.statAverage.textContent = `${avg}%`;
}

// --- MOCK SPEECH TEST ---
function runMockSpeechTest() {
    if (filteredItems.length === 0) return;
    const item = filteredItems[currentIndex];
    elements.transcriptContent.textContent = item.english;
    elements.transcriptContent.style.color = "var(--text-white)";
    elements.transcriptContent.style.fontStyle = "normal";
    evaluateSubmission(item.english);
    setMasterStatus(`⚡ 모의 발화 시연 완료: "${item.english.substring(0, 30)}..."`);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Theme Toggle Button
    if (elements.btnThemeToggle) {
        elements.btnThemeToggle.addEventListener('click', () => {
            toggleTheme();
        });
    }

    // Hands-Free Master Button
    elements.btnMasterHandsfree.addEventListener('click', () => {
        toggleHandsFreeMaster();
    });

    // Chapter Selection Dropdown
    if (elements.chapterSelect) {
        elements.chapterSelect.addEventListener('change', (e) => {
            currentChapter = parseInt(e.target.value, 10);
            currentUnitFilter = 'all';

            // Switch audio source
            if (nativeAudio) {
                nativeAudio.src = AUDIO_SOURCES[currentChapter];
                nativeAudio.load();
            }

            populateUnitDropdown();
            applyFilter();
        });
    }

    // Unit Dropdown
    elements.unitSelect.addEventListener('change', (e) => {
        currentUnitFilter = e.target.value;
        applyFilter();
    });

    // Navigation Buttons
    elements.btnPrev.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderCurrentItem();
            if (isHandsFreeActive) {
                runHandsFreeStep();
            } else {
                playCurrentSentenceAudio();
            }
        }
    });

    elements.btnNext.addEventListener('click', () => {
        if (currentIndex < filteredItems.length - 1) {
            currentIndex++;
            renderCurrentItem();
            if (isHandsFreeActive) {
                runHandsFreeStep();
            } else {
                playCurrentSentenceAudio();
            }
        }
    });

    // Sub-tools
    elements.btnReplayAudio.addEventListener('click', () => {
        playCurrentSentenceAudio();
    });

    elements.btnManualRecord.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            playToneChime('startSpeak');
            setTimeout(() => startRecording(), 350);
        }
    });

    elements.btnMockTest.addEventListener('click', () => {
        runMockSpeechTest();
    });

    // Speed Controls
    elements.speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSpeed = parseFloat(btn.dataset.speed);
            if (nativeAudio) {
                nativeAudio.playbackRate = currentSpeed;
            }
        });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            playCurrentSentenceAudio();
        } else if (e.code === 'F5') {
            e.preventDefault();
            if (isRecording) stopRecording();
            else startRecording();
        } else if (e.code === 'ArrowLeft') {
            if (currentIndex > 0) {
                currentIndex--;
                renderCurrentItem();
                playCurrentSentenceAudio();
            }
        } else if (e.code === 'ArrowRight') {
            if (currentIndex < filteredItems.length - 1) {
                currentIndex++;
                renderCurrentItem();
                playCurrentSentenceAudio();
            }
        } else if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
            e.preventDefault();
            runMockSpeechTest();
        }
    });
}
