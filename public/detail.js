const monthSelect = document.getElementById("month-select");
const nameEl = document.getElementById("student-name");
const gradeEl = document.getElementById("student-grade");
const rulesNoteEl = document.getElementById("rules-note");
const mainEl = document.getElementById("detail-main");

const params = new URLSearchParams(window.location.search);
const studentId = params.get("student_id");
let openGroupId = null;

function monthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

function formatScore(value, scale) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value} / ${scale}`;
}

function formatDelta(delta) {
  if (delta === null || delta === undefined) {
    return "";
  }
  return delta > 0 ? `+${delta}` : String(delta);
}

function barWidth(value, scale) {
  if (value === null || value === undefined || !scale) {
    return "0%";
  }
  return `${(value / scale) * 100}%`;
}

function clear(element) {
  element.replaceChildren();
}

function metricRow(item) {
  const row = document.createElement("div");
  row.className = "metric-row";

  const label = document.createElement("span");
  label.className = "metric-label";
  label.textContent = item.label;

  const value = document.createElement("span");
  value.className = "metric-value";
  value.textContent = formatScore(item.value, item.scale);

  const delta = document.createElement("span");
  delta.className = "metric-delta";
  delta.textContent = formatDelta(item.delta);

  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("span");
  fill.style.width = barWidth(item.value, item.scale);
  bar.appendChild(fill);

  row.append(label, value, delta, bar);
  return row;
}

function fillMonthSelect(months, selectedMonth) {
  clear(monthSelect);
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthLabel(month);
    option.selected = month === selectedMonth;
    monthSelect.appendChild(option);
  });
  monthSelect.disabled = false;
}

function renderAlerts(alerts) {
  const box = document.createElement("div");
  box.className = "domain-alerts";

  const title = document.createElement("h3");
  title.textContent = "要確認項目";
  box.appendChild(title);

  if (alerts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "該当なし";
    box.appendChild(empty);
    return box;
  }

  const list = document.createElement("ul");
  alerts.forEach((alert) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = alert.label;
    item.appendChild(name);
    alert.badges.forEach((badge) => {
      const mark = document.createElement("span");
      mark.className = "badge";
      mark.textContent = badge;
      item.appendChild(mark);
    });
    list.appendChild(item);
  });
  box.appendChild(list);
  return box;
}

function renderExtra(group) {
  const extra = document.createElement("div");
  extra.className = "domain-extra";

  group.questions.forEach((question) => {
    extra.appendChild(metricRow(question));
  });

  group.text_fields.forEach((field) => {
    const block = document.createElement("p");
    block.className = "text-answer";
    const label = document.createElement("span");
    label.textContent = field.label;
    const value = document.createElement("span");
    value.textContent = field.value || "—";
    block.append(label, value);
    extra.appendChild(block);
  });

  return extra;
}

function renderGroup(group) {
  const section = document.createElement("section");
  section.className = "domain";
  section.dataset.group = group.id;
  if (group.id === openGroupId) {
    section.classList.add("is-open");
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "domain-toggle";
  toggle.textContent = group.label;
  toggle.setAttribute("aria-expanded", String(group.id === openGroupId));
  toggle.addEventListener("click", () => {
    openGroupId = openGroupId === group.id ? null : group.id;
    document.body.classList.toggle("detail-open", openGroupId !== null);
    document.querySelectorAll(".domain").forEach((domain) => {
      const open = domain.dataset.group === openGroupId;
      domain.classList.toggle("is-open", open);
      domain.querySelector(".domain-toggle").setAttribute("aria-expanded", String(open));
    });
  });

  const summary = document.createElement("div");
  summary.className = "domain-summary";

  const metrics = document.createElement("div");
  metrics.className = "domain-metrics";
  group.key_metrics.forEach((item) => {
    metrics.appendChild(metricRow(item));
  });

  summary.append(metrics, renderAlerts(group.alerts));
  section.append(toggle, summary, renderExtra(group));
  return section;
}

function renderDetail(data) {
  nameEl.textContent = data.student_name;
  gradeEl.textContent = data.grade;
  rulesNoteEl.textContent = data.rules_note;
  fillMonthSelect(data.months, data.selected_month);
  document.body.classList.toggle("detail-open", openGroupId !== null);

  clear(mainEl);
  data.groups.forEach((group) => {
    mainEl.appendChild(renderGroup(group));
  });
}

function renderMessage(text) {
  nameEl.textContent = "生徒詳細";
  gradeEl.textContent = "";
  rulesNoteEl.textContent = "";
  clear(mainEl);
  const message = document.createElement("p");
  message.className = "empty";
  message.textContent = text;
  mainEl.appendChild(message);
}

async function loadDetail(month) {
  const query = new URLSearchParams({ student_id: studentId });
  if (month) {
    query.set("month", month);
  }
  const response = await fetch(`/api/student?${query.toString()}`);
  if (response.status === 404) {
    const error = new Error("unknown_student");
    error.code = "unknown_student";
    throw error;
  }
  if (!response.ok) {
    throw new Error("student_unavailable");
  }
  return response.json();
}

async function refresh(month) {
  if (!studentId) {
    renderMessage("生徒が指定されていません。状況確認から開いてください。");
    return;
  }

  try {
    renderDetail(await loadDetail(month));
  } catch (err) {
    if (err.code === "unknown_student") {
      renderMessage("指定した生徒の回答が見つかりません。");
      return;
    }
    renderMessage("表示用データを読み込めませんでした。");
  }
}

monthSelect.addEventListener("change", () => {
  const next = new URLSearchParams({
    student_id: studentId,
    month: monthSelect.value
  });
  history.replaceState(null, "", `/detail.html?${next.toString()}`);
  refresh(monthSelect.value);
});

refresh(params.get("month"));
