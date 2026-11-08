/**
 * EIL 관리자 페이지 (Google Apps Script 웹 앱)
 *
 * - 로그인: 구글 계정. 스크립트 속성 ADMINS에 등록된 이메일만 들어올 수 있습니다.
 * - 저장: GitHub 저장소(eil-knu/eil-knu.github.io)의 data/*.csv와 사진을 바로 고칩니다.
 *         토큰은 스크립트 속성 GITHUB_TOKEN에 보관합니다(코드에 적지 않습니다).
 * - 실적원장: syncLedger()가 저장소 데이터로 원장의 논문·특허·과제 탭을 다시 만듭니다(매시간 트리거).
 *
 * 배포 설정: 실행 사용자 = "웹 앱에 액세스하는 사용자", 액세스 권한 = "Google 계정이 있는 모든 사용자".
 */

var REPO = 'eil-knu/eil-knu.github.io';
var BRANCH = 'main';
var LEDGER_ID = '1WIOpraTPjBLxHhzIMeyAW7FGneSw9poE4nHvH5KJbSM';

var DATASETS = {
  papers:   { file: 'data/papers.csv',   tab: '논문', top: true },
  patents:  { file: 'data/patents.csv',  tab: '특허', top: true },
  projects: { file: 'data/projects.csv', tab: '과제', top: true },
  news:     { file: 'data/news.csv' },
  members:  { file: 'data/members.csv' }
};
// 관리자 페이지에서 고칠 수 없는 열(학교 네트워크에서 따로 채움)
var JCR_COLS = ['IF(최신)', 'JCR 상위%(최신)', 'IF(출판연도)', 'JCR 상위%(출판연도)'];
var PAPER_PREFIX = { '국제 저널': 'IJ', '국제 학술대회': 'IC', '국내 저널': 'DJ', '국내 학술대회': 'DC' };
var ID_PREFIX = { patents: 'PT', projects: 'PR', news: 'NW', members: 'MB' };
// 실적원장에는 넣지 않는 열(홈페이지 전용)
var LEDGER_SKIP = ['홈페이지 표시', '기관 마크'];
// 원장 모양을 바꾸면 이 값을 올립니다(데이터가 그대로여도 다시 만듦)
var LEDGER_FORMAT = '4';

/* ---------------- 웹 앱 ---------------- */

function doGet() {
  var email = me_();
  if (!isAdmin_(email)) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;max-width:420px;margin:80px auto;line-height:1.7">' +
      '<h2 style="color:#1D2760">접근 권한이 없습니다</h2>' +
      '<p>' + (email ? esc_(email) + ' 계정은 관리자로 등록되어 있지 않습니다.' : '구글 계정 정보를 확인할 수 없습니다.') +
      '<br>교수님께 이메일 등록을 요청하세요.</p></div>').setTitle('홈페이지 관리 | 에너지정보처리연구실');
  }
  // 화면(Index.html)과 데이터를 GitHub에서 한꺼번에 읽어 페이지에 넣습니다.
  // 화면만 고칠 때는 다시 배포할 필요가 없습니다. GitHub을 못 읽으면 이 프로젝트의 Index 파일을 씁니다.
  var t, boot = null;
  try {
    var all = loadAll_(true);
    t = HtmlService.createTemplate(all.index);
    delete all.index;
    boot = all;
  } catch (e) {
    t = HtmlService.createTemplateFromFile('Index');
  }
  t.boot = boot ? JSON.stringify(boot).replace(/</g, '\\u003c') : '';
  t.email = email;
  return t.evaluate().setTitle('홈페이지 관리 | 에너지정보처리연구실')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)   // eil-knu.github.io/admin.html 안에 넣어 쓰기
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 편집기·시간 트리거로 실행할 때만 허용(관리자 계정). */
function ownerOnly_() {
  var e = me_();
  if (e && !isAdmin_(e)) throw new Error('관리자만 실행할 수 있습니다.');
}
function me_() { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
function admins_() {
  return String(PropertiesService.getScriptProperties().getProperty('ADMINS') || '')
    .toLowerCase().split(/[\s,;]+/).filter(String);
}
function isAdmin_(email) { return !!email && admins_().indexOf(email) >= 0; }
function guard_() {
  var e = me_();
  if (!isAdmin_(e)) throw new Error('관리자로 등록되지 않은 계정입니다.');
  return e;
}
/** 커밋 메시지용: kgy765@gmail.com → kgy***@gmail.com */
function who_(email) { return String(email).replace(/^(.{1,3})[^@]*(@.*)$/, '$1***$2'); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---------------- 화면에서 부르는 함수 ---------------- */

/** 모든 데이터와 등록된 기관 로고 목록을 돌려줍니다. */
function apiLoad() {
  guard_();
  return loadAll_(false);
}

function loadAll_(withIndex) {
  var keys = Object.keys(DATASETS);
  var paths = keys.map(function (k) { return '/contents/' + DATASETS[k].file + '?ref=' + BRANCH; })
    .concat(['/contents/assets/img/agency?ref=' + BRANCH]);
  if (withIndex) paths.push('/contents/apps-script/Index.html?ref=' + BRANCH);
  var res = ghAll_(paths);   // 병렬
  var out = { data: {}, logos: [] };
  keys.forEach(function (k, i) { out.data[k] = csvFromContents_(res[i]); });
  out.logos = (res[keys.length] || []).filter(function (f) { return /\.png$/i.test(f.name); })
    .map(function (f) { return f.name.replace(/\.png$/i, ''); });
  if (withIndex) out.index = decode_(res[keys.length + 1].content);
  return out;
}

function decode_(b64) { return Utilities.newBlob(Utilities.base64Decode(String(b64).replace(/\s/g, ''))).getDataAsString('UTF-8'); }

/**
 * 한 줄 저장(추가 또는 수정).
 * row: 열 이름 → 값. ID가 비어 있으면 새로 번호를 붙입니다.
 * uploads: [{ path: 'assets/img/news/nw009_1.jpg', base64: '...' }] 사진 파일.
 */
function apiSave(dataset, row, uploads) {
  var email = guard_();
  var spec = DATASETS[dataset];
  if (!spec) throw new Error('알 수 없는 항목: ' + dataset);
  uploads = uploads || [];
  if (uploads.length > 20) throw new Error('사진은 한 번에 20장까지 올릴 수 있습니다.');
  uploads.forEach(function (u) {
    checkUploadPath_(u.path);
    if (String(u.base64 || '').length > 8 * 1024 * 1024) throw new Error('사진 한 장이 너무 큽니다.');
  });
  var saved, table;
  commitWithRetry_(function (head) {
    var t = table = readCsv_(spec.file, head);
    var rows = t.rows, cols = t.head;
    var idx = row.ID ? findIndex_(rows, row.ID) : -1;
    var cur = idx >= 0 ? rows[idx] : {};
    var next = {};
    cols.forEach(function (c) { next[c] = c in row ? clean_(row[c]) : (cur[c] || ''); });
    ['DOI', '링크'].forEach(function (c) {
      if (next[c] && !/^https?:\/\//i.test(next[c]) && !/^10\.\d{4,}\//.test(next[c])) throw new Error(c + ' 칸에는 https://로 시작하는 주소만 넣을 수 있습니다.');
    });
    if (dataset === 'papers') {
      JCR_COLS.forEach(function (c) { next[c] = cur[c] || ''; });   // JCR은 손대지 않음
      var moved = idx >= 0 && String(cur['저널·학회명']).toLowerCase() !== String(next['저널·학회명']).toLowerCase();
      if (moved) JCR_COLS.forEach(function (c) { next[c] = ''; });     // 학술지를 바꾸면 이전 JCR은 버림
      if (idx < 0 || moved) fillJcrFromJournal_(next, rows);           // 같은 학술지 최신 값 복사
      next['본인 역할'] = role_(next['저자']);
    }
    if (dataset === 'patents' && !next['링크'] && next['상태'] === '등록' && next['국가'] === '대한민국'
        && /^10-\d{4}-\d{7}$/.test(next['출원번호'])) {
      next['링크'] = 'https://doi.org/10.8080/' + next['출원번호'].replace(/-/g, '');   // 특허청 DOI
    }
    if (idx < 0 && dataset === 'papers' && next.DOI) {
      var key = next.DOI.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();
      rows.forEach(function (r) {
        if (String(r.DOI).toLowerCase().indexOf(key) >= 0) throw new Error('이미 등록된 논문입니다 (' + r.ID + ').');
      });
    }
    if (idx < 0) {
      next.ID = nextId_(dataset, next, rows);
      if (spec.top) rows.unshift(next); else rows.push(next);
    } else {
      rows[idx] = next;
    }
    saved = next;
    var files = [{ path: spec.file, text: toCsv_(cols, rows) }];
    (uploads || []).forEach(function (u) { files.push({ path: u.path, base64: u.base64 }); });
    return { files: files, message: '관리자: ' + label_(dataset) + ' ' + (idx < 0 ? '추가' : '수정') + ' ' + next.ID + ' (' + who_(email) + ')' };
  });
  return { row: saved, data: table };
}

/** 한 줄 삭제. */
function apiDelete(dataset, id) {
  var email = guard_();
  var spec = DATASETS[dataset], table;
  commitWithRetry_(function (head) {
    var t = table = readCsv_(spec.file, head);
    var i = findIndex_(t.rows, id);
    if (i < 0) throw new Error(id + '를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
    t.rows.splice(i, 1);
    return { files: [{ path: spec.file, text: toCsv_(t.head, t.rows) }],
             message: '관리자: ' + label_(dataset) + ' 삭제 ' + id + ' (' + who_(email) + ')' };
  });
  return { data: table };
}

/** 기관 로고만 올리기. key: 영문 소문자 (예: keit) */
function apiUploadLogo(key, base64) {
  var email = guard_();
  if (!/^[a-z0-9-]{2,20}$/.test(key)) throw new Error('로고 이름은 영문 소문자·숫자로 적어 주세요 (예: keit).');
  commitWithRetry_(function () {
    return { files: [{ path: 'assets/img/agency/' + key + '.png', base64: base64 }],
             message: '관리자: 기관 로고 ' + key + ' (' + who_(email) + ')' };
  });
  return key;
}

/** 기관 로고 지우기. 그 로고를 쓰는 과제가 있으면 막습니다. */
function apiDeleteLogo(key) {
  var email = guard_();
  if (!/^[a-z0-9-]{2,20}$/.test(key)) throw new Error('로고 이름이 올바르지 않습니다.');
  commitWithRetry_(function (head) {
    var used = readCsv_(DATASETS.projects.file, head).rows
      .filter(function (r) { return r['기관 마크'] === key; }).map(function (r) { return r.ID; });
    if (used.length) throw new Error('이 로고를 쓰는 과제가 있어 지울 수 없습니다: ' + used.join(', ') + '. 그 과제의 로고를 먼저 바꿔 주세요.');
    return { files: [{ path: 'assets/img/agency/' + key + '.png', del: true }],
             message: '관리자: 기관 로고 삭제 ' + key + ' (' + who_(email) + ')' };
  });
  return key;
}

/** DOI로 논문 정보 가져오기 (Crossref). */
function apiCrossref(doi) {
  guard_();
  doi = String(doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,}\//.test(doi)) throw new Error('DOI 형식이 아닙니다 (예: 10.1109/TIM.2026.1234567).');
  var res = UrlFetchApp.fetch('https://api.crossref.org/works/' + encodeURIComponent(doi),
    { muteHttpExceptions: true, headers: { 'User-Agent': 'eil-admin/1.0' } });
  if (res.getResponseCode() !== 200) throw new Error('DOI를 찾지 못했습니다. 직접 입력해 주세요.');
  var w = JSON.parse(res.getContentText()).message;
  // 게재일: 인쇄(호) 발행일이 있으면 그 날짜(일이 없으면 1일), 온라인 게재일보다 이르면 온라인 날짜 — 둘 중 늦은 날
  var dp_ = function (k) { return (((w[k] || {})['date-parts'] || [[]])[0] || []).filter(function (x) { return x; }); };
  var po = dp_('published-online'), pp = dp_('published-print');
  var online = po.length === 3 ? po[0] + '-' + pad_(po[1]) + '-' + pad_(po[2]) : String((w.created || {})['date-time'] || '').slice(0, 10);
  var date = pp.length >= 2 ? pp[0] + '-' + pad_(pp[1]) + '-' + pad_(pp[2] || 1) : '';
  if (!date || online > date) date = online;
  var issued = ((w.issued || {})['date-parts'] || [[]])[0];
  var page = w['article-number'] ? 'Art. ' + w['article-number'] : (w.page ? (/-/.test(w.page) ? 'pp. ' + w.page.replace('-', '–') : 'Art. ' + w.page) : '');
  return {
    kind: w.type === 'proceedings-article' ? '국제 학술대회' : '국제 저널',
    title: (w.title || [''])[0].replace(/\s+/g, ' ').trim(),
    journal: (w['container-title'] || [''])[0],
    year: issued[0] ? String(issued[0]) : '',
    month: issued[1] ? String(issued[1]) : '',
    volume: w.volume || '', issue: w.issue || (w.type === 'journal-article' ? '-' : ''), page: page, date: date,
    issn: (w.ISSN || w.ISBN || [''])[0],
    doi: 'https://doi.org/' + w.DOI,
    authors: (w.author || []).map(function (a) { return a.family ? initials_(a.given) + a.family : (a.name || ''); })
  };
}

/**
 * 특허 번호로 정보 가져오기 (Google Patents 공개 기록).
 * 받는 형식: 10-2984629(국내 등록), 10-2020-0164721(국내 출원), US 11,609,258, WO2019/083144,
 *           PCT/KR2018/009811, AT527561B1 같은 공개번호, Google Patents 주소.
 */
function apiPatent(q) {
  guard_();
  var id = patentId_(q);
  if (!id) throw new Error('번호 형식을 알아보지 못했습니다. 예: 10-2984629, 10-2020-0164721, US 11,609,258');
  var html = fetchPatentPage_(id);
  if (!html) throw new Error('공개된 기록이 없습니다. 출원 후 공개(보통 18개월) 전이면 직접 입력하세요.');
  return parsePatent_(id, html);
}

function gp_(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  var code = r.getResponseCode();
  if (code === 429 || code === 503) throw new Error('Google Patents가 잠시 응답하지 않습니다. 1~2분 뒤 다시 시도하세요.');
  return code === 200 ? r.getContentText() : null;
}

function fetchPatentPage_(id) {
  var tries = /[A-Z]\d?$/.test(id) ? [id] : [id + 'B1', id + 'B2', id + 'A1', id + 'A'];
  for (var i = 0; i < tries.length; i++) {
    var h = gp_('https://patents.google.com/patent/' + tries[i]);
    if (h) return h;
  }
  return null;
}

/** 입력을 Google Patents 문서 번호로 바꿉니다. 출원번호는 검색해서 찾습니다. */
function patentId_(q) {
  q = String(q || '').trim();
  var m;
  if ((m = q.match(/patents\.google\.com\/patent\/([A-Z]{2}[0-9A-Z]+)/i))) return m[1].toUpperCase();
  var s = q.replace(/[\s,]/g, '').toUpperCase();
  if ((m = s.match(/^10-?(\d{7})(-0{4})?$/))) return 'KR10' + m[1];                    // 국내 등록번호
  if ((m = s.match(/^US(\d{7,8})$/)) || (m = s.match(/^(\d{1,2}\d{6})$/))) return 'US' + m[1];
  if ((m = s.match(/^WO(\d{4})\/?(\d{6})$/))) return 'WO' + m[1] + m[2];
  if (/^[A-Z]{2}\d{5,}[A-Z]\d?$/.test(s)) return s;                                    // 이미 공개번호
  var key = null;
  if ((m = s.match(/^10-?(\d{4})-?(\d{7})$/))) key = 'KR10' + m[1] + m[2];             // 국내 출원번호
  else if ((m = s.match(/^PCT\/?([A-Z]{2})(\d{4})\/?(\d{6})$/))) key = 'PCT/' + m[1] + m[2] + '/' + m[3];
  if (!key) return null;
  var j = gp_('https://patents.google.com/xhr/query?url=' + encodeURIComponent('q=' + key) + '&exp=');
  if (!j) return null;
  try {
    var list = [];
    (JSON.parse(j).results.cluster || []).forEach(function (c) { (c.result || []).forEach(function (r) { list.push(r.patent.publication_number); }); });
    var want = key.indexOf('PCT') === 0 ? /^WO/ : /^KR/;
    return list.filter(function (p) { return want.test(p); })[0] || list[0] || null;
  } catch (e) { return null; }
}

function parsePatent_(id, h) {
  var all = function (re) { var out = [], m; while ((m = re.exec(h))) out.push(m[1].replace(/\s+/g, ' ').trim()); return out; };
  var one = function (re) { return all(re)[0] || ''; };
  var pub = one(/<dd itemprop="publicationNumber"[^>]*>([^<]+)</g) || id;
  var cc = pub.slice(0, 2);
  var country = { KR: '대한민국', US: '미국', WO: 'PCT', AT: '오스트리아', JP: '일본', CN: '중국', EP: '유럽', DE: '독일' }[cc] || cc;
  var title = one(/<span itemprop="title">([\s\S]*?)<\/span>/g);
  var inventors = all(/<dd itemprop="inventor"[^>]*>([^<]+)</g);
  var owners = all(/<dd itemprop="assigneeOriginal"[^>]*>\s*([^<]+?)\s*</g);
  var appNo = one(/<dd itemprop="applicationNumber"[^>]*>([^<]+)</g);
  var filed = one(/<time itemprop="filingDate"[^>]*>([^<]+)</g);
  var granted = '';
  var ev = /<dd itemprop="events"[^>]*>([\s\S]*?)<\/dd>/g, m;
  while ((m = ev.exec(h))) {
    var t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (/Application granted/.test(t)) granted = (t.match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
  }
  var isGrant = /B\d?$/.test(pub) || !!granted;
  var korean = /[가-힣]/.test(inventors.join(''));
  return {
    '구분': cc === 'KR' ? '국내' : '국외',
    '상태': isGrant ? '등록' : '출원',
    '국가': country,
    '발명의 명칭': title,
    '발명자': korean ? joinKo_(inventors) : joinEn_(inventors.map(enName_)),
    '출원번호': fmtAppNo_(appNo),
    '출원일': filed,
    '등록번호': isGrant ? fmtRegNo_(pub) : '',
    '등록일': isGrant ? granted : '',
    '출원인(권리자)': owners.join('; '),
    '링크': cc === 'KR' && /^KR10\d{11}/.test(appNo) ? 'https://doi.org/10.8080/' + appNo.slice(2, 15) : 'https://patents.google.com/patent/' + pub
  };
}

function joinKo_(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' 및 ' + a[a.length - 1]; }
function joinEn_(a) { return a.length < 2 ? a.join('') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; }
/** "Chang Kyu Jung" / "JUNG Chang-kyu" → "C.-K. Jung" */
function enName_(n) {
  var p = String(n).replace(/,/g, ' ').trim().split(/\s+/);
  if (p.length < 2) return n;
  var fam, given;
  var famFirst = (p[0] === p[0].toUpperCase() && p[0].length > 1 && p.slice(1).join('') !== p.slice(1).join('').toUpperCase())
    || (p.length === 2 && /-/.test(p[1]) && !/-/.test(p[0]));   // 'Jung Chae-kyun'처럼 성이 앞
  if (famFirst) { fam = p[0]; given = p.slice(1); }
  else { fam = p[p.length - 1]; given = p.slice(0, -1); }
  var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
  var parts = given.join('-').split('-').filter(String);
  return parts.map(function (w) { return w.charAt(0).toUpperCase() + '.'; }).join('-') + ' ' + cap(fam);
}
function fmtAppNo_(a) {
  var m;
  if ((m = a.match(/^KR10(\d{4})(\d{7})/))) return '10-' + m[1] + '-' + m[2];
  if ((m = a.match(/^([A-Z]{2})(\d{4})(\d{6})W$/))) return 'PCT/' + m[1] + m[2] + '/' + m[3];
  if ((m = a.match(/^US\s?(\d{2})\/?(\d{3}),?(\d{3})/))) return 'US ' + m[1] + '/' + m[2] + ',' + m[3];
  if ((m = a.match(/^ATA(\d+\/\d{4})/))) return 'A ' + m[1];
  return a;
}
function fmtRegNo_(p) {
  var m;
  if ((m = p.match(/^KR10(\d{7})/))) return '10-' + m[1];
  if ((m = p.match(/^US(\d+)/))) return (+m[1]).toLocaleString('en-US');
  if ((m = p.match(/^[A-Z]{2}(\d+)/))) return m[1];
  return p;
}

/* ---------------- GitHub ---------------- */

function token_() {
  var t = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!t) throw new Error('GitHub 토큰이 설정되지 않았습니다. 교수님께 알려 주세요.');
  return t;
}

function gh_(method, path, body) {
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + path, {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + token_(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  var code = res.getResponseCode();
  if (code === 404 && method === 'get') return null;
  if (code >= 300) {
    var err = new Error('GitHub 오류 ' + code + ': ' + res.getContentText().slice(0, 200));
    err.code = code;
    throw err;
  }
  var text = res.getContentText();
  return text ? JSON.parse(text) : null;
}

/** 여러 GET 요청을 병렬로 보냅니다. 없는 파일(404)은 null. */
function ghAll_(paths) {
  var hd = { Authorization: 'Bearer ' + token_(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  return UrlFetchApp.fetchAll(paths.map(function (p) {
    return { url: 'https://api.github.com/repos/' + REPO + p, headers: hd, muteHttpExceptions: true };
  })).map(function (r, i) {
    var code = r.getResponseCode();
    if (code === 404) return null;
    if (code >= 300) throw new Error('GitHub 오류 ' + code + ' (' + paths[i] + ')');
    return JSON.parse(r.getContentText());
  });
}

function ref_() { return gh_('get', '/git/ref/heads/' + BRANCH).object.sha; }

function readCsv_(file, ref) {
  var j = gh_('get', '/contents/' + file + '?ref=' + ref);
  if (!j) throw new Error(file + ' 파일이 없습니다.');
  return csvFromContents_(j);
}

function csvFromContents_(j) {
  if (!j) throw new Error('데이터 파일이 없습니다.');
  var text = decode_(j.content);
  var rows = parseCsv_(text.replace(/^﻿/, ''));
  var head = rows.shift() || [];
  return { head: head, rows: rows.filter(function (r) { return r.some(String); }).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i] || ''; }); return o;
  }) };
}

/**
 * 여러 파일을 커밋 하나로 올립니다. 그사이 다른 사람이 저장했으면 최신 데이터로 다시 시도합니다.
 * build(head) → { files: [{path, text|base64}], message }
 */
function commitWithRetry_(build) {
  for (var attempt = 0; attempt < 4; attempt++) {
    var head = ref_();
    var plan = build(head);
    var base = gh_('get', '/git/commits/' + head).tree.sha;
    // 사진은 병렬로 올리고, CSV 같은 글자 파일은 트리에 바로 넣습니다.
    var imgs = plan.files.filter(function (f) { return f.base64 != null; });
    var hd = { Authorization: 'Bearer ' + token_(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var shas = UrlFetchApp.fetchAll(imgs.map(function (f) {
      return { url: 'https://api.github.com/repos/' + REPO + '/git/blobs', method: 'post', contentType: 'application/json',
               headers: hd, muteHttpExceptions: true, payload: JSON.stringify({ content: f.base64, encoding: 'base64' }) };
    })).map(function (r) {
      if (r.getResponseCode() >= 300) throw new Error('사진을 올리지 못했습니다: ' + r.getContentText().slice(0, 120));
      return JSON.parse(r.getContentText()).sha;
    });
    var tree = plan.files.map(function (f) {
      if (f.del) return { path: f.path, mode: '100644', type: 'blob', sha: null };   // 파일 삭제
      return f.base64 != null
        ? { path: f.path, mode: '100644', type: 'blob', sha: shas[imgs.indexOf(f)] }
        : { path: f.path, mode: '100644', type: 'blob', content: f.text };
    });
    var t = gh_('post', '/git/trees', { base_tree: base, tree: tree });
    var c = gh_('post', '/git/commits', { message: plan.message, tree: t.sha, parents: [head] });
    try {
      gh_('patch', '/git/refs/heads/' + BRANCH, { sha: c.sha, force: false });
      return c.sha;
    } catch (e) {
      if (e.code !== 422) throw e;          // 422: 그사이 다른 커밋이 들어옴 → 다시
      Utilities.sleep(800);
    }
  }
  throw new Error('다른 사람이 동시에 저장하고 있습니다. 잠시 뒤 다시 저장해 주세요.');
}

function checkUploadPath_(p) {
  if (!/^assets\/img\/(news|people|agency)\/[a-z0-9_.-]+\.(jpg|png)$/.test(p)) throw new Error('올릴 수 없는 파일 경로: ' + p);
}

/* ---------------- 데이터 규칙 ---------------- */

function label_(k) { return { papers: '논문', patents: '특허', projects: '과제', news: '소식', members: '구성원' }[k]; }
function clean_(v) { return String(v == null ? '' : v).replace(/\r?\n/g, ' ').trim(); }
function pad_(n) { return ('0' + n).slice(-2); }
function findIndex_(rows, id) { for (var i = 0; i < rows.length; i++) if (rows[i].ID === id) return i; return -1; }

function nextId_(dataset, row, rows) {
  var prefix = dataset === 'papers' ? PAPER_PREFIX[row['구분']] : ID_PREFIX[dataset];
  if (!prefix) throw new Error('구분을 골라 주세요.');
  var max = 0;
  rows.forEach(function (r) {
    var m = String(r.ID).match(/^([A-Z]+)-(\d+)$/);
    if (m && m[1] === prefix) max = Math.max(max, +m[2]);
  });
  return prefix + '-' + ('00' + (max + 1)).slice(-3);
}

function fillJcrFromJournal_(row, rows) {
  var j = String(row['저널·학회명']).toLowerCase();
  if (!j) return;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['저널·학회명']).toLowerCase() === j && rows[i]['IF(최신)']) {
      row['IF(최신)'] = rows[i]['IF(최신)'];
      row['JCR 상위%(최신)'] = rows[i]['JCR 상위%(최신)'];
      return;
    }
  }
}

/** "G.-Y. Kwon"처럼 이름 머리글자 만들기 */
function initials_(given) {
  given = String(given || '').trim();
  if (!given) return '';
  return given.split(/\s+/).map(function (w) {
    return w.split('-').map(function (p) { return p.charAt(0).toUpperCase() + '.'; }).join('-');
  }).join(' ') + ' ';
}

/** 교수님 역할: ¹ = 공동 제1저자, * = 교신저자 (사이트 이전 스크립트와 같은 규칙) */
function role_(authors) {
  var parts = String(authors || '').split(/,\s*(?:and\s+)?|\s+and\s+|\s+및\s+/).map(function (s) { return s.trim(); }).filter(String);
  var me = -1;
  parts.forEach(function (a, i) { if (me < 0 && /G\.-Y\. Kwon|권구영/.test(a)) me = i; });
  if (me < 0) return '';
  var a = parts[me];
  var firsts = parts.filter(function (x) { return x.indexOf('¹') >= 0; }).length;
  var corrs = parts.filter(function (x) { return x.indexOf('*') >= 0; }).length;
  var out = [];
  if (a.indexOf('¹') >= 0) out.push(firsts > 1 ? '공동 제1저자' : '제1저자');
  else if (me === 0) out.push('제1저자');
  if (a.indexOf('*') >= 0) out.push(corrs > 1 ? '공동 교신저자' : '교신저자');
  return out.join(' · ') || '공동저자';
}

/* ---------------- CSV ---------------- */

function parseCsv_(text) {
  var rows = [], row = [], field = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toCsv_(head, rows) {
  function cell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  return [head.map(cell).join(',')].concat(rows.map(function (r) {
    return head.map(function (h) { return cell(r[h]); }).join(',');
  })).join('\n') + '\n';
}

/* ---------------- 실적원장 (교수님 계정으로 실행) ---------------- */

/**
 * 저장소 데이터로 실적원장의 논문·특허·과제 탭을 다시 만듭니다.
 * 매시간 트리거로 돌리며, 데이터가 바뀌지 않았으면 아무것도 하지 않습니다.
 * 처음 한 번은 원장 사본(백업)을 드라이브에 만들어 둡니다.
 */
function syncLedger() {
  ownerOnly_();
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PRIVATE_IMPORTED') !== 'Y') throw new Error('먼저 importLedgerPrivate()를 한 번 실행하세요.');
  var last = (gh_('get', '/commits?path=data&per_page=1&sha=' + BRANCH) || [{}])[0].sha;
  var stamp = LEDGER_FORMAT + ':' + last;
  if (last && stamp === props.getProperty('LEDGER_SYNCED')) return 'no change';
  var ss = SpreadsheetApp.openById(LEDGER_ID);
  if (!props.getProperty('LEDGER_BACKUP')) {
    var copy = DriveApp.getFileById(LEDGER_ID).makeCopy(ss.getName() + ' 백업 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'));
    props.setProperty('LEDGER_BACKUP', copy.getId());
  }
  var head = ref_();
  var res = ghAll_(['papers', 'patents', 'projects'].map(function (k) { return '/contents/' + DATASETS[k].file + '?ref=' + head; }));
  var data = { papers: csvFromContents_(res[0]).rows, patents: csvFromContents_(res[1]).rows, projects: csvFromContents_(res[2]).rows };
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');

  // 논문: 구분별로 묶고 그 안에서 최신순, 인용 표기 자동 생성
  var KIND_ORDER = ['국제 저널', '국제 학술대회', '국내 저널', '국내 학술대회'];
  var papers = data.papers.slice().sort(function (a, b) {
    return (KIND_ORDER.indexOf(a['구분']) - KIND_ORDER.indexOf(b['구분'])) || byDateDesc_('연도', '월')(a, b);
  });
  papers.forEach(function (r) { r['인용 표기'] = cite_(r); });
  writeTab_(ss, '논문', ['ID', '구분', '등재 구분', '연도', '월', '논문 제목', '저자', '본인 역할', '저널·학회명', 'Vol.', 'No.',
    '페이지/Art. No.', '게재일', 'ISSN/ISBN', 'DOI', 'IF(최신)', 'JCR 상위%(최신)', 'IF(출판연도)', 'JCR 상위%(출판연도)', '인용 표기'], papers);

  // 특허: 등록일(없으면 출원일) 최신순
  var pdate = function (r) { return r['등록일'] || r['출원일'] || ''; };
  var patents = data.patents.slice().sort(function (a, b) { return pdate(b).localeCompare(pdate(a)); });
  writeTab_(ss, '특허', ['ID', '구분', '상태', '국가', '발명의 명칭', '발명자', '출원번호', '출원일', '등록번호', '등록일', '출원인(권리자)', '링크'], patents);

  // 과제: 시작 최신순, 진행/완료 자동
  var projects = data.projects.slice().sort(function (a, b) { return String(b['시작']).localeCompare(a['시작']); });
  projects.forEach(function (r) { r['진행'] = r['종료'] >= now ? '진행' : '완료'; });
  writeTab_(ss, '과제', ['ID', '진행', '과제명(국문)', '과제명(영문)', '사업명', '전문기관', '시작', '종료', '역할', '총 연구비 (천원)', '비고'], projects);

  tidyLedger_(ss, data, now);
  props.setProperty('LEDGER_SYNCED', stamp);
  return 'updated';
}

var COL_WIDTH = { 'ID': 70, '구분': 90, '등재 구분': 70, '연도': 50, '월': 36, '논문 제목': 360, '저자': 260, '본인 역할': 110,
  '저널·학회명': 220, '페이지/Art. No.': 110, '게재일': 90, 'DOI': 230, '인용 표기': 520, '발명의 명칭': 340, '발명자': 240,
  '출원인(권리자)': 200, '링크': 230, '과제명(국문)': 340, '과제명(영문)': 300, '사업명': 180, '전문기관': 200, '진행': 50 };

function writeTab_(ss, name, cols, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.clearConditionalFormatRules();
  if (sh.getMaxColumns() > cols.length) sh.deleteColumns(cols.length + 1, sh.getMaxColumns() - cols.length);
  if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
  var need = rows.length + 1;
  if (sh.getMaxRows() > need + 20) sh.deleteRows(need + 21, sh.getMaxRows() - need - 20);
  var values = [cols].concat(rows.map(function (r) { return cols.map(function (c) { var v = r[c] == null ? '' : String(r[c]); return /^[=+@]/.test(v) ? "'" + v : v; }); }));
  sh.getRange(1, 1, values.length, cols.length).setNumberFormat('@').setValues(values)
    .setVerticalAlignment('top').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontSize(10);
  cols.forEach(function (c, i) {
    if (/연구비|^IF|JCR/.test(c) && rows.length) {
      sh.getRange(2, i + 1, rows.length, 1).setNumberFormat(/연구비/.test(c) ? '#,##0' : '0.0##')
        .setValues(rows.map(function (x) { var v = String(x[c] || '').replace(/,/g, ''); return [v === '' || isNaN(v) ? v : +v]; }));
    }
    sh.setColumnWidth(i + 1, COL_WIDTH[c] || 100);
  });
  sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#1D2760').setFontColor('#FFFFFF')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
  sh.getRange(1, 1, values.length, cols.length).createFilter();   // 머리글에서 바로 거르기·정렬
  lock_(sh);
}

/** IEEE 형식 인용 표기 */
function cite_(r) {
  var MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  var conf = /학술대회/.test(r['구분']);
  var s = r['저자'] + ', "' + r['논문 제목'] + '," ' + (r['구분'] === '국제 학술대회' ? 'in Proc. ' : '') + r['저널·학회명'];
  if (r['Vol.'] && r['Vol.'] !== '-') s += ', vol. ' + r['Vol.'];
  if (r['No.'] && r['No.'] !== '-') s += ', no. ' + r['No.'];   // '-' = 호 없는 저널
  var pg = String(r['페이지/Art. No.'] || ''), art = /^Art\.?\s*/i.test(pg);
  if (/^\d+\s*[–-]\s*\d+$/.test(pg)) pg = 'pp. ' + pg;
  if (pg && !art && !conf) s += ', ' + pg;   // 저널: 쪽수 → 날짜
  var m = +r['월'];
  s += ', ' + (m >= 1 && m <= 12 ? MON[m - 1] + ' ' : '') + r['연도'];
  if (pg && !art && conf) s += ', ' + pg;    // 학술대회: 날짜 → 쪽수
  if (art) s += ', ' + pg.replace(/^Art\.?\s*(no\.)?\s*/i, 'Art. no. ');   // IEEE: Art. no.는 맨 끝
  s += '.';
  var doi = String(r['DOI'] || '').match(/10\.\d{4,}\/\S+/);
  if (doi) s += ' doi: ' + doi[0] + '.';
  return s;
}

/** 원장에서 더 쓰지 않는 탭(소식·구성원)을 지우고 안내 탭(요약 포함)을 다시 씁니다. */
function tidyLedger_(ss, data, now) {
  ['소식', '구성원'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  var y0 = +now.slice(0, 4) - 4, recent = function (r) { return +r['연도'] >= y0; };
  var P = data.papers, T = data.patents, R = data.projects;
  var lead = function (r) { return /제1저자|교신/.test(r['본인 역할']); };
  var cnt = function (list, f) { return list.filter(f).length; };
  var row = function (label, f, list) { return [label, cnt(list, f), cnt(list, function (r) { return f(r) && recent(r); })]; };
  var kind = function (k) { return function (r) { return r['구분'] === k; }; };
  var scie = function (r) { return r['등재 구분'] === 'SCIE'; };
  var sum = function (list) { return list.reduce(function (a, r) { return a + (+String(r['총 연구비 (천원)'] || '').replace(/,/g, '') || 0); }, 0); };
  var pi = R.filter(function (r) { return /책임/.test(r['역할']); });

  var g = ss.getSheetByName('안내') || ss.insertSheet('안내', 0);
  if (g.getFilter()) g.getFilter().remove();
  g.clear();
  var L = [
    ['EIL 실적원장', '', ''],
    ['저장소(github.com/eil-knu/eil-knu.github.io)의 데이터로 매시간 자동으로 만들어집니다. 추가·수정·삭제는 관리자 페이지(홈페이지 맨 아래 "관리자")에서 하세요.', '', ''],
    ['', '', ''],
    ['요약', '전체', y0 + '~' + now.slice(0, 4)],
    row('국제 저널', kind('국제 저널'), P),
    row('  └ SCIE', function (r) { return kind('국제 저널')(r) && scie(r); }, P),
    row('  └ SCIE 주저자(제1·교신)', function (r) { return kind('국제 저널')(r) && scie(r) && lead(r); }, P),
    row('국제 학술대회', kind('국제 학술대회'), P),
    row('국내 저널', kind('국내 저널'), P),
    row('국내 학술대회', kind('국내 학술대회'), P),
    ['특허 등록 (국내)', cnt(T, function (r) { return r['상태'] === '등록' && r['구분'] === '국내'; }), ''],
    ['특허 등록 (국외)', cnt(T, function (r) { return r['상태'] === '등록' && r['구분'] !== '국내'; }), ''],
    ['특허 출원', cnt(T, function (r) { return r['상태'] !== '등록'; }), ''],
    ['과제 전체', R.length, ''],
    ['  └ 연구책임', pi.length, ''],
    ['진행 중 과제', cnt(R, function (r) { return r['종료'] >= now; }), ''],
    ['연구책임 과제 총 연구비 (천원)', sum(pi), ''],
    ['', '', ''],
    ['IF · JCR 상위%', 'JCR(Clarivate) 기준. 상위% = 100 − JIF Percentile, 분야가 여럿이면 가장 유리한 분야.', ''],
    ['저자 표기', '¹ = 공동 제1저자, * = 교신저자. 본인 역할은 저자 표기에서 자동 계산.', ''],
    ['마지막 갱신', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), '']
  ];
  g.getRange(1, 1, L.length, 3).setValues(L).setVerticalAlignment('top').setFontSize(10);
  g.getRange(1, 1).setFontSize(16).setFontWeight('bold').setFontColor('#1D2760');
  g.getRange(2, 1, 1, 3).merge().setWrap(true).setFontColor('#3F4450');
  g.getRange(4, 1, 1, 3).setFontWeight('bold').setBackground('#1D2760').setFontColor('#FFFFFF');
  g.getRange(5, 2, 13, 2).setHorizontalAlignment('right');
  g.getRange(17, 2).setNumberFormat('#,##0');
  g.getRange(19, 2, 1, 2).merge().setWrap(true);
  g.getRange(20, 2, 1, 2).merge().setWrap(true);
  g.getRange(19, 1, 3, 1).setFontWeight('bold');
  g.setColumnWidth(1, 220).setColumnWidth(2, 260).setColumnWidth(3, 260);
  g.setRowHeight(2, 36);
  lock_(g);
  ss.setActiveSheet(g);
  ss.moveActiveSheet(1);
}

function byDateDesc_(y, m) {
  return function (a, b) { return (+b[y] - +a[y]) || ((+b[m] || 0) - (+a[m] || 0)); };
}

/** 원장 탭을 교수님 계정만 고칠 수 있게 잠급니다(원장은 자동으로 다시 만들어지므로 직접 고칠 일이 없음). */
function lock_(sh) {
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { p.remove(); });
  var p = sh.protect().setDescription('관리자 페이지에서 자동 생성 · 직접 수정 금지');
  var me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors().filter(function (u) { return u.getEmail() !== me.getEmail(); }));
  if (p.canDomainEdit()) p.setDomainEdit(false);
}

/**
 * (처음 한 번만) 원장에만 있던 비공개 칸을 저장소로 옮깁니다:
 * 과제의 총 연구비·비고, 특허의 출원인. 저장소 값이 비어 있을 때만 채웁니다.
 */
function importLedgerPrivate() {
  ownerOnly_();
  var ss = SpreadsheetApp.openById(LEDGER_ID);
  var report = [];
  commitWithRetry_(function (head) {
    report = [];
    var files = [];
    [['projects', ['총 연구비 (천원)', '비고']], ['patents', ['출원인(권리자)']]].forEach(function (job) {
      var spec = DATASETS[job[0]];
      var sh = ss.getSheetByName(spec.tab);
      if (!sh) return;
      var v = sh.getDataRange().getDisplayValues();
      var hi = v.findIndex(function (r) { return r.indexOf('ID') >= 0; });
      if (hi < 0) return;
      var h = v[hi].map(function (s) { return String(s).replace(/\s+/g, ' ').trim(); });
      var byId = {};
      v.slice(hi + 1).forEach(function (r) { if (r[h.indexOf('ID')]) byId[r[h.indexOf('ID')]] = r; });
      var t = readCsv_(spec.file, head);
      t.rows.forEach(function (row) {
        var src = byId[row.ID];
        if (!src) return;
        job[1].forEach(function (c) {
          var j = h.indexOf(c);
          if (j >= 0 && !row[c] && src[j]) { row[c] = String(src[j]).trim(); report.push(row.ID + ' ' + c); }
        });
      });
      files.push({ path: spec.file, text: toCsv_(t.head, t.rows) });
    });
    return { files: files, message: '실적원장 비공개 칸(연구비·비고·출원인)을 저장소로 옮김' };
  });
  PropertiesService.getScriptProperties().setProperty('PRIVATE_IMPORTED', 'Y');
  Logger.log(report.length + '칸 옮김\n' + report.join('\n'));
  return report;
}

/** 매시간 원장 갱신 트리거 설치 (교수님이 편집기에서 한 번 실행) */
function installTrigger() {
  ownerOnly_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncLedger') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLedger').timeBased().everyHours(1).create();
}
