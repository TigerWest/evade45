# EVADE 45 · 1인칭 3D 드론 생존 체험

지상 시점에서 도보·오토바이·경장갑차로 45초간 드론을 피하는 한국어·영어 3D 웹게임. TypeScript와 React로 UI·게임 상태를 관리하고 React Three Fiber/Three.js로 전장, 차량 조종석, 이동하는 드론을 렌더링합니다.

[게임 플레이](https://tigerwest.github.io/evade45/) · [GitHub 저장소](https://github.com/TigerWest/evade45)

## 실행

```sh
npm ci
npm run build
npm run dev
```

http://127.0.0.1:5173/evade45/ 에 접속합니다. Node.js 22.12 이상을 권장합니다. `npm run build`가 Vite 기반 정적 산출물을 `dist/`에 생성하며 게임 코드는 외부 CDN을 호출하지 않습니다.

## GitHub Pages 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 의존성을 설치하고 포맷·lint·타입·테스트·빌드를 검증한 뒤 `dist/`를 GitHub Pages에 배포합니다. Actions 화면에서 수동 실행할 수도 있습니다.

Vite의 `base`는 프로젝트 주소에 맞춘 `/evade45/`입니다. 저장소의 Settings → Pages → Source는 GitHub Actions를 사용합니다.

## 방문 통계

Google Analytics 4의 기존 `BeomSeo > DEAD AIR` 속성과 `DEAD AIR Web` 스트림을 사용합니다. 측정 ID는 `G-QKQN09HT0S`이며 태그 원본은 루트 `index.html`에 있습니다. Analytics 관리 화면의 속성·스트림 이름과 URL은 이번 코드 변경으로 수정되지 않습니다.

태그는 `tigerwest.github.io`의 `/evade45/` 경로에서만 로드되어 로컬 개발 접속은 집계하지 않습니다. 페이지 주소에서는 쿼리 문자열과 해시를 제외합니다. 기본 페이지 조회 및 GA4 향상된 측정을 사용하며 게임별 맞춤 이벤트는 추가하지 않았습니다.

## 조작

- **도보**: WASD 이동, 마우스 시선, Shift 전력 질주, Space 도보 점프
- **오토바이 / 경장갑차**: W/S 전진·후진, A/D 조향, 마우스 시선, Shift 가속
- **방향키**: 마우스 대신 시선 조작
- **Esc**: 일시정지 및 마우스 잠금 해제
- **모바일**: 왼쪽 조이스틱 이동, 오른쪽 화면 드래그 시선, 가속 버튼과 도보 점프 버튼
- **마우스 잠금이 제한된 내장 브라우저**: 화면 드래그로 시선을 조작할 수 있습니다.
- **소리**: 플레이 시작 시 활성화됩니다. 상단 SOUND 버튼으로 끌 수 있습니다.

드론은 감속 없이 연속 접근하며, 선회 가속도를 제한한 게임용 관성 모델로 방향을 바꿉니다. 가까워지면 진로가 고정되고 빗나간 경우 관성대로 통과합니다. 점프는 체력과 재사용 시간을 소모하며 무적 효과가 없습니다. 도보와 오토바이는 한 번 피격되면 실패합니다. 경장갑차는 첫 피격을 버티고 두 번째에 실패합니다. 건물, 폐차, 낮은 벽은 이동을 막습니다. 전장 경계에서 돌아서야 합니다. 탭 전환과 창 포커스 상실 시 자동 일시정지합니다.

헤드폰으로 방향·거리에 따른 드론 모터음을 들을 수 있습니다. 발소리, 호흡, 차량 엔진음, 근접 심박음, 도플러 변화, 근접 통과음 및 충돌음을 합성합니다. 조작 방법에서 카메라 흔들림을 줄일 수 있으며 운영체제의 동작 줄이기 설정도 따릅니다.

## 언어와 문구

상단 언어 선택에서 한국어와 영어를 전환합니다. 저장한 선택을 우선 적용하며, 처음 방문하면 브라우저의 언어 목록에서 지원하는 언어를 선택합니다. 지원 언어가 없으면 영어를 사용합니다. 언어 선택은 이 기기의 브라우저에 저장됩니다. 저장소 사용이 차단되어도 현재 화면의 언어는 전환할 수 있습니다. 플레이 중 언어 메뉴를 열면 일시정지하며 진행 상태는 유지됩니다.

문구는 `src/i18n.ts`의 `ko`·`en` 사전에서 관리합니다. React 컴포넌트가 결과·경고·오류 문구와 접근성 레이블을 같은 사전에서 렌더링합니다. 고유 이름, 키 이름, 단위, 나침반 표기는 공통으로 사용합니다.

## 구성

- `src/App.tsx`: React 메뉴·HUD·모달, 키보드·포인터·터치 입력, 일시정지 및 UI 상태
- `src/components/GameCanvas.tsx`: React Three Fiber `Canvas`와 WebGL 렌더러 설정
- `src/components/scene/GameScene.tsx`: 선언적 장면 조립과 순수 게임 엔진 프레임 연결
- `src/components/scene/Environment.tsx`: JSX로 선언한 하늘·안개·광원·연기·먼지
- `src/components/scene/Battlefield.tsx`: 절차적으로 생성한 정적 전장 모델의 R3F 생명주기
- `src/components/scene/PlayerRig.tsx`: 카메라·도보 팔·차량 조종석 애니메이션
- `src/components/scene/DroneField.tsx`, `CombatEffects.tsx`: 드론 풀과 충돌 이펙트의 독립 프레임 시스템
- `src/game/engine.ts`: 타입이 지정된 이동, 차량 관성, 3D 드론 추적·급강하, 충돌 및 생존 판정
- `src/game/world.ts`: 씬을 직접 변경하지 않는 정적 전장·드론 모델 팩토리
- `src/game/cockpit.ts`: 카메라와 씬에 직접 결합하지 않는 도보 팔·오토바이·경장갑차 모델 팩토리
- `src/game/audio.ts`: Web Audio 방향음과 효과음
- `src/i18n.ts`: 한국어·영어 문구와 언어 결정
- `tests/engine.test.ts`, `tests/cockpit.test.ts`, `tests/i18n.test.ts`: 게임·3D·번역 회귀 테스트
- `tests/app.test.tsx`: React 메뉴, 설정, 언어 전환, 게임 시작 통합 테스트

## 검증

```sh
npm run format:check
npm run lint
npm test
npm run typecheck
npm run build
```

`npm run format`은 Prettier로 파일을 정리하고, `npm run lint:fix`는 자동 수정 가능한
ESLint 오류를 고칩니다. `npm run check`는 포맷, lint, 타입, 테스트, 빌드를 모두 검사합니다.

승패, 피격, 장갑, 위/아래 공간 판정, 급강하 회피, 카메라 상대 이동, 차량 조향, 가속 에너지, 건물·경계 충돌을 검증합니다.

3D 그래픽은 절차적으로 제작한 스타일화된 장면입니다. 이동·추적·방호 수치는 가상의 게임 설정이며, 실제 군사 장비의 성능이나 생존 가능성을 재현하지 않습니다.

## 라이선스

Three.js는 MIT 라이선스이며 `dist/vendor/THREE-LICENSE.txt`에 원문을 포함합니다.

## 속도 참고와 해석 범위

- 연습: 16m/s (약 58km/h). [DJI Avata 2 공식 사양](https://www.dji.com/avata-2/specs)의 Sport 최고 속도 참고.
- 보통: 27m/s (약 97km/h). 동일 문서의 Manual 최고 속도 참고. 제조사 시험 조건은 무풍·해수면에 준하며 EU Manual 제한은 19m/s.
- 어려움: 약 140km/h. [DJI FPV 공식 발표](https://www.dji.com/newsroom/news/dji-reinvents-the-drone-flying-experience-with-the-dji-fpv)의 최고 속도 참고.

확인일: 2026-09-18. 민간 기체의 속도 상한만 참고하며 외형·선회 성능을 해당 기체와 동일하게 재현하지 않습니다. 군용·개조 FPV의 대표 사양이나 검증된 전장 생존 시뮬레이션이 아닙니다. 실제 드론이 물리적으로 제동 불가능하다는 뜻이 아니라, 감속하지 않는 가상의 접근 상황입니다. 조향 가속도·추적·돌진 전환 거리·발사 위치·인체 이동·점프·충돌 체적·장갑은 게임 설계값입니다. 폭발·파편·조종사 행동·환경 변화는 정밀 모사하지 않습니다. 점프가 실제 회피 방법이라는 근거는 제공하지 않습니다.

시뮬레이션은 최대 1/120초 간격으로 적분하며 15Hz와 120Hz 입력 프레임에서 시간과 이동 거리가 일치하는지 검사합니다. 고속 이동은 경로를 세분해 충돌 누락을 방지합니다.

드론 생성 시 건물·지붕·벽을 포함한 3D 접근 구간을 검사하고 막힌 방향 대신 가까운 열린 방향을 선택합니다. 접근 구간이 모두 막히면 0.5초 뒤 다시 검사합니다. 생성 이후에는 일반 충돌 판정이 적용되므로 이동 중 엄폐물 뒤로 들어가면 드론이 장애물에 충돌할 수 있습니다. 이는 게임 생성 규칙이며 실제 기체의 장애물 회피 기능을 모사하지 않습니다. 모든 이동 수단·난이도에서 24방향 접근과 건물 주변·전장 가장자리의 무작위 생성을 검증합니다.
