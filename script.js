const state = {
  price: 350000,
  guest: false,
  lastDiscordText: "",
  initialPartySize: null,
  members: [
    { id: "buyer", label: "구슬 구매자(본인)", isBuyer: true, createdRun: 1 }
  ],
  initialMemberIds: ["buyer"],
  nextMemberId: 1,
  nextAddedNumber: 1,
  runs: [makeRun(1)]
};

function makeRun(number) {
  return {
    number,
    orbs: ["", "", ""],
    incidents: [
      { checked: false, note: "" },
      { checked: false, note: "" },
      { checked: false, note: "" }
    ],
    exclusions: [],
    additions: [],
    memberPanelOpen: false
  };
}

const orbPriceInput = document.getElementById("orbPrice");
const orbPriceReadable = document.getElementById("orbPriceReadable");
const guestModeInput = document.getElementById("guestMode");
const currentOrbCountInput = document.getElementById("currentOrbCount");
const targetOrbCountInput = document.getElementById("targetOrbCount");
const runsContainer = document.getElementById("runsContainer");
const addRunBtn = document.getElementById("addRunBtn");
const calcBtn = document.getElementById("calcBtn");
const resultsSection = document.getElementById("resultsSection");
const resultsContainer = document.getElementById("resultsContainer");
const discordCopyBtn = document.getElementById("discordCopyBtn");

function formatKoreanGold(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;

  const parts = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man}만`);
  if (rest > 0 && eok === 0) parts.push(`${rest}`);
  if (parts.length === 0) parts.push("0");

  return `${parts.join(" ")} 골드`;
}


function formatToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function parseNonNegativeInteger(rawValue, label, { allowBlank = false } = {}) {
  const raw = String(rawValue ?? "").trim();
  if (raw === "" && allowBlank) return null;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    alert(`${label}을(를) 0 이상의 정수로 입력해주세요.`);
    return undefined;
  }
  return value;
}

function getMember(id) {
  return state.members.find(member => member.id === id);
}

function getActiveMembers(runIndex) {
  if (runIndex === 0) {
    return [...state.initialMemberIds];
  }

  const run = state.runs[runIndex];
  const previous = getActiveMembers(runIndex - 1);
  const active = previous.filter(id => !run.exclusions.includes(id));

  for (const id of run.additions) {
    if (!active.includes(id)) active.push(id);
  }

  if (!active.includes("buyer")) active.unshift("buyer");
  return active;
}

function setInitialPartySize(rawValue) {
  if (state.runs.length > 1) return;

  const value = rawValue === "" ? null : Math.floor(Number(rawValue));
  state.initialPartySize = value && value >= 1 ? value : null;

  state.members = [
    { id: "buyer", label: "구슬 구매자(본인)", isBuyer: true, createdRun: 1 }
  ];
  state.initialMemberIds = ["buyer"];
  state.nextMemberId = 1;
  state.nextAddedNumber = 1;

  if (state.initialPartySize) {
    for (let i = 1; i < state.initialPartySize; i++) {
      const id = `member-${state.nextMemberId}`;
      const label = `초기 파티원 ${i}`;
      state.nextMemberId += 1;
      state.members.push({ id, label, isBuyer: false, createdRun: 1 });
      state.initialMemberIds.push(id);
    }
  }

  renderRuns();
}

function toggleExclusion(runIndex, memberId, checked) {
  const run = state.runs[runIndex];
  if (checked) {
    if (!run.exclusions.includes(memberId)) run.exclusions.push(memberId);
  } else {
    run.exclusions = run.exclusions.filter(id => id !== memberId);
  }
  renderRuns();
}

function addNewMember(runIndex) {
  const runNumber = runIndex + 1;
  const id = `member-${state.nextMemberId}`;
  const label = `추가 인원 ${state.nextAddedNumber}`;
  state.nextMemberId += 1;
  state.nextAddedNumber += 1;

  state.members.push({ id, label, isBuyer: false, createdRun: runNumber });
  state.runs[runIndex].additions.push(id);
  renderRuns();
}

function rejoinMember(runIndex, memberId) {
  const run = state.runs[runIndex];
  if (!run.additions.includes(memberId)) run.additions.push(memberId);
  renderRuns();
}

function removeAddition(runIndex, memberId) {
  const run = state.runs[runIndex];
  run.additions = run.additions.filter(id => id !== memberId);

  const member = getMember(memberId);
  if (member && member.createdRun === runIndex + 1) {
    // 새로 만든 인원이 이 릴에서 취소된 경우 완전히 제거
    const usedLater = state.runs.slice(runIndex + 1).some(laterRun =>
      laterRun.additions.includes(memberId) || laterRun.exclusions.includes(memberId)
    );
    if (!usedLater) {
      state.members = state.members.filter(m => m.id !== memberId);
    }
  }

  renderRuns();
}

function updateOrb(runIndex, gateIndex, value) {
  state.runs[runIndex].orbs[gateIndex] = value;
}

function updateIncident(runIndex, gateIndex, checked) {
  state.runs[runIndex].incidents[gateIndex].checked = checked;
  renderRuns();
}

function updateIncidentNote(runIndex, gateIndex, value) {
  state.runs[runIndex].incidents[gateIndex].note = value;
}

function renderRuns() {
  runsContainer.innerHTML = "";

  state.runs.forEach((run, runIndex) => {
    const card = document.createElement("section");
    card.className = "run-card";

    const activeMembers = state.initialPartySize ? getActiveMembers(runIndex) : [];
    const eligibleCount = activeMembers.length - (state.guest ? 1 : 0);

    let membershipHtml = "";

    if (runIndex === 0) {
      membershipHtml = `
        <div class="field-block">
          <label for="partySize">1릴 시작 파티 인원</label>
          <div class="inline-input">
            <input
              id="partySize"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              placeholder="예: 6"
              value="${state.initialPartySize ?? ""}"
              ${state.runs.length > 1 ? "disabled" : ""}
            >
            <span>명</span>
          </div>
          ${state.runs.length > 1 ? '<p class="hint">후속 릴이 있는 동안에는 시작 인원을 변경할 수 없습니다.</p>' : ""}
        </div>
      `;
    } else {
      const prevActive = getActiveMembers(runIndex - 1);
      const excludable = prevActive.filter(id => id !== "buyer");
      const knownInactive = state.members.filter(member => {
        if (member.isBuyer) return false;
        if (member.createdRun > run.number) return false;
        if (prevActive.includes(member.id)) return false;
        if (run.additions.includes(member.id)) return false;
        return true;
      });

      const currentAdditions = run.additions
        .map(id => getMember(id))
        .filter(Boolean);

      const changeParts = [];
      if (run.exclusions.length > 0) changeParts.push(`제외 ${run.exclusions.length}명`);
      if (run.additions.length > 0) changeParts.push(`추가 ${run.additions.length}명`);
      const changeStatus = changeParts.length ? changeParts.join(" · ") : "변동 없음";

      membershipHtml = `
        <div class="member-change">
          <div class="member-summary">
            <span>직전 릴 ${prevActive.length}명</span>
            <span class="arrow">→</span>
            <strong>현재 ${activeMembers.length}명</strong>
          </div>

          <button
            type="button"
            class="member-toggle"
            data-action="toggle-member-panel"
            data-run-index="${runIndex}"
            aria-expanded="${run.memberPanelOpen ? "true" : "false"}"
          >
            <span class="member-toggle-title">
              <span class="member-toggle-arrow" aria-hidden="true">${run.memberPanelOpen ? "▼" : "▶"}</span>
              인원 변경
            </span>
            <span class="member-toggle-status ${changeParts.length ? "has-change" : ""}">${changeStatus}</span>
          </button>

          ${run.memberPanelOpen ? `
            <div class="member-panel">
              <div>
                <h3>제외 인원</h3>
                <div class="member-list">
                  ${excludable.map(id => {
                    const member = getMember(id);
                    return `
                      <label class="member-check">
                        <input
                          type="checkbox"
                          data-action="exclude"
                          data-run-index="${runIndex}"
                          data-member-id="${id}"
                          ${run.exclusions.includes(id) ? "checked" : ""}
                        >
                        ${member.label}
                      </label>
                    `;
                  }).join("") || '<span class="hint">제외 가능한 인원이 없습니다.</span>'}
                </div>
              </div>

              <div>
                <h3>추가 / 복귀 인원</h3>
                <div class="addition-list">
                  ${currentAdditions.map(member => `
                    <span class="person-chip">
                      ${member.label}
                      <button
                        type="button"
                        class="chip-remove"
                        data-action="remove-addition"
                        data-run-index="${runIndex}"
                        data-member-id="${member.id}"
                        aria-label="${member.label} 취소"
                      >×</button>
                    </span>
                  `).join("")}
                </div>

                ${knownInactive.length ? `
                  <div class="rejoin-row">
                    <span class="hint">이전에 빠진 인원 복귀:</span>
                    ${knownInactive.map(member => `
                      <button
                        type="button"
                        class="small-button"
                        data-action="rejoin"
                        data-run-index="${runIndex}"
                        data-member-id="${member.id}"
                      >${member.label}</button>
                    `).join("")}
                  </div>
                ` : ""}

                <button
                  type="button"
                  class="secondary-button"
                  data-action="add-member"
                  data-run-index="${runIndex}"
                >+ 새 인원 1명</button>
              </div>
            </div>
          ` : ""}
        </div>
      `;
    }

    const gateRows = [0, 1, 2].map(gateIndex => {
      const incident = run.incidents[gateIndex];
      return `
        <div class="gate-row">
          <div class="gate-input-group">
            <label for="run-${runIndex}-gate-${gateIndex}">${gateIndex + 1}관</label>
            <div class="inline-input compact">
              <input
                id="run-${runIndex}-gate-${gateIndex}"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                placeholder="0"
                value="${run.orbs[gateIndex]}"
                data-action="orb"
                data-run-index="${runIndex}"
                data-gate-index="${gateIndex}"
              >
              <span>개</span>
            </div>
          </div>

          <label class="incident-check">
            <input
              type="checkbox"
              data-action="incident"
              data-run-index="${runIndex}"
              data-gate-index="${gateIndex}"
              ${incident.checked ? "checked" : ""}
            >
            입찰 사고
          </label>

          ${incident.checked ? `
            <input
              class="incident-note"
              type="text"
              maxlength="60"
              placeholder="메모 (선택)"
              value="${escapeHtml(incident.note)}"
              data-action="incident-note"
              data-run-index="${runIndex}"
              data-gate-index="${gateIndex}"
            >
          ` : ""}
        </div>
      `;
    }).join("");

    const orbTotal = run.orbs.every(v => v !== "")
      ? run.orbs.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : null;

    card.innerHTML = `
      <div class="run-header">
        <h2>${run.number}릴</h2>
        <div class="run-status">
          ${activeMembers.length ? `참여 ${activeMembers.length}명 · 정산 ${eligibleCount}명` : "인원을 입력해주세요"}
        </div>
      </div>

      ${membershipHtml}

      <div class="gates">
        ${gateRows}
      </div>

      <div class="run-total">
        구슬 합계: <strong>${orbTotal === null ? "—" : `${orbTotal}개`}</strong>
      </div>
    `;

    runsContainer.appendChild(card);
  });

  if (state.runs.length > 1) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.id = "removeRunBtn";
    removeButton.className = "text-button danger";
    removeButton.textContent = "마지막 릴 삭제";
    runsContainer.appendChild(removeButton);
  }
}

function addRun() {
  if (!state.initialPartySize || state.initialPartySize < 1) {
    alert("먼저 1릴 시작 파티 인원을 입력해주세요.");
    return;
  }

  state.runs.push(makeRun(state.runs.length + 1));
  renderRuns();
}

function removeLastRun() {
  if (state.runs.length <= 1) return;

  const removedRunNumber = state.runs.length;
  state.runs.pop();
  state.members = state.members.filter(member => member.createdRun < removedRunNumber);
  renderRuns();
}

function validateAndCalculate() {
  const price = Math.floor(Number(orbPriceInput.value));
  if (!Number.isFinite(price) || price <= 0) {
    alert("구슬 단가를 올바르게 입력해주세요.");
    return;
  }

  const currentOrbCount = parseNonNegativeInteger(currentOrbCountInput.value, "현재 보유중인 구슬 갯수");
  if (currentOrbCount === undefined) return;

  const targetOrbCount = parseNonNegativeInteger(
    targetOrbCountInput.value,
    "목표 구슬 갯수",
    { allowBlank: true }
  );
  if (targetOrbCount === undefined) return;

  if (!state.initialPartySize || state.initialPartySize < 1) {
    alert("1릴 시작 파티 인원을 입력해주세요.");
    return;
  }

  for (let runIndex = 0; runIndex < state.runs.length; runIndex++) {
    for (let gateIndex = 0; gateIndex < 3; gateIndex++) {
      const raw = state.runs[runIndex].orbs[gateIndex];
      const value = Number(raw);
      if (raw === "" || !Number.isInteger(value) || value < 0) {
        alert(`${runIndex + 1}릴 ${gateIndex + 1}관 구슬 수를 입력해주세요. (없으면 0)`);
        return;
      }
    }
  }

  // 공유상자에서 구매한 구슬은 분배금 계산에 사용하고,
  // 개인상자 구슬(관당 1개)은 보유 구슬 현황에만 추가합니다.
  const sharedAcquiredOrbs = state.runs.reduce(
    (sum, run) => sum + run.orbs.reduce((runSum, value) => runSum + Number(value), 0),
    0
  );
  const personalBoxOrbs = state.runs.length * 3;
  const totalAcquiredOrbs = sharedAcquiredOrbs + personalBoxOrbs;

  const orbProgress = {
    currentBefore: currentOrbCount,
    sharedAcquired: sharedAcquiredOrbs,
    personalAcquired: personalBoxOrbs,
    acquired: totalAcquiredOrbs,
    currentAfter: currentOrbCount + totalAcquiredOrbs,
    target: targetOrbCount
  };

  const shares = new Map(state.members.map(member => [member.id, 0]));
  const histories = new Map(state.members.map(member => [member.id, []]));

  for (let runIndex = 0; runIndex < state.runs.length; runIndex++) {
    const run = state.runs[runIndex];
    const active = getActiveMembers(runIndex);

    active.forEach(id => histories.get(id)?.push(runIndex + 1));

    const eligible = state.guest
      ? active.filter(id => id !== "buyer")
      : active;

    if (eligible.length === 0) {
      alert(`${runIndex + 1}릴의 정산 대상 인원이 0명입니다.`);
      return;
    }

    const totalOrbs = run.orbs.reduce((sum, value) => sum + Number(value), 0);
    const exactShare = (totalOrbs * price) / eligible.length;

    eligible.forEach(id => {
      shares.set(id, (shares.get(id) || 0) + exactShare);
    });
  }

  renderResults(shares, histories, orbProgress);
}

function renderResults(shares, histories, orbProgress) {
  const groups = new Map();

  state.members
    .filter(member => !member.isBuyer)
    .forEach(member => {
      const history = histories.get(member.id) || [];
      if (history.length === 0) return;

      const exact = shares.get(member.id) || 0;
      const payable = Math.floor(exact / 10000) * 10000;
      const key = `${history.join("-")}|${payable}`;

      if (!groups.has(key)) {
        groups.set(key, { history, payable, count: 0 });
      }
      groups.get(key).count += 1;
    });

  const groupedResults = [...groups.values()];

  const groupHtml = groupedResults.map((group, index) => `
    <div class="result-card">
      <div class="result-label">${formatHistory(group.history, state.runs.length)} · ${group.count}명</div>
      <div class="result-gold">${formatKoreanGold(group.payable)}</div>
      <div class="copy-row">
        <code>${group.payable}</code>
        <button
          type="button"
          class="copy-button"
          data-copy-value="${group.payable}"
          data-copy-index="${index}"
        >복사</button>
      </div>
    </div>
  `).join("");

  const buyerExact = shares.get("buyer") || 0;
  const buyerPayable = Math.floor(buyerExact / 10000) * 10000;
  const buyerHtml = state.guest
    ? `<div class="buyer-note">구슬 구매자(본인): 손님 설정으로 분배 제외</div>`
    : `<div class="buyer-note">구슬 구매자(본인) 몫: <strong>${formatKoreanGold(buyerPayable)}</strong> · 실제 송금 불필요</div>`;

  const targetText = orbProgress.target === null
    ? "목표 미설정"
    : `${orbProgress.target}개`;

  const orbProgressHtml = `
    <div class="orb-progress-result">
      <div class="result-label">구슬 보유 현황</div>
      <div class="orb-progress-main">
        ${orbProgress.currentAfter}개
        <span class="orb-gained">(+${orbProgress.acquired}개)</span>
        <span class="orb-progress-divider">/</span>
        ${targetText}
      </div>
      <div class="hint">공유상자 ${orbProgress.sharedAcquired}개 + 개인상자 ${orbProgress.personalAcquired}개 · 정산 전 ${orbProgress.currentBefore}개 → 정산 후 ${orbProgress.currentAfter}개</div>
    </div>
  `;

  const incidents = [];
  state.runs.forEach((run, runIndex) => {
    run.incidents.forEach((incident, gateIndex) => {
      if (incident.checked) {
        incidents.push({
          run: runIndex + 1,
          gate: gateIndex + 1,
          note: incident.note.trim()
        });
      }
    });
  });

  const incidentHtml = incidents.length
    ? `
      <div class="incident-summary">
        <h3>입찰 사고 기록</h3>
        <ul>
          ${incidents.map(item => `
            <li>${item.run}릴 ${item.gate}관${item.note ? ` — ${escapeHtml(item.note)}` : ""}</li>
          `).join("")}
        </ul>
      </div>
    `
    : "";

  const discordLines = [
    `[${formatToday()}] ${state.runs.length}릴 획득 구슬 총 ${orbProgress.acquired}개`,
    "",
    `- 구슬 현황 : ${orbProgress.currentAfter}개(+${orbProgress.acquired}개)/${targetText}`,
    "",
    "분배금 :",
    ""
  ];

  if (groupedResults.length) {
    groupedResults.forEach(group => {
      discordLines.push(
        `- ${formatHistory(group.history, state.runs.length)} ${group.count}명: ${formatKoreanGold(group.payable)} (${group.payable})`
      );
    });
  } else {
    discordLines.push("- 지급할 파티원 없음");
  }

  if (incidents.length) {
    const incidentText = incidents
      .map(item => `${item.run}릴 ${item.gate}관${item.note ? `(${item.note})` : ""}`)
      .join(", ");
    discordLines.push("", `입찰 사고: ${incidentText}`);
  }

  state.lastDiscordText = discordLines.join("\n");

  resultsContainer.innerHTML = `
    ${orbProgressHtml}
    ${groupHtml || '<p class="hint">지급할 파티원이 없습니다.</p>'}
    ${buyerHtml}
    ${incidentHtml}
  `;

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatHistory(history, totalRuns) {
  if (history.length === 1) return `${history[0]}릴만 참여`;

  const isConsecutive = history.every((value, index) =>
    index === 0 || value === history[index - 1] + 1
  );

  if (history.length === totalRuns && history[0] === 1 && history.at(-1) === totalRuns) {
    return `1~${totalRuns}릴 전부 참여`;
  }

  if (isConsecutive) {
    return `${history[0]}~${history.at(-1)}릴 참여`;
  }

  return `${history.join(", ")}릴 참여`;
}

async function writeToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

async function copyNumber(button) {
  const value = button.dataset.copyValue;
  await writeToClipboard(value);

  const original = button.textContent;
  button.textContent = "복사됨 ✓";
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1200);
}

async function copyDiscordSummary() {
  if (!state.lastDiscordText) return;

  await writeToClipboard(state.lastDiscordText);
  const original = discordCopyBtn.textContent;
  discordCopyBtn.textContent = "정산문 복사됨 ✓";
  discordCopyBtn.disabled = true;
  setTimeout(() => {
    discordCopyBtn.textContent = original;
    discordCopyBtn.disabled = false;
  }, 1400);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

orbPriceInput.addEventListener("input", event => {
  state.price = Math.floor(Number(event.target.value)) || 0;
  orbPriceReadable.textContent = formatKoreanGold(state.price);
});

guestModeInput.addEventListener("change", event => {
  state.guest = event.target.checked;
  renderRuns();
});

addRunBtn.addEventListener("click", addRun);
calcBtn.addEventListener("click", validateAndCalculate);
discordCopyBtn.addEventListener("click", copyDiscordSummary);

runsContainer.addEventListener("input", event => {
  const target = event.target;
  const runIndex = Number(target.dataset.runIndex);
  const gateIndex = Number(target.dataset.gateIndex);

  if (target.dataset.action === "orb") {
    updateOrb(runIndex, gateIndex, target.value);
  } else if (target.dataset.action === "incident-note") {
    updateIncidentNote(runIndex, gateIndex, target.value);
  }
});

runsContainer.addEventListener("change", event => {
  const target = event.target;

  if (target.id === "partySize") {
    setInitialPartySize(target.value);
    return;
  }

  const action = target.dataset.action;
  if (!action) return;

  const runIndex = Number(target.dataset.runIndex);

  if (action === "exclude") {
    toggleExclusion(runIndex, target.dataset.memberId, target.checked);
  } else if (action === "incident") {
    updateIncident(runIndex, Number(target.dataset.gateIndex), target.checked);
  }
});

runsContainer.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.id === "removeRunBtn") {
    removeLastRun();
    return;
  }

  const action = button.dataset.action;
  const runIndex = Number(button.dataset.runIndex);

  if (action === "toggle-member-panel") {
    state.runs[runIndex].memberPanelOpen = !state.runs[runIndex].memberPanelOpen;
    renderRuns();
  } else if (action === "add-member") {
    addNewMember(runIndex);
  } else if (action === "rejoin") {
    rejoinMember(runIndex, button.dataset.memberId);
  } else if (action === "remove-addition") {
    removeAddition(runIndex, button.dataset.memberId);
  }
});

resultsContainer.addEventListener("click", event => {
  const button = event.target.closest(".copy-button");
  if (button) copyNumber(button);
});

orbPriceReadable.textContent = formatKoreanGold(state.price);
renderRuns();
