function isValidScore(value, scaleMax) {
  return typeof value === "number" && value >= 1 && value <= scaleMax;
}

function previousYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const previous = new Date(year, month - 2, 1);
  const previousMonth = String(previous.getMonth() + 1).padStart(2, "0");
  return `${previous.getFullYear()}-${previousMonth}`;
}

function roundAverage(total, count) {
  if (count === 0) {
    return null;
  }
  return Math.round((total / count) * 10) / 10;
}

function buildCampusMetrics(responses, metricConfig, scaleMax) {
  return metricConfig.groups.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.metrics.map((metric) => {
      let total = 0;
      let answered = 0;

      responses.forEach((row) => {
        const value = row[metric.key];
        if (!isValidScore(value, scaleMax)) {
          return;
        }
        total += value;
        answered += 1;
      });

      return {
        key: metric.key,
        label: metric.label,
        average: roundAverage(total, answered),
        answered,
        scale: scaleMax
      };
    })
  }));
}

function questionAlerts(current, previous, questions, rules, scaleMax) {
  return questions
    .map((question) => {
      const value = isValidScore(current[question.key], scaleMax)
        ? current[question.key]
        : null;
      const prior =
        previous && isValidScore(previous[question.key], scaleMax)
          ? previous[question.key]
          : null;
      const badges = [];

      if (value === null) {
        badges.push("未回答");
      } else if (
        rules.attention_keys.includes(question.key) &&
        value <= rules.attention_max
      ) {
        badges.push(rules.labels.attention);
      } else if (value <= rules.low_score_max) {
        badges.push(`${rules.low_score_max}以下`);
      }

      if (value !== null && prior !== null && prior - value >= rules.drop_min) {
        badges.push(`先月-${rules.drop_min}`);
      }

      return {
        key: question.key,
        label: question.label,
        badges
      };
    })
    .filter((item) => item.badges.length > 0);
}

function buildStudentRows(currentRows, previousById, metricConfig, scaleMax) {
  return currentRows
    .slice()
    .sort((a, b) => a.student_id - b.student_id)
    .map((row) => ({
      student_id: row.student_id,
      student_name: row.student_name,
      groups: metricConfig.groups.map((group) => ({
        id: group.id,
        label: group.label,
        items: group.metrics.map((metric) => {
          const value = row[metric.key];
          return {
            key: metric.key,
            label: metric.label,
            value: isValidScore(value, scaleMax) ? value : null,
            scale: scaleMax
          };
        })
      }))
    }));
}

function buildAlerts(currentRows, previousById, questionConfig, rules, scaleMax) {
  return currentRows
    .map((row) => {
      const previous = previousById.get(row.student_id) || null;
      const groups = questionConfig.groups.map((group) => ({
        id: group.id,
        label: group.label,
        items: questionAlerts(row, previous, group.questions, rules, scaleMax)
      }));
      const count = groups.reduce((total, group) => total + group.items.length, 0);
      return {
        student_id: row.student_id,
        student_name: row.student_name,
        groups,
        count
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.student_id - b.student_id;
    });
}

function buildOverview(demoData, options) {
  const { metricConfig, questionConfig, rules, month } = options;
  const scaleMax = metricConfig.scale_max;
  const months = demoData.months.slice();
  const selectedMonth = month || months[months.length - 1];

  if (!months.includes(selectedMonth)) {
    const error = new Error("unknown_month");
    error.code = "unknown_month";
    throw error;
  }

  const currentRows = demoData.responses.filter(
    (row) => row.year_month === selectedMonth
  );
  const previousRows = demoData.responses.filter(
    (row) => row.year_month === previousYearMonth(selectedMonth)
  );
  const previousById = new Map(
    previousRows.map((row) => [row.student_id, row])
  );
  return {
    months,
    selected_month: selectedMonth,
    response_count: currentRows.length,
    rules_note: rules.ui_note || rules.note,
    campus_metrics: buildCampusMetrics(currentRows, metricConfig, scaleMax),
    alerts: buildAlerts(
      currentRows,
      previousById,
      questionConfig,
      rules,
      scaleMax
    ),
    students: buildStudentRows(
      currentRows,
      previousById,
      metricConfig,
      scaleMax
    )
  };
}

module.exports = {
  buildOverview,
  questionAlerts,
  isValidScore,
  previousYearMonth
};
