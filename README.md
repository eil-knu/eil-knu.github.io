# 에너지정보처리연구실 홈페이지

국립공주대학교 에너지정보처리연구실(Energy Informatics Laboratory) 홈페이지입니다.
GitHub Pages로 공개되며(https://eil-knu.github.io/), 논문·특허·과제·소식·구성원 목록은 이 저장소의 `data/*.csv`에서 읽습니다.

## 내용 고치는 법

**학생들은 [관리자 페이지](https://script.google.com/macros/s/AKfycbyoMLqbDYz_oT131k6zgm1seYkNvoy2-viidlSvNokEQOlJDMcqoEf2CvJerCFEu_Mf5Q/exec)만 쓰면 됩니다** (홈페이지 맨 아래 '관리자' 링크). 구글 계정으로 로그인해 소식·구성원·논문·특허·과제를 올리고, 고치고, 지웁니다.
저장하면 이 저장소에 바로 커밋되고, 홈페이지에는 1~2분 뒤 반영됩니다. 사진도 관리자 페이지에서 올리면 자동으로 줄여서 저장합니다.

| 바꾸고 싶은 것 | 하는 곳 |
|---|---|
| 소식, 구성원, 논문, 특허, 과제 (사진·기관 로고 포함) | 관리자 페이지 |
| 비어 있는 칸(과제 총 연구비, 특허 출원인) | 관리자 페이지 → 채워야 할 항목 |
| IF · JCR 상위% | 입력하지 않음 → 아래 "IF · JCR 갱신" (Claude에게 요청) |
| 관리자 추가·삭제 | Apps Script 프로젝트 설정 → 스크립트 속성 `ADMINS`에서 이메일을 넣거나 지움 (바로 적용) |
| 소개 문구, 교수 약력, 연구 분야 그림 | `src/*.html` 수정 후 `python scripts/build.py` (교수님) |

- **실적원장**(구글 시트)은 이제 결과물입니다. 저장소 데이터로 매시간 논문·특허·과제 탭이 다시 만들어지니 시트를 직접 고치지 마세요.
- `홈페이지 표시`가 `Y`인 행만 사이트에 나옵니다. 관리자 페이지의 '홈페이지에 표시'를 끄면 원장에는 남고 홈페이지에서만 빠집니다.
- 과제의 `총 연구비 (천원)`·`비고`는 원장용이며 홈페이지에는 표시되지 않습니다(저장소는 공개입니다).
- 실수로 지우거나 고쳐도 GitHub 커밋 기록으로 되돌릴 수 있습니다. 커밋 메시지에 저장한 사람의 이메일이 남습니다.

## 데이터 파일 (`data/*.csv`)

첫 줄은 열 제목이며, 사이트는 **열 이름**으로 읽습니다(순서는 상관없음).

- `papers.csv`: `ID, 구분, 연도, 월, 논문 제목, 저자, 본인 역할, 저널·학회명, Vol., No., 페이지/Art. No., 게재일, ISSN/ISBN, DOI, 등재 구분, 홈페이지 표시, IF(최신), JCR 상위%(최신), IF(출판연도), JCR 상위%(출판연도)`
  - ID 머리글: 국제 저널 `IJ`, 국제 학술대회 `IC`, 국내 저널 `DJ`, 국내 학술대회 `DC`
  - 저자 표기: `¹` 공동 제1저자, `*` 교신저자. `본인 역할`은 저자에서 자동 계산합니다.
  - 상위%는 JCR JIF Percentile 기준(`100 − Percentile`), 분야가 여럿이면 가장 유리한 분야.
- `patents.csv`: `ID, 구분, 상태, 국가, 발명의 명칭, 발명자, 출원번호, 출원일, 등록번호, 등록일, 출원인(권리자), 링크, 홈페이지 표시`
- `projects.csv`: `ID, 과제명(국문), 과제명(영문), 사업명, 전문기관, 기관 마크, 시작, 종료, 역할, 총 연구비 (천원), 비고, 홈페이지 표시`
  - `기관 마크`는 `assets/img/agency/<이름>.png`의 이름입니다(예: `nrf`).
- `news.csv`: `ID, 날짜, 제목, 사진, 링크, 홈페이지 표시` — 사진은 `;`로 구분, 첫 사진이 대표 사진
- `members.csv`: `ID, 상태(재학/졸업), 과정, 이름, 영문 이름, 연구 분야, 이메일, 사진, 비고, 홈페이지 표시`

사진 칸에 파일 이름을 적으면 `assets/img/news/`(구성원은 `people/`)의 사진을 씁니다. 전체 주소나 구글 드라이브 공유 링크도 됩니다.

## IF · JCR 갱신 (Claude에게 요청)

JCR은 학교 네트워크에서만 열리고 관리자 페이지에서는 입력하지 않습니다. 필요할 때(보통 매년 6~7월 JCR 발표 뒤, 또는 새 국제 저널 논문이 'JCR 대기'일 때)
**학교 네트워크에 연결된 PC**의 Claude Code에서 이 저장소를 열고 다음처럼 요청합니다.

> eil-knu.github.io 저장소 README의 "IF · JCR 갱신" 규칙대로 papers.csv의 IF·JCR을 갱신하고 커밋·푸시해줘.

**규칙**
1. 대상: `구분`이 `국제 저널`이고 `등재 구분`이 `SCIE`인 논문.
2. JCR 학술지 페이지: `https://jcr.clarivate.com/jcr-jp/journal-profile?journal=<JCR 약어>&year=<JCR 연도>`
3. `IF(최신)`: 가장 최근 JCR 연도의 JIF.
4. `JCR 상위%(최신)`: `100 − JIF Percentile`(소수 첫째 자리). **분야가 여러 개면 Percentile이 가장 높은(유리한) 분야.** 예: JIF Percentile 94.4 → `5.6`
5. `IF(출판연도)`·`JCR 상위%(출판연도)`: 논문 출판 연도의 JCR 값(같은 규칙). 아직 발표되지 않은 연도는 비워 둡니다.
6. 같은 학술지 논문은 모두 같은 값으로 맞춥니다. 새 학술지는 아래 표에 약어를 추가합니다.

| 학술지 | JCR 약어 |
|---|---|
| IEEE Transactions on Instrumentation and Measurement | IEEE T INSTRUM MEAS |
| IEEE Transactions on Industrial Electronics | IEEE T IND ELECTRON |
| IEEE Transactions on Applied Superconductivity | IEEE T APPL SUPERCON |
| IEEE Transactions on Power Delivery | IEEE T POWER DELIVER |
| IEEE Sensors Journal | IEEE SENS J |
| Measurement | MEASUREMENT |
| Electric Power Systems Research | ELECTR POW SYST RES |
| Applied Sciences | APPL SCI-BASEL |
| Energies | ENERGIES |
| Physica C: Superconductivity and its Applications | PHYSICA C |

현재 값은 JCR 2025 기준입니다(2026-11 갱신).

## 관리자 페이지 (`apps-script/`)

주소: https://script.google.com/macros/s/AKfycbyoMLqbDYz_oT131k6zgm1seYkNvoy2-viidlSvNokEQOlJDMcqoEf2CvJerCFEu_Mf5Q/exec

처음 들어가면 "Google에서 확인하지 않은 앱" 경고가 나옵니다. **고급 → EIL 관리자(으)로 이동 → 허용**을 누르면 됩니다(연구실이 직접 만든 앱이라 나오는 경고). "접근 권한이 없습니다"가 나오면 화면에 보이는 이메일을 교수님께 알려 `ADMINS`에 추가합니다.

**화면(`Index.html`)은 접속할 때마다 이 저장소에서 읽어 오므로, 고쳐서 커밋만 하면 바로 반영됩니다.** 서버 코드(`Code.gs`)를 고쳤을 때만 Apps Script 편집기에 다시 붙여 넣고 **배포 → 배포 관리 → 수정(연필) → 버전: 새 버전 → 배포**를 합니다(주소는 그대로).

Google Apps Script 웹 앱입니다. `Code.gs`(서버)와 `Index.html`(화면) 두 파일을 Apps Script 프로젝트에 붙여 넣어 배포합니다.

**스크립트 속성** (프로젝트 설정 → 스크립트 속성)
- `GITHUB_TOKEN`: 이 저장소만 `Contents: Read and write` 권한을 가진 GitHub fine-grained 토큰. 코드나 저장소에 적지 마세요.
- `ADMINS`: 들어올 수 있는 구글 계정 이메일, 쉼표로 구분.

**배포**: 배포 → 새 배포 → 웹 앱, 실행 사용자 "웹 앱에 액세스하는 사용자", 액세스 권한 "Google 계정이 있는 모든 사용자".

**교수님 계정에서 편집기로 한 번 실행**
1. `importLedgerPrivate` — 원장에만 있던 연구비·비고·출원인을 저장소로 옮김(처음 한 번)
2. `syncLedger` — 원장 갱신 (처음 실행 때 원장 백업 사본을 드라이브에 만듦)
3. `installTrigger` — 매시간 원장 갱신 예약

`Index.html`을 내 컴퓨터에서 열면(`http://localhost:8000/apps-script/Index.html`) 저장되지 않는 미리보기 모드로 화면을 확인할 수 있습니다.

## 폴더 구조

```
index.html …           # 생성된 페이지 (직접 고치지 말고 src/를 고친 뒤 build)
src/                   # 페이지 본문
scripts/build.py       # 공통 머리글·바닥글을 붙여 페이지 생성
data/                  # 목록 데이터 (원본)
apps-script/           # 관리자 페이지 (Google Apps Script)
assets/css, js, img    # 스타일, 스크립트, 이미지
```

## 내 컴퓨터에서 미리 보기

```bash
python -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다.
