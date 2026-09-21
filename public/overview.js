const monthSelect = document.getElementById("month-select");
const campusEl = document.getElementById("campus-metrics");
const alertsEl = document.getElementById("alerts");
const studentsEl = document.getElementById("student-metrics");

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

function barWidth(value, scale) {
  if (value === null || value === undefined || !scale) {
    return "0%";
  }
  return `${(value / scale) * 100}%`;
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

function metricRow(item) {
  const row = document.createElement("div");
  row.className = "metric-row";

  const label = document.createElement("span");
  label.className = "metric-label";
  label.textContent = item.label;

  const value = document.createElement("span");
  value.className = "metric-value";
  value.textContent = formatScore(item.value ?? item.average, item.scale);

  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("span");
  fill.style.width = barWidth(item.value ?? item.average, item.scale);
  bar.appendChild(fill);

  row.append(label, value, bar);
  return row;
}

function renderCampus(groups) {
  clear(campusEl);
  campusEl.appendChild(heading("校舎の主要指標"));

  groups.forEach((group) => {
    const block = document.createElement("section");
    block.className = "metric-group";

    const title = document.createElement("h3");
    title.textContent = group.label;
    block.appendChild(title);

    group.items.forEach((item) => {
      const row = metricRow(item);
      const count = document.createElement("span");
      count.className = "metric-count";
      count.textContent = `回答 ${item.answered}人`;
      row.appendChild(count);
      block.appendChild(row);
    });

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
    name.textContent = alert.student_name;
    card.appendChild(name);

    const list = document.createElement("ul");
    alert.reasons.forEach((reason) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.className = "reason-label";
      label.textContent = reason.label;
      item.append(label, document.createTextNode(` ${reason.text}`));
      list.appendChild(item);
    });

    card.appendChild(list);
    alertsEl.appendChild(card);
  });
}

function renderStudents(students) {
  clear(studentsEl);
  studentsEl.appendChild(heading("生徒ごとの主要指標"));

  students.forEach((student) => {
    const card = document.createElement("article");
    card.className = "student-card";

    const name = document.createElement("h3");
    name.textContent = student.student_name;
    card.appendChild(name);

    student.groups.forEach((group) => {
      const block = document.createElement("section");
      block.className = "metric-group compact";

      const title = document.createElement("h4");
      title.textContent = group.label;
      block.appendChild(title);

      group.items.forEach((item) => {
        block.appendChild(metricRow(item));
      });

      card.appendChild(block);
    });

    studentsEl.appendChild(card);
  });
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

function renderOverview(data) {
  fillMonthSelect(data.months, data.selected_month);
  renderCampus(data.campus_metrics);
  renderAlerts(data.alerts, data.rules_note);
  renderStudents(data.students);
}

function renderError() {
  const message = "表示用データを読み込めませんでした。";
  clear(campusEl);
  clear(alertsEl);
  clear(studentsEl);
  campusEl.append(heading("校舎の主要指標"), emptyMessage(message));
  alertsEl.append(heading("要確認"), emptyMessage(message));
  studentsEl.append(heading("生徒ごとの主要指標"), emptyMessage(message));
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
