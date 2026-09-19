# React, TypeScript, and React Three Fiber Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 DEAD AIR 게임의 동작을 유지하면서 TypeScript, React, React Three Fiber 기반 소스 구조로 전환한다.

**Architecture:** 게임 규칙은 DOM과 렌더러에 의존하지 않는 `src/game/engine.ts`에 유지한다. React가 메뉴·HUD·모달·입력을 선언적으로 관리하고, React Three Fiber의 `Canvas`와 `useFrame`이 Three.js 장면 생성 및 프레임 갱신을 담당한다. Vite가 `src/`를 빌드해 배포 가능한 `dist/`를 만든다.

**Tech Stack:** TypeScript 5, React 19, React DOM 19, React Three Fiber 9, Three.js 0.186, Vite 7, Vitest 3.

## Global Constraints

- 기존 이동 수단 3종, 난이도 3종, 45초 생존 규칙, 충돌, 오디오, 한국어·영어 전환을 유지한다.
- 기존 Google Analytics는 배포 도메인에서만 로드한다.
- `dist/`는 소스가 아닌 Vite 빌드 산출물이어야 한다.
- 브라우저 렌더링은 React Three Fiber의 `Canvas`와 `useFrame`을 통해 실행한다.

---

### Task 1: TypeScript 빌드 기반과 순수 게임 엔진

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/game/types.ts`
- Create: `src/game/engine.ts`
- Modify: `tests/engine.test.ts`

**Interfaces:**
- Produces: `createGame(mode, difficulty, seed): GameState`, `stepGame(game, input, delta): void`, `Mode`, `Difficulty`, `GameInput`, `GameState`.

- [x] **Step 1: Vite, React, TypeScript, R3F, Vitest 의존성과 스크립트를 선언한다.**
- [x] **Step 2: 기존 엔진 테스트를 TypeScript 소스 import로 전환한다.**
- [x] **Step 3: 게임 상태와 설정 키를 TypeScript 타입으로 정의한다.**
- [x] **Step 4: 기존 물리·충돌 규칙을 `src/game/engine.ts`로 이전한다.**
- [x] **Step 5: `npm test`와 `npm run typecheck`를 실행해 엔진 보존을 확인한다.**

### Task 2: Three.js 장면을 React Three Fiber 생명주기로 전환

**Files:**
- Create: `src/game/cockpit.ts`
- Create: `src/game/world.ts`
- Create: `src/components/GameCanvas.tsx`

**Interfaces:**
- Consumes: `GameState` mutable ref and reduced-motion flag.
- Produces: `GameCanvas` React component; `createWorld(scene, camera)` returns `update(game, time, delta, reducedMotion)` and `destroy()`.

- [x] **Step 1: 조종석 모델 코드를 npm `three` import와 TypeScript 상태 타입으로 이전한다.**
- [x] **Step 2: 기존 장면 생성 코드에서 WebGLRenderer·resize·RAF 소유권을 제거한다.**
- [x] **Step 3: `Canvas`를 만들고 `useFrame`에서 게임 시뮬레이션과 장면 갱신을 호출한다.**
- [x] **Step 4: 장면 unmount 시 geometry, material, texture, cockpit 자원을 해제한다.**
- [x] **Step 5: `npm run typecheck`와 프로덕션 빌드로 R3F 통합을 검증한다.**

### Task 3: UI와 입력을 React로 전환

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `src/game/audio.ts`
- Create: `src/i18n.ts`
- Create: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `GameCanvas`, engine API, translation catalog, audio controller.
- Produces: React state for locale, status, loadout, difficulty, HUD, dialogs; mutable `GameState` ref shared with the frame loop.

- [x] **Step 1: 번역과 Web Audio 모듈을 TypeScript로 이전한다.**
- [x] **Step 2: 메뉴, HUD, 일시정지, 결과, 도움말을 React JSX 컴포넌트로 옮긴다.**
- [x] **Step 3: 키보드, 포인터 잠금, 드래그, 모바일 조이스틱 입력을 React effect/event handler로 연결한다.**
- [x] **Step 4: 언어·오디오·모션 설정과 게임 상태 전환을 React state로 연결한다.**
- [x] **Step 5: 기존 CSS를 `src/styles.css`로 이전하고 R3F canvas wrapper에 맞춘다.**

### Task 4: 테스트, 문서, 배포 산출물 정리

**Files:**
- Modify: `tests/cockpit.test.ts`
- Modify: `tests/i18n.test.ts`
- Create: `tests/app.test.tsx`
- Modify: `README.md`
- Regenerate: `dist/`

**Interfaces:**
- Consumes: React 앱과 TypeScript 게임 모듈.
- Produces: 엔진·번역·React UI 회귀 테스트와 정적 배포 결과.

- [x] **Step 1: 기존 조종석·번역 테스트 import를 TypeScript 소스로 전환한다.**
- [x] **Step 2: 시작, 모드 선택, 언어 전환을 검증하는 React 테스트를 추가한다.**
- [x] **Step 3: `npm test`, `npm run typecheck`, `npm run build`를 순서대로 실행한다.**
- [x] **Step 4: 로컬 브라우저에서 초기 메뉴와 WebGL 장면을 확인한다.**
- [x] **Step 5: README의 실행법과 소스 구성을 새 구조로 갱신한다.**

## Self-Review

- Spec coverage: TypeScript, React, React Three Fiber 모두 각 Task 1~3의 검증 가능한 산출물로 포함한다.
- Placeholder scan: 구현 단계는 모두 대상 파일과 검증 명령을 명시하며 미정 항목이 없다.
- Type consistency: `Mode`, `Difficulty`, `GameInput`, `GameState`가 엔진, React, R3F, 테스트의 공통 계약이다.
