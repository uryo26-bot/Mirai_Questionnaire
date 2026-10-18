const monthSelect = document.getElementById("month-select");
const responseCountEl = document.getElementById("response-count");
const campusEl = document.getElementById("campus-metrics");
const alertsEl = document.getElementById("alerts");
const studentsEl = document.getElementById("student-metrics");

function monthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

function clear(element) {
  element.replaceChildren();
}

function heading(text) {
  const h2 = document.createElement("h2");
  h2.textContent = text;
  return h2;
}

function emptyMessage(text) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

function campusScore(item) {
  const score = document.createElement("p");
  score.className = "campus-card-score";

  const value = document.createElement("span");
  value.className = "campus-card-value";
  if (item.average === null || item.average === undefined) {
    value.textContent = "—";
    score.appendChild(value);
    return score;
  }

  value.textContent = String(item.average);
  const scale = document.createElement("span");
  scale.className = "campus-card-scale";
  scale.textContent = ` / ${item.scale}`;
  score.append(value, scale);
  return score;
}

function campusCard(item, responseCount) {
  const card = document.createElement("article");
  card.className = "campus-card";

  const label = document.createElement("p");
  label.className = "campus-card-label";
  label.textContent = item.label;
  card.append(label, campusScore(item));

  if (item.answered !== responseCount) {
    const count = document.createElement("p");
    count.className = "metric-count";
    count.textContent = `回答 ${item.answered} / ${responseCount}人`;
    card.appendChild(count);
  }

  return card;
}

function renderCampus(groups, responseCount) {
  clear(campusEl);
  campusEl.appendChild(heading("校舎の主要指標"));

  groups.forEach((group) => {
    const block = document.createElement("section");
    block.className = "campus-group";

    const title = document.createElement("h3");
    title.textContent = group.label;

    const cards = document.createElement("div");
    cards.className = "campus-cards";
    group.items.forEach((item) => {
      cards.appendChild(campusCard(item, responseCount));
    });

    block.append(title, cards);
    campusEl.appendChild(block);
  });
}

function renderAlerts(alerts, rulesNote) {
  clear(alertsEl);
  alertsEl.appendChild(heading("要確認"));

  const note = document.createElement("p");
  note.className = "rules-note";
  note.textContent = rulesNote;
  alertsEl.appendChild(note);

  if (alerts.length === 0) {
    alertsEl.appendChild(emptyMessage("今月、要確認の生徒はいません。"));
    return;
  }

  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = "alert-card";

    const name = document.createElement("h3");
    name.appendChild(studentLink(alert, monthSelect.value));
    card.appendChild(name);

    const sections = document.createElement("div");
    sections.className = "alert-sections";
    alert.groups.forEach((group) => {
      sections.appendChild(renderAlertGroup(group));
    });
    card.appendChild(sections);
    alertsEl.appendChild(card);
  });

  const hint = document.createElement("p");
  hint.className = "alert-hint";
  hint.textContent = "生徒をクリックで詳細を表示";
  alertsEl.appendChild(hint);
}

function alertItem(item) {
  const row = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = item.label;
  row.appendChild(name);
  item.badges.forEach((badge) => {
    const mark = document.createElement("span");
    mark.className = "badge";
    mark.textContent = badge;
    row.appendChild(mark);
  });
  return row;
}

function renderAlertGroup(group) {
  const section = document.createElement("section");
  section.className = "alert-section";

  const title = document.createElement("h4");
  title.textContent = group.label;
  section.appendChild(title);

  const visible = group.items.slice(0, 3);
  const hidden = group.items.slice(3);
  const list = document.createElement("ul");
  visible.forEach((item) => {
    list.appendChild(alertItem(item));
  });
  section.appendChild(list);

  if (hidden.length > 0) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "alert-more";
    more.textContent = `+${hidden.length}件`;
    more.addEventListener("click", () => {
      hidden.forEach((item) => {
        list.appendChild(alertItem(item));
      });
      more.remove();
    });
    section.appendChild(more);
  }

  return section;
}

function studentLink(student, month) {
  const link = document.createElement("a");
  const params = new URLSearchParams({
    student_id: String(student.student_id),
    month
  });
  link.href = `/detail.html?${params.toString()}`;
  link.textContent = student.student_name;
  return link;
}

function studentScore(item) {
  const score = document.createElement("p");
  score.className = "student-metric-score";

  const value = document.createElement("span");
  value.className = "student-metric-value";
  if (item.value === null || item.value === undefined) {
    value.textContent = "—";
    score.appendChild(value);
    return score;
  }

  value.textContent = String(item.value);
  const scale = document.createElement("span");
  scale.className = "student-metric-scale";
  scale.textContent = ` / ${item.scale}`;
  score.append(value, scale);
  return score;
}

function studentDomain(group) {
  const domain = document.createElement("section");
  domain.className = "student-domain";

  const title = document.createElement("p");
  title.className = "student-domain-label";
  title.textContent = group.label;

  const metrics = document.createElement("div");
  metrics.className = "student-metrics";
  group.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "student-metric";

    const label = document.createElement("p");
    label.className = "student-metric-label";
    label.textContent = item.label;

    row.append(label, studentScore(item));
    metrics.appendChild(row);
  });

  domain.append(title, metrics);
  return domain;
}

function renderStudents(students) {
  clear(studentsEl);
  studentsEl.appendChild(heading("各生徒の回答"));

  students.forEach((student) => {
    const card = document.createElement("article");
    card.className = "student-card";

    const name = document.createElement("h3");
    name.appendChild(studentLink(student, monthSelect.value));

    const domains = document.createElement("div");
    domains.className = "student-domains";
    student.groups.forEach((group) => {
      domains.appendChild(studentDomain(group));
    });

    card.append(name, domains);
    studentsEl.appendChild(card);
  });

  const hint = document.createElement("p");
  hint.className = "student-hint";
  hint.textContent = "生徒をクリックで詳細表示";
  studentsEl.appendChild(hint);
}

function fillMonthSelect(months, selectedMonth) {
  clear(monthSelect);
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthLabel(month);
    if (month === selectedMonth) {
      option.selected = true;
    }
    monthSelect.appendChild(option);
  });
  monthSelect.disabled = false;
}

async function loadOverview(month) {
  const url = month
    ? `/api/overview?month=${encodeURIComponent(month)}`
    : "/api/overview";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("overview_unavailable");
  }
  return response.json();
}

function renderResponseCount(count) {
  if (typeof count === "number") {
    responseCountEl.textContent = `回答 ${count}人`;
    return;
  }
  responseCountEl.textContent = "回答 —人";
}

function renderOverview(data) {
  fillMonthSelect(data.months, data.selected_month);
  renderResponseCount(data.response_count);
  renderCampus(data.campus_metrics, data.response_count);
  renderAlerts(data.alerts, data.rules_note);
  renderStudents(data.students);
}

function renderError() {
  const message = "表示用データを読み込めませんでした。";
  renderResponseCount(null);
  clear(campusEl);
  clear(alertsEl);
  clear(studentsEl);
  campusEl.append(heading("校舎の主要指標"), emptyMessage(message));
  alertsEl.append(heading("要確認"), emptyMessage(message));
  studentsEl.append(heading("各生徒の回答"), emptyMessage(message));
}

async function refresh(month) {
  try {
    renderOverview(await loadOverview(month));
  } catch (err) {
    renderError();
  }
}

monthSelect.addEventListener("change", () => {
  refresh(monthSelect.value);
});

refresh();
