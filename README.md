# 🌐 WebTutor - Web Speech API 기반 오프라인 & 웹 회화 튜터

> **서버 비용 0원 • 모델 다운로드 0MB • GitHub Pages 즉시 배포 가능**  
> 브라우저 표준 Web Speech API (`SpeechSynthesis` & `SpeechRecognition`) 기반으로 구동되는 영어/일본어 AI 회화 튜터 웹 애플리케이션입니다.

---

## 🚀 주요 특징 (Key Features)

1. **다운로드 0MB & 인스톨 프리 (Instant Launch)**
   - 수백 MB~GB 단위의 무거운 온디바이스 ONNX 모델 다운로드 없이 브라우저 내장 음성 엔진으로 즉시 실행됩니다.
   - PC(Windows, macOS, Linux) 및 모바일(iOS Safari, Android Chrome) 브라우저 지원.

2. **300문항 정밀 커리큘럼 내장 (`data/curriculum.json`)**
   - **영어 190문항**: 초급 75문항, 중급 70문항, 고급 45문항
   - **일본어 110문항**: 초급 40문항, 중급 40문항, 고급 30문항
   - 일상 회화, AnkiWeb 핵심 4000단어, 비즈니스 및 상황별 Q&A 포함.

3. **다국어 및 다중 억양 (Accent) 지원**
   - 🇺🇸 **미국식 영어 (en-US)**: 표준 미국 영어 발음 TTS 및 음성 인식
   - 🇬🇧 **영국식 영어 (en-GB)**: 영국식 억양 특화 TTS 및 음성 인식
   - 🇯🇵 **일본어 (ja-JP)**: 표준 일본어 발음 TTS 및 음성 인식

4. **학습 모드 2종**
   - 🎧 **쉐도잉 (따라하기)**: 원어민 발화를 듣고 따라 말하면 Levenshtein 알고리즘으로 단어 단위 일치율(0~100%)을 실시간 채점하고 단어별 피드백 칩(정확, 오발음, 누락, 추가) 제공.
   - 💬 **Q&A 드릴 (응답하기)**: 상황별 질문을 듣고 자신의 문장으로 답변하면 핵심 필수 키워드 포함 여부와 문장 완성도를 결합해 피드백 제공.

5. **실시간 마이크 볼륨 미터 (Web Audio API)**
   - 발화 중 마이크 입력 감도를 실시간 시각적 레벨 바(0~100%)로 표시.

6. **모의 발화 테스트 & 키보드 단축키**
   - 마이크가 없는 환경이나 빠른 검증을 위한 **[⚡ 모의 발화 테스트]** 기능 제공.
   - `Space`: 원어민 음성 다시 듣기
   - `F5`: 발화 녹음 시작 / 중지 (새로고침 방지 처리 완료)
   - `←` / `→`: 이전 / 다음 문항 이동
   - `Ctrl + M`: 모의 발화 테스트 실행

---

## 📂 프로젝트 구조

```
WebTutor/
├── index.html            # 반응형 SPA UI 구조 (시맨틱 HTML5)
├── style.css             # 모던 다크/글래스모피즘 & 세그먼트 버튼 스타일링
├── app.js                # Web Speech API 엔진, 채점 알고리즘, 반응형 상태 머신
├── data/
│   └── curriculum.json   # 300문항 통합 데이터셋 (영어 190, 일본어 110)
└── README.md             # 배포 및 실행 가이드
```

---

## 💻 로컬에서 실행하기 (Local Testing)

브라우저의 보안 정책상 `SpeechRecognition` 및 `fetch()`는 로컬 웹서버 환경(`http://localhost`) 또는 `https://` 환경에서 가장 안정적으로 작동합니다.

### 방법 1. Python 내장 서버 (가장 간편함)
PowerShell 또는 터미널에서 다음 명령을 실행합니다:
```bash
cd D:\workspace\Tutor\WebTutor
python -m http.server 8000
```
브라우저에서 [http://localhost:8000](http://localhost:8000) 접속.

### 방법 2. Node.js `npx serve`
```bash
cd D:\workspace\Tutor\WebTutor
npx serve .
```

### 방법 3. VS Code Live Server
`WebTutor/index.html` 파일을 우클릭한 후 **"Open with Live Server"** 선택.

---

## 🚀 GitHub Pages 무료 배포 가이드 (Zero Server Cost)

GitHub Pages는 정적 웹사이트를 무료로 호스팅해주는 서비스로, **HTTPS가 기본 적용**되므로 스마트폰 및 모든 브라우저에서 마이크 권한이 정상 작동합니다.

### 1단계: Git 저장소 초기화 및 커밋
새로운 전용 저장소를 만들거나 기존 저장소에 푸시합니다:
```bash
cd D:\workspace\Tutor\WebTutor
git init
git add .
git commit -m "Initial commit for WebTutor GitHub Pages"
```

### 2단계: GitHub에 푸시
1. [GitHub](https://github.com)에서 새 Repository를 생성합니다 (예: `webtutor`).
2. 로컬 브랜치를 연결하고 푸시합니다:
```bash
git remote add origin https://github.com/<당신의-깃허브-아이디>/webtutor.git
git branch -M main
git push -u origin main
```

### 3단계: GitHub Pages 활성화
1. GitHub 저장소 페이지의 **Settings** (설정) 탭으로 이동합니다.
2. 좌측 메뉴에서 **Pages**를 클릭합니다.
3. **Build and deployment > Source**에서 **Deploy from a branch**를 선택합니다.
4. **Branch**를 `main` 브랜치, 폴더를 `/ (root)`로 지정하고 **Save**를 누릅니다.
5. 1~2분 뒤 상단에 표시되는 **`https://<당신의-깃허브-아이디>.github.io/webtutor/`** 링크로 접속하면 전 세계 어디서든 무료로 즉시 사용할 수 있습니다!

---

## 🛡️ 브라우저 호환성 안내

| 브라우저 | 음성 합성 (TTS) | 음성 인식 (STT) | 권장 여부 |
| :--- | :---: | :---: | :---: |
| **Google Chrome (PC/Android)** | ✅ 완벽 지원 | ✅ 완벽 지원 | ⭐ 강력 추천 |
| **Microsoft Edge (PC/Mobile)** | ✅ 고품질 Natural Voice | ✅ 완벽 지원 | ⭐ 강력 추천 |
| **Apple Safari (iOS/macOS)** | ✅ 지원 | ✅ 지원 (iOS 14.5+) | 👍 추천 |
| **Mozilla Firefox** | ✅ 지원 | ⚠️ 부분 지원 | 💡 Chrome 권장 |

> **안내사항**: 마이크를 이용한 음성 인식(STT)은 브라우저 보안 규정상 `https://` (GitHub Pages) 또는 `localhost`에서만 마이크 권한 팝업이 활성화됩니다.

