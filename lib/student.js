const { isValidScore, previousYearMonth, questionAlerts } = require("./overview");

function primaryKeys(metricConfig) {
  return new Set(
    metricConfig.groups.flatMap((group) => group.metrics.map((metric) => metric.key))
  );
}

function scoreValue(row, key, scaleMax) {
  if (!row) {
    return null;
  }
  const value = row[key];
  return isValidScore(value, scaleMax) ? value : null;
}

function deltaOf(current, previous) {
  if (current === null || previous === null) {
    return null;
  }
  const delta = current - previous;
  return delta === 0 ? null : delta;
}

function textValue(row, key) {
  const value = row[key];
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  return value;
}

function buildStudentDetail(demoData, options) {
  const { metricConfig, questionConfig, rules, studentId, month } = options;
  const scaleMax = metricConfig.scale_max;
  const months = demoData.months.slice();
  const selectedMonth = month || months[months.length - 1];

  if (!months.includes(selectedMonth)) {
    const error = new Error("unknown_month");
    error.code = "unknown_month";
    throw error;
  }

  const id = Number(studentId);
  const current = demoData.responses.find(
    (row) => row.student_id === id && row.year_month === selectedMonth
  );

  if (!current) {
    const error = new Error("unknown_student");
    error.code = "unknown_student";
    throw error;
  }

  const previousMonth = previousYearMonth(selectedMonth);
  const previous = demoData.responses.find(
    (row) => row.student_id === id && row.year_month === previousMonth
  );
  const keys = primaryKeys(metricConfig);

  return {
    student_id: current.student_id,
    student_name: current.student_name,
    grade: current.grade,
    months,
    selected_month: selectedMonth,
    rules_note: rules.ui_note || rules.note,
    groups: questionConfig.groups.map((group) => ({
      id: group.id,
      label: group.label,
      key_metrics: group.questions
        .filter((question) => keys.has(question.key))
        .map((question) => {
          const value = scoreValue(current, question.key, scaleMax);
          const prior = scoreValue(previous, question.key, scaleMax);
          return {
            key: question.key,
            label: question.label,
            value,
            delta: deltaOf(value, prior),
            scale: scaleMax
          };
        }),
      alerts: questionAlerts(
        current,
        previous,
        group.questions,
        rules,
        scaleMax
      ),
      questions: group.questions.map((question) => {
        const value = scoreValue(current, question.key, scaleMax);
        const prior = scoreValue(previous, question.key, scaleMax);
        return {
          key: question.key,
          label: question.label,
          value,
          delta: deltaOf(value, prior),
          scale: scaleMax
        };
      }),
      text_fields: (group.text_fields || []).map((field) => ({
        key: field.key,
        label: field.label,
        value: textValue(current, field.key)
      }))
    }))
  };
}

module.exports = {
  buildStudentDetail
};
