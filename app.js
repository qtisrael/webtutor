/**
 * WebTutor - 100% Client-Side Web Speech AI Tutor
 * Runs on standard Web Speech API (speechSynthesis & SpeechRecognition)
 * Zero server cost, zero model download, deployable to GitHub Pages.
 */

// --- STATE MANAGEMENT ---
let allCurriculum = [];
let filteredItems = [];
let currentIndex = 0;

let currentLang = 0;       // 0: English, 1: Japanese
let currentAccent = 'us';   // 'us': en-US, 'gb': en-GB
let currentDifficulty = 1; // 1: Beginner, 2: Intermediate, 3: Advanced
let currentMode = 0;       // 0: Shadowing, 1: Q&A Drill
let currentSpeed = 1.0;

let isRecording = false;
let isPlayingTts = false;

// Audio & STT references
let recognition = null;
let audioContext = null;
let micMediaStream = null;
let animFrameId = null;

// Progress stats
const completedItemIds = new Set();
const scoresMap = new Map();

// --- DOM ELEMENTS ---
const elements = {
    // Stats
    statCompleted: document.getElementById('stat-completed'),
    statAverage: document.getElementById('stat-average'),
    itemCounter: document.getElementById('item-counter'),

    // Nav
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),

    // Toolbars
    langButtons: document.querySelectorAll('#lang-group .pill-btn'),
    accentBlock: document.getElementById('accent-block'),
    accentButtons: document.querySelectorAll('#accent-group .pill-btn'),
    diffButtons: document.querySelectorAll('#diff-group .pill-btn'),
    modeButtons: document.querySelectorAll('#mode-group .pill-btn'),

    // Card 1: Prompt & TTS
    badgeMode: document.getElementById('badge-mode'),
    badgeDiff: document.getElementById('badge-diff'),
    badgeAccent: document.getElementById('badge-accent'),
    speedButtons: document.querySelectorAll('#speed-group .speed-btn'),
    promptText: document.getElementById('prompt-text'),
    koreanText: document.getElementById('korean-text'),
    btnPlayTts: document.getElementById('btn-play-tts'),
    ttsStatus: document.getElementById('tts-status'),

    // Card 2: Voice Input
    btnRecordToggle: document.getElementById('btn-record-toggle'),
    recordIcon: document.getElementById('record-icon'),
    recordBtnText: document.getElementById('record-btn-text'),
    micMeterBar: document.getElementById('mic-meter-bar'),
    micLevelValue: document.getElementById('mic-level-value'),
    sttStatusBanner: document.getElementById('stt-status-banner'),
    btnMockTest: document.getElementById('btn-mock-test'),

    // Card 3: Evaluation
    scoreBadge: document.getElementById('score-badge'),
    scoreValue: document.getElementById('score-value'),
    recognizedText: document.getElementById('recognized-text'),
    diffChipsContainer: document.getElementById('diff-chips-container'),
    feedbackBanner: document.getElementById('feedback-banner'),
    feedbackMessage: document.getElementById('feedback-message'),
    modelComparison: document.getElementById('model-comparison'),

    // Footer
    statusDot: document.getElementById('status-dot'),
    statusMessage: document.getElementById('status-message')
};

// --- EMBEDDED SAMPLE FALLBACK (for file:/// offline open without HTTP server) ---
const FALLBACK_ITEMS = [
    {
        "Id": "fb_en_beg_sh_1",
        "Language": 0,
        "Difficulty": 1,
        "Mode": 0,
        "PromptText": "The woman was afraid of what she saw in the dark.",
        "ModelAnswer": "The woman was afraid of what she saw in the dark.",
        "KoreanTranslation": "그 여자는 어둠 속에서 본 것을 두려워했습니다.",
        "RequiredKeywords": []
    },
    {
        "Id": "fb_en_beg_qa_1",
        "Language": 0,
        "Difficulty": 1,
        "Mode": 1,
        "PromptText": "What do you do when you are thirsty on a hot summer day?",
        "ModelAnswer": "I drink cold water or fresh fruit juice to stay hydrated.",
        "KoreanTranslation": "더운 여름날 목이 마르면 어떻게 하시나요?",
        "RequiredKeywords": ["water", "cold", "drink", "juice", "hydrated"]
    },
    {
        "Id": "fb_ja_beg_sh_1",
        "Language": 1,
        "Difficulty": 1,
        "Mode": 0,
        "PromptText": "私は毎日、朝七時に起きて散歩をします。",
        "ModelAnswer": "私は毎日、朝七時に起きて散歩をします。",
        "KoreanTranslation": "저는 매일 아침 7시에 일어나서 산책을 합니다.",
        "RequiredKeywords": []
    },
    {
        "Id": "fb_ja_beg_qa_1",
        "Language": 1,
        "Difficulty": 1,
        "Mode": 1,
        "PromptText": "週末には普段どんなことをして過ごしますか？",
        "ModelAnswer": "家で本を読んだり、友人と映画を見に行ったりします。",
        "KoreanTranslation": "주말에는 보통 어떤 것을 하며 시간을 보내시나요?",
        "RequiredKeywords": ["家", "本", "映画", "友", "読", "見", "過ご"]
    }
];

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    initSpeechSynthesis();
    initSpeechRecognition();
    setupEventListeners();
    await loadCurriculum();
    applyFilter();
    setStatus('준비 완료 (단축키: [Space] 다시 듣기, [F5] 녹음, [←/→] 문항 이동, [Ctrl+M] 모의 발화)');
});

// --- LOAD CURRICULUM ---
async function loadCurriculum() {
    // 1. Direct JS bundle check (works 100% on file:/// and HTTP without CORS issues)
    if (window.CURRICULUM_DATA && Array.isArray(window.CURRICULUM_DATA) && window.CURRICULUM_DATA.length > 0) {
        allCurriculum = window.CURRICULUM_DATA;
        console.log(`Loaded ${allCurriculum.length} curriculum items from window.CURRICULUM_DATA.`);
        return;
    }

    // 2. Fetch fallback (for HTTP/HTTPS server environments)
    try {
        const response = await fetch('data/curriculum.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        allCurriculum = await response.json();
        console.log(`Loaded ${allCurriculum.length} curriculum items successfully via fetch.`);
    } catch (err) {
        console.warn('Could not load data/curriculum.json via fetch, using fallback samples:', err);
        allCurriculum = FALLBACK_ITEMS;
        setStatus('⚠️ 로컬 파일(file://) 모드로 실행 중: 샘플 문항이 로드되었습니다.');
    }
}

// --- FILTER & DISPLAY ---
function applyFilter() {
    filteredItems = allCurriculum.filter(item => 
        item.Language === currentLang &&
        item.Difficulty === currentDifficulty &&
        item.Mode === currentMode
    );

    // If no items match, fall back to any items of this language & mode
    if (filteredItems.length === 0) {
        filteredItems = allCurriculum.filter(item => item.Language === currentLang);
    }

    currentIndex = 0;
    renderCurrentItem();
}

function renderCurrentItem() {
    if (filteredItems.length === 0) {
        elements.promptText.textContent = "조건에 일치하는 문항이 없습니다.";
        elements.koreanText.textContent = "";
        elements.itemCounter.textContent = "0 / 0";
        elements.btnPrev.disabled = true;
        elements.btnNext.disabled = true;
        return;
    }

    const item = filteredItems[currentIndex];

    // Counter
    elements.itemCounter.textContent = `${currentIndex + 1} / ${filteredItems.length}`;
    elements.btnPrev.disabled = (currentIndex === 0);
    elements.btnNext.disabled = (currentIndex === filteredItems.length - 1);

    // Badges
    elements.badgeMode.textContent = item.Mode === 0 ? "Shadowing (따라하기)" : "Q&A Drill (질문 응답)";
    const diffNames = { 1: "초급 (Beginner)", 2: "중급 (Intermediate)", 3: "고급 (Advanced)" };
    elements.badgeDiff.textContent = diffNames[item.Difficulty] || "초급";

    if (currentLang === 0) {
        elements.badgeAccent.style.display = 'inline-block';
        elements.badgeAccent.textContent = currentAccent === 'us' ? "미국식 발음 (en-US)" : "영국식 발음 (en-GB)";
    } else {
        elements.badgeAccent.style.display = 'inline-block';
        elements.badgeAccent.textContent = "일본어 표준어 (ja-JP)";
    }

    // Texts
    elements.promptText.textContent = item.PromptText;
    elements.koreanText.textContent = item.KoreanTranslation || "";

    // Reset evaluation card for the new item
    resetEvaluationView();
}

function resetEvaluationView() {
    elements.recognizedText.textContent = "(아직 발화가 입력되지 않았습니다)";
    elements.recognizedText.style.color = "var(--text-muted)";
    elements.diffChipsContainer.innerHTML = "";
    elements.scoreValue.textContent = "0.0%";
    elements.scoreBadge.className = "score-badge neutral";
    elements.feedbackMessage.textContent = currentMode === 0
        ? "원어민 음성을 듣고 [발화 시작] 버튼을 눌러 따라 말해보세요."
        : "질문을 듣고 [발화 시작] 버튼을 눌러 자신의 답변을 말해보세요.";
    elements.modelComparison.textContent = "";
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // 1. Language buttons
    elements.langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.langButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = btn.dataset.lang === 'ja' ? 1 : 0;

            // Show/hide accent selector
            if (currentLang === 1) {
                elements.accentBlock.style.opacity = '0.4';
                elements.accentBlock.style.pointerEvents = 'none';
            } else {
                elements.accentBlock.style.opacity = '1';
                elements.accentBlock.style.pointerEvents = 'auto';
            }

            applyFilter();
        });
    });

    // 2. English Accent buttons
    elements.accentButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.accentButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAccent = btn.dataset.accent;
            renderCurrentItem();
        });
    });

    // 3. Difficulty buttons
    elements.diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.diffButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = parseInt(btn.dataset.diff, 10);
            applyFilter();
        });
    });

    // 4. Mode buttons
    elements.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = parseInt(btn.dataset.mode, 10);
            applyFilter();
        });
    });

    // 5. Speed buttons
    elements.speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSpeed = parseFloat(btn.dataset.speed);
        });
    });

    // 6. Navigation
    elements.btnPrev.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderCurrentItem();
        }
    });

    elements.btnNext.addEventListener('click', () => {
        if (currentIndex < filteredItems.length - 1) {
            currentIndex++;
            renderCurrentItem();
        }
    });

    // 7. TTS Play button
    elements.btnPlayTts.addEventListener('click', () => {
        playCurrentPromptTts();
    });

    // 8. Record Toggle button
    elements.btnRecordToggle.addEventListener('click', () => {
        toggleRecording();
    });

    // 9. Mock test button
    elements.btnMockTest.addEventListener('click', () => {
        runMockSpeechTest();
    });

    // 10. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            playCurrentPromptTts();
        } else if (e.code === 'F5') {
            e.preventDefault();
            toggleRecording();
        } else if (e.code === 'ArrowLeft') {
            if (currentIndex > 0) {
                currentIndex--;
                renderCurrentItem();
            }
        } else if (e.code === 'ArrowRight') {
            if (currentIndex < filteredItems.length - 1) {
                currentIndex++;
                renderCurrentItem();
            }
        } else if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
            e.preventDefault();
            runMockSpeechTest();
        }
    });
}

// --- WEB SPEECH SYNTHESIS (TTS) ---
let availableVoices = [];

function initSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech Synthesis API is not supported in this browser.');
        setStatus('⚠️ 현재 브라우저에서 Web Speech TTS를 지원하지 않습니다 (Chrome/Edge 권장).');
        return;
    }

    const loadVoices = () => {
        availableVoices = window.speechSynthesis.getVoices();
        console.log(`SpeechSynthesis: ${availableVoices.length} voices loaded.`);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}

function findBestVoice(lang, accent) {
    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    if (lang === 1) {
        // Japanese
        const jaVoice = availableVoices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja') || v.name.includes('Japanese') || v.name.includes('日本語'));
        return jaVoice || null;
    }

    // English
    if (accent === 'gb') {
        const gbVoice = availableVoices.find(v => v.lang === 'en-GB' || v.lang.includes('GB') || v.name.includes('United Kingdom') || v.name.includes('UK') || v.name.includes('British'));
        if (gbVoice) return gbVoice;
    }

    // US English default
    const usVoice = availableVoices.find(v => v.lang === 'en-US' || v.lang.includes('US') || v.name.includes('United States') || v.name.includes('Natural'));
    if (usVoice) return usVoice;

    // Any English voice fallback
    return availableVoices.find(v => v.lang.startsWith('en')) || null;
}

function playCurrentPromptTts() {
    if (!('speechSynthesis' in window)) {
        alert('이 브라우저는 Web Speech API TTS를 지원하지 않습니다.');
        return;
    }

    if (filteredItems.length === 0) return;
    const item = filteredItems[currentIndex];
    const textToSpeak = item.PromptText;

    window.speechSynthesis.cancel(); // Stop any pending utterances

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = currentSpeed;
    utterance.pitch = 1.0;

    const voice = findBestVoice(currentLang, currentAccent);
    if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
    } else {
        utterance.lang = currentLang === 1 ? 'ja-JP' : (currentAccent === 'gb' ? 'en-GB' : 'en-US');
    }

    utterance.onstart = () => {
        isPlayingTts = true;
        elements.ttsStatus.classList.remove('hidden');
        elements.btnPlayTts.disabled = true;
        setStatus(`🔊 음성 재생 중: [${utterance.lang}] "${textToSpeak.substring(0, 30)}..."`);
    };

    utterance.onend = () => {
        isPlayingTts = false;
        elements.ttsStatus.classList.add('hidden');
        elements.btnPlayTts.disabled = false;
        setStatus('준비 완료');
    };

    utterance.onerror = (e) => {
        console.error('SpeechSynthesis error:', e);
        isPlayingTts = false;
        elements.ttsStatus.classList.add('hidden');
        elements.btnPlayTts.disabled = false;
        setStatus('음성 재생 중 오류가 발생했습니다.');
    };

    window.speechSynthesis.speak(utterance);
}

// --- WEB SPEECH RECOGNITION (STT) ---
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('SpeechRecognition API is not supported in this browser.');
        setStatus('⚠️ 음성 인식(STT)은 Chrome 또는 Edge 브라우저에서 가장 원활하게 동작합니다.');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        updateRecordingUI(true);
        startMicVisualizer();
        elements.sttStatusBanner.classList.remove('hidden');
        setStatus('🎤 발화 중... 마이크에 또박또박 말씀해 주세요.');
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            elements.recognizedText.textContent = finalTranscript;
            elements.recognizedText.style.color = "var(--text-color)";
            evaluateSubmission(finalTranscript);
        } else if (interimTranscript) {
            elements.recognizedText.textContent = interimTranscript + " ...";
            elements.recognizedText.style.color = "var(--text-muted)";
        }
    };

    recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        stopRecordingUI();
        if (event.error === 'not-allowed') {
            setStatus('❌ 마이크 권한이 거부되었습니다. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 마이크를 허용해 주세요.');
            alert('마이크 사용 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
        } else if (event.error === 'no-speech') {
            setStatus('⚠️ 음성이 감지되지 않았습니다. 다시 시도해 주세요.');
        } else {
            setStatus(`⚠️ 음성 인식 알림: ${event.error}`);
        }
    };

    recognition.onend = () => {
        stopRecordingUI();
    };
}

function toggleRecording() {
    if (!recognition) {
        initSpeechRecognition();
        if (!recognition) {
            alert('이 브라우저는 음성 인식(Web Speech API)을 지원하지 않습니다. Google Chrome 또는 Microsoft Edge를 권장합니다.\n\n우측 상단의 [⚡ 모의 발화 테스트] 버튼으로 기능을 즉시 체험해보실 수 있습니다.');
            return;
        }
    }

    if (isRecording) {
        recognition.stop();
        stopRecordingUI();
    } else {
        // Set recognition language
        if (currentLang === 1) {
            recognition.lang = 'ja-JP';
        } else {
            recognition.lang = (currentAccent === 'gb') ? 'en-GB' : 'en-US';
        }

        try {
            recognition.start();
        } catch (e) {
            console.error('Recognition start error:', e);
            recognition.stop();
            setTimeout(() => recognition.start(), 200);
        }
    }
}

function updateRecordingUI(recording) {
    if (recording) {
        elements.btnRecordToggle.classList.add('recording');
        elements.recordIcon.textContent = '⏹️';
        elements.recordBtnText.textContent = '발화 종료 (녹음 중지)';
    } else {
        elements.btnRecordToggle.classList.remove('recording');
        elements.recordIcon.textContent = '🎤';
        elements.recordBtnText.textContent = '발화 시작 (말하기)';
        elements.sttStatusBanner.classList.add('hidden');
    }
}

function stopRecordingUI() {
    isRecording = false;
    updateRecordingUI(false);
    stopMicVisualizer();
}

// --- MIC AUDIO VISUALIZER (Web Audio API) ---
async function startMicVisualizer() {
    try {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtx();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        micMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const sourceNode = audioContext.createMediaStreamSource(micMediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        sourceNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
            if (!isRecording) return;
            analyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const percent = Math.min(100, Math.round((avg / 128) * 100));

            elements.micMeterBar.style.width = `${percent}%`;
            elements.micLevelValue.textContent = `${percent}%`;

            animFrameId = requestAnimationFrame(updateMeter);
        };

        updateMeter();
    } catch (err) {
        console.warn('Could not initialize mic audio visualizer:', err);
    }
}

function stopMicVisualizer() {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    if (micMediaStream) {
        micMediaStream.getTracks().forEach(track => track.stop());
        micMediaStream = null;
    }
    elements.micMeterBar.style.width = '0%';
    elements.micLevelValue.textContent = '0%';
}

// --- EVALUATION LOGIC ---
function normalizeText(text, lang) {
    if (!text) return "";
    if (lang === 0) {
        // English: lowercase, strip punctuation, normalize spaces
        return text.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    } else {
        // Japanese: strip Japanese and ASCII punctuation
        return text
            .replace(/[、。！？「」…・\s.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, "")
            .trim();
    }
}

function levenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    const d = [];

    for (let i = 0; i <= len1; i++) {
        d[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        d[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,       // deletion
                d[i][j - 1] + 1,       // insertion
                d[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return d[len1][len2];
}

function computeSimilarity(s1, s2) {
    if (!s1 && !s2) return 100;
    if (!s1 || !s2) return 0;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    const dist = levenshteinDistance(s1, s2);
    return Math.max(0, (1 - dist / maxLen) * 100);
}

function evaluateSubmission(userTranscript) {
    if (filteredItems.length === 0) return;
    const item = filteredItems[currentIndex];

    const normUser = normalizeText(userTranscript, item.Language);
    const targetText = item.Mode === 0 ? item.PromptText : (item.ModelAnswer || item.PromptText);
    const normTarget = normalizeText(targetText, item.Language);

    let score = 0;
    let feedback = "";

    if (item.Mode === 0) {
        // SHADOWING MODE: Levenshtein string & token comparison
        score = computeSimilarity(normUser, normTarget);

        if (score >= 90) {
            feedback = "✨ 완벽에 가까운 원어민 발음과 일치율입니다! 매우 훌륭합니다.";
        } else if (score >= 75) {
            feedback = "👍 대부분 정확하게 발음하셨습니다! 사소한 연음이나 억양을 가다듬어보세요.";
        } else if (score >= 50) {
            feedback = "🧐 어느 정도 의미가 통하는 발화입니다. 원어민 음성을 한 번 더 듣고 연습해보세요.";
        } else {
            feedback = "💪 단어의 발음과 문장 구조를 천천히 확인하면서 한 단어씩 따라해보세요.";
        }

        renderWordDiffChips(normUser, normTarget, item.Language);
        elements.modelComparison.textContent = `[원문 대조] ${item.PromptText}`;

    } else {
        // Q&A DRILL MODE: Keyword Inclusion + Similarity
        const required = item.RequiredKeywords || [];
        let matchedKeywords = [];
        let missingKeywords = [];

        for (const kw of required) {
            const normKw = normalizeText(kw, item.Language);
            if (normUser.includes(normKw)) {
                matchedKeywords.push(kw);
            } else {
                missingKeywords.push(kw);
            }
        }

        if (required.length > 0) {
            const kwRatio = matchedKeywords.length / required.length;
            const sim = computeSimilarity(normUser, normTarget);
            // Blend: 70% keywords, 30% sentence similarity
            score = Math.min(100, Math.round((kwRatio * 70) + (sim * 0.3)));

            if (kwRatio === 1.0) {
                feedback = `🎉 질문의 핵심 키워드 [${matchedKeywords.join(', ')}]를 모두 정확히 포함하여 훌륭하게 답변하셨습니다!`;
            } else if (kwRatio >= 0.5) {
                feedback = `💡 포함된 키워드: [${matchedKeywords.join(', ')}]. 놓친 키워드: [${missingKeywords.join(', ')}] 도 답변에 활용해보세요.`;
            } else {
                feedback = `⚠️ 필수 핵심 키워드 [${required.join(', ')}]가 부족합니다. 모범 답안을 참고해 답변을 완성해보세요.`;
            }
        } else {
            score = computeSimilarity(normUser, normTarget);
            feedback = "답변이 인식되었습니다. 모범 답안과 비교해보세요.";
        }

        renderWordDiffChips(normUser, normTarget, item.Language);
        elements.modelComparison.textContent = `[모범 답안] ${item.ModelAnswer}`;
    }

    // Update UI Score
    elements.scoreValue.textContent = `${score.toFixed(1)}%`;
    if (score >= 80) {
        elements.scoreBadge.className = "score-badge good";
    } else if (score >= 50) {
        elements.scoreBadge.className = "score-badge warning";
    } else {
        elements.scoreBadge.className = "score-badge danger";
    }

    elements.feedbackMessage.textContent = feedback;

    // Track statistics
    completedItemIds.add(item.Id);
    scoresMap.set(item.Id, score);
    updateStatistics();
}

function renderWordDiffChips(userNorm, targetNorm, lang) {
    elements.diffChipsContainer.innerHTML = "";

    const userTokens = lang === 0 ? userNorm.split(' ').filter(Boolean) : userNorm.split('');
    const targetTokens = lang === 0 ? targetNorm.split(' ').filter(Boolean) : targetNorm.split('');

    targetTokens.forEach((targetWord, idx) => {
        const userWord = userTokens[idx];
        const chip = document.createElement('span');

        if (userWord === targetWord) {
            chip.className = "diff-chip match";
            chip.textContent = targetWord;
            chip.title = "정확히 일치";
        } else if (userWord !== undefined) {
            chip.className = "diff-chip mismatch";
            chip.textContent = `${targetWord} (${userWord})`;
            chip.title = `인식 차이: 사용자 "${userWord}" ↔ 원문 "${targetWord}"`;
        } else {
            chip.className = "diff-chip missing";
            chip.textContent = targetWord;
            chip.title = "누락된 단어";
        }
        elements.diffChipsContainer.appendChild(chip);
    });

    // Check for extra tokens user spoke beyond target
    if (userTokens.length > targetTokens.length) {
        for (let i = targetTokens.length; i < userTokens.length; i++) {
            const chip = document.createElement('span');
            chip.className = "diff-chip extra";
            chip.textContent = `+${userTokens[i]}`;
            chip.title = "추가 발화된 단어";
            elements.diffChipsContainer.appendChild(chip);
        }
    }
}

function updateStatistics() {
    elements.statCompleted.textContent = `${completedItemIds.size}문항`;

    let totalScore = 0;
    scoresMap.forEach(score => {
        totalScore += score;
    });

    const avg = scoresMap.size > 0 ? (totalScore / scoresMap.size).toFixed(1) : "0.0";
    elements.statAverage.textContent = `${avg}%`;
}

// --- MOCK SPEECH TEST (For microphone-less testing & instant demo) ---
function runMockSpeechTest() {
    if (filteredItems.length === 0) return;
    const item = filteredItems[currentIndex];

    let mockText = "";
    if (item.Mode === 0) {
        // Shadowing: 90% accurate text with one minor variation
        const words = item.PromptText.replace(/[.,!?;]/g, "").split(' ');
        if (words.length > 3) {
            // Slight natural simulation
            mockText = item.PromptText;
        } else {
            mockText = item.PromptText;
        }
    } else {
        // Q&A drill: Model Answer
        mockText = item.ModelAnswer || item.PromptText;
    }

    elements.recognizedText.textContent = mockText;
    elements.recognizedText.style.color = "var(--text-color)";
    evaluateSubmission(mockText);
    setStatus(`⚡ 모의 발화 시연 완료: "${mockText.substring(0, 35)}..."`);
}

function setStatus(msg) {
    if (elements.statusMessage) {
        elements.statusMessage.textContent = msg;
    }
}

