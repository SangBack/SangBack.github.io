// mission.js
(function (global) {
  /** =========================
   *  1) 트리/미션 기본 데이터
   *  ========================= */
  const COURSE_COUNT = 9;
  const STEP_COUNT   = 5;

  // 탭 순서: index.html의 .mission-tabs .slot 순서와 반드시 동일
  const TAB_KEYS    = ['task', 'detail', 'constraint', 'env', 'skill'];
  const TAB_LABELS  = ['수행 과제', '세부 내용', '제약 조건', '개발 환경', '획득 역량'];

  // 좌측 트리 기본값
  let TREE_CONFIG = Array.from({ length: COURSE_COUNT }, (_, i) => {
    const id = i + 1;
    const row = {
      id,
      title: `과정 ${id}`,
      completed: id <= 2,
      steps: Array.from({ length: STEP_COUNT }, (_, s) => ({
        id: s + 1,
        label: `단계 ${s + 1}`
      }))
    };

    if (id === 3) {
      row.steps[0].label = '1. 관리 로봇 깨우기';
      row.steps[1].label = '2. 로봇 팔 제어하기';
      row.steps[2].label = '3. 재료 상자 정제하기';
      row.steps[3].label = '4. 자율 주행 시스템 구축하기';
      row.steps[4].label = '5. 도시를 탈출하기';
    }
    return row;
  });

  /**
   * 미션 본문 데이터 구조
   * - 키: "코스-스텝" (예: '3-1')
   * - 값: { task:[], detail:[], constraint:[], env:[], skill:[] }
   *   (문자열 또는 문자열 배열. 문자열이면 \n 기준 분해)
   *
   * ※ 하위호환:
   *   기존처럼 배열/문자열만 주면 'task'(수행 과제)로 자동 매핑
   */
  let MISSION = {
    '3-1': {
      task: [
        '1. 관리 로봇에 접속하기',
        '노트북을 사용해 관리 로봇에 접속하세요',
        '',
        '2. 암호 해제하기',
        'Hello, World!를 출력해 로봇의 보안 시스템을 해제하세요',
      ],
      detail: [
        '1 우측 상단 "코드 에디터" 화면에 코드를 작성합니다.',
        '2 "코드 실행" 버튼을 누르고 "결과" 창에서 결과를 확인합니다.',
      ],
      constraint: [
        '1 외부 인터넷 접속 금지',
        '2 sudo 사용 금지',
      ],
      env: [
        '1 Python 3.11',
        '2 Ubuntu 22.04',
        '3 VSCode + Remote SSH',
      ],
      skill: [
        '1 코드 에디터 사용 방법 숙지',
        '2 파이썬 코드 작성 및 코드 실행 방법 숙지',
      ],
    },
    '3-2': {
      task: [
        '1. RobotArm 클래스 작성',
        '속성: holding(현재 들고 있는 상자), log(동작 기록 리스트) 구현',
        '',
        '2. 핵심 메서드',
        'pick(box): 파란 상자만 집고 log에 "pick <box>" 기록',
        'place(location): 파란 상자를 지정 위치에 내려놓고 log에 "place <box> at <location>" 기록',
        '',
        '3. solution() 구현',
        '파란 상자를 집어 "컨베이어 벨트"에 내려놓고 log 반환',
      ],
      detail: [
        '1 박스 색 판별 규칙/예외 처리',
        '2 log 포맷 요구사항 및 검증 케이스',
      ],
      constraint: [
        '1 전역 변수 사용 금지',
        '2 클래스 외부에서 log 직접 조작 금지',
      ],
      env: [
        '1 Python 3.11',
        '2 pytest 로컬 테스트 스크립트 제공',
      ],
      skill: [
        '1 OOP(클래스 설계)',
        '2 객체 탐지 및 행동 수행 과정 학습',
      ],
    },
    '3-3': { task: ['추후 업데이트 됩니다.'] },
  };

  /** 현재 선택 상태(탭 재렌더링에 사용) */
  let currentCourseId = 3;
  let currentStepId   = 1;

  /** 유틸: 문자열/배열 → 배열로 정규화 */
  function normalizeLines(lines) {
    if (lines == null) return null;
    if (Array.isArray(lines)) return lines;
    if (typeof lines === 'string') return lines.split(/\r?\n/);
    return [String(lines)];
  }

  /** 안전 emit: 브릿지가 없으면 무시 */
  function safeEmit(type, payload){
    if (!global.WebBridge || typeof global.WebBridge.emit !== 'function') return;
    try { global.WebBridge.emit(type, payload); } catch(e) {}
  }

  /** =========================
   *  2) Getter
   *  ========================= */
  function getTreeConfig(){
    return TREE_CONFIG.map(c => ({
      id: c.id,
      title: c.title,
      steps: c.steps.map(s => ({ id: s.id, label: s.label }))
    }));
  }
  function getMissionText(){ // 하위호환명
    return JSON.parse(JSON.stringify(MISSION));
  }

  /** =========================
   *  3) 탭/본문 렌더링
   *  ========================= */
  function getActiveTabIndex(){
    const tabs = Array.from(document.querySelectorAll('.mission-tabs .slot'));
    const idx = tabs.findIndex(t => t.classList.contains('active'));
    return idx >= 0 ? idx : 0;
  }

  // 탭 전환: Unity에 아무 이벤트도 보내지 않음
  function setActiveTabIndex(nextIdx){
    const tabs = Array.from(document.querySelectorAll('.mission-tabs .slot'));
    if (!tabs.length) return;
    const len = tabs.length;
const clamped = ((nextIdx % len) + len) % len; // 순환
    tabs.forEach(t => t.classList.remove('active'));
    tabs[clamped].classList.add('active');

    // 탭 바뀌면 본문만 재렌더(emitStep: false)
    renderMission(currentCourseId, currentStepId, clamped, { emitStep: false });
  }

  function renderMission(courseId, stepId, tabIndex = getActiveTabIndex(), { emitStep = false } = {}) {
    const box = document.getElementById('missionDesc');
    if (!box) return;
    box.innerHTML = '';

    const key  = `${courseId}-${stepId}`;
    const data = MISSION[key];

    // 컨텐츠 결정: 없으면 task 탭 우선
    const contentKey = TAB_KEYS[tabIndex] || 'task';

    let lines = null;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      lines = normalizeLines(data[contentKey] ?? data.task);
    } else {
      // 하위호환: 배열/문자열이면 task로 간주
      lines = normalizeLines(data);
    }

    if (!lines || lines.length === 0) {
      box.textContent = '[ 미션 설명 자리 ]';
    } else {
      for (const line of lines) {
        if (typeof line === 'string' && line.trim() === '') {
          const spacer = document.createElement('div');
          spacer.setAttribute('aria-hidden', 'true');
          spacer.style.height = '1em';
          box.appendChild(spacer);
        } else {
          const div = document.createElement('div');
          div.textContent = line;
          box.appendChild(div);
        }
      }
    }

    // 코스/단계 변경시에만 Unity로 알림 (탭 전환은 NO)
    if (emitStep) safeEmit('tree.step', { course: courseId, step: stepId });
  }

  function updateMission(courseId, stepId) {
    currentCourseId = Number(courseId);
    currentStepId   = Number(stepId);
    // 코스/단계 변경 → Unity에 알림
    renderMission(currentCourseId, currentStepId, undefined, { emitStep: true });
  }

  /** =========================
   *  4) 좌측 트리 레이블 주입
   *  ========================= */
  function wireLeftTreeLabels(rootSel = '.left-col .tree'){
    const tree = document.querySelector(rootSel) || document.querySelector('.tree');
    if (!tree) return;

    const detailsList   = Array.from(tree.querySelectorAll('details'));
    const parentHeaders = Array.from(tree.querySelectorAll('.js-parent-header'));

    detailsList.forEach(d => d.open = false);
    parentHeaders.forEach(h => h.classList.remove('parent-active'));

    detailsList.forEach((det, idx) => {
      const course = TREE_CONFIG[idx];
      if (!course) return;

      const titleEl = det.querySelector('.parent-title');
      if (titleEl) titleEl.textContent = course.title;

      const stepsWrap = det.querySelector('summary + div');
      if (!stepsWrap) return;

      let items = Array.from(stepsWrap.querySelectorAll('.js-child'));
      const need = course.steps.length;

      if (items.length < need && items.length > 0){
        const template = items[items.length - 1];
        for (let k = items.length; k < need; k++){
          const clone = template.cloneNode(true);
          clone.textContent = '';
          stepsWrap.appendChild(clone);
        }
        items = Array.from(stepsWrap.querySelectorAll('.js-child'));
      } else if (items.length > need){
        for (let k = items.length - 1; k >= need; k--) items[k].remove();
        items = Array.from(stepsWrap.querySelectorAll('.js-child'));
      }

      items.forEach((node, sIdx) => {
        node.textContent       = course.steps[sIdx]?.label || `단계 ${sIdx+1}`;
        node.dataset.courseId  = course.id;
        node.dataset.stepId    = course.steps[sIdx]?.id ?? (sIdx+1);

        if (!node.dataset.wired){
          node.dataset.wired = '1';
          node.addEventListener('click', (e) => {
            e.stopPropagation();
            items.forEach(n => n.classList.remove('child-active'));
            node.classList.add('child-active');
            if (!det.open) det.open = true;
            updateMission(Number(node.dataset.courseId), Number(node.dataset.stepId));
          });
        }
      });

      det.addEventListener('toggle', () => {
        if (det.open) {
          detailsList.forEach(o => { if (o !== det) o.open = false; });
          parentHeaders.forEach(h => h.classList.remove('parent-active'));
          const header = det.querySelector('.js-parent-header');
          if (header) header.classList.add('parent-active');
        } else {
          if (!detailsList.some(o => o.open)) parentHeaders.forEach(h => h.classList.remove('parent-active'));
        }
      });
    });
  }

  /** =========================
   *  5) 미션 탭 네비게이션 바인딩
   *  ========================= */
  function wireMissionTabs(){
    const wrap  = document.querySelector('.mission-tabs');
    if (!wrap) return;

    const slots = Array.from(wrap.querySelectorAll('.slot'));
    if (!slots.length) return;

    // 탭 직접 클릭
    slots.forEach((el, i) => {
      el.addEventListener('click', () => setActiveTabIndex(i));
    });

    // 좌/우 화살표(있으면 연결)
    const btnPrev = document.querySelector('.nav-circles .circle img[alt="이전"]')?.parentElement;
    const btnNext = document.querySelector('.nav-circles .circle img[alt="다음"]')?.parentElement;

    btnPrev?.addEventListener('click', () => setActiveTabIndex(getActiveTabIndex() - 1));
    btnNext?.addEventListener('click', () => setActiveTabIndex(getActiveTabIndex() + 1));
  }

  /** =========================
   *  6) 초기 선택
   *  ========================= */
  function selectInitial(courseId = 3, stepId = 1, rootSel = '.left-col .tree'){
    const tree = document.querySelector(rootSel) || document.querySelector('.tree');
    if (!tree) return;
    const detailsList = Array.from(tree.querySelectorAll('details'));
    const det = detailsList[courseId - 1];
    if (!det) return;

    det.open = true;
    const stepsWrap = det.querySelector('summary + div');
    const stepEls = stepsWrap ? Array.from(stepsWrap.querySelectorAll('.js-child')) : [];
    const target = stepEls[stepId - 1] || stepEls[0];
    if (target) target.click(); // updateMission 호출됨(emitStep: true)
  }

  /** =========================
   *  7) 외부 API
   *  ========================= */
  function init(){
    wireLeftTreeLabels();
    wireMissionTabs();
    // 최초 탭 활성(없으면 0번)
    const hasActive = document.querySelector('.mission-tabs .slot.active');
    if (!hasActive) setActiveTabIndex(0);
    selectInitial(3, 1);
  }

  function setTreeConfig(next){
    if (Array.isArray(next)){
      TREE_CONFIG = next;
      wireLeftTreeLabels();
      // 트리 변경 후 현재 본문 갱신(emit 없음)
      renderMission(currentCourseId, currentStepId);
    }
  }

  // 하위호환 + 신규 포맷 모두 지원 (부분 갱신 가능: 병합)
  function setMissionText(next){
    if (!next || typeof next !== 'object') return;
    const norm = {};
    for (const [k, v] of Object.entries(next)) {
      if (v == null) continue;
      if (Array.isArray(v) || typeof v === 'string') {
        // 레거시: 배열/문자열 → task 로 매핑
        norm[k] = { task: v };
      } else if (typeof v === 'object') {
        const obj = {};
        for (const tk of TAB_KEYS) {
          if (v[tk] != null) obj[tk] = v[tk];
        }
        if (Object.keys(obj).length) norm[k] = obj;
      }
    }
    // 병합(부분 업데이트 지원)
    MISSION = { ...MISSION, ...norm };
    renderMission(currentCourseId, currentStepId); // 데이터 갱신 후 재렌더(emit 없음)
  }

  // 별칭
  const setMissionContent = setMissionText;

  global.Missions = {
    init,
    updateMission,
    setTreeConfig,
    setMissionText,
    setMissionContent,
    getTreeConfig,
    getMissionText,
    _setActiveTabIndex: setActiveTabIndex // (선택) 외부에서 탭 바꾸고 싶을 때
  };
})(window);
