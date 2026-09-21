function flattenMetrics(metricConfig) {
  return metricConfig.groups.flatMap((group) =>
    group.metrics.map((metric) => ({
      groupId: group.id,
      groupLabel: group.label,
      key: metric.key,
      label: metric.label
    }))
  );
}

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

function alertReasons(current, previous, metrics, rules, scaleMax) {
  const reasons = [];

  metrics.forEach((metric) => {
    const value = current[metric.key];

    if (!isValidScore(value, scaleMax)) {
      reasons.push({
        label: rules.labels.missing,
        text: `${metric.label}が未回答`
      });
      return;
    }

    if (
      rules.attention_keys.includes(metric.key) &&
      value <= rules.attention_max
    ) {
      reasons.push({
        label: rules.labels.attention,
        text: `${metric.label}が ${value} / ${scaleMax}`
      });
    } else if (value <= rules.low_score_max) {
      reasons.push({
        label: rules.labels.low,
        text: `${metric.label}が ${value} / ${scaleMax}`
      });
    }

    const previousValue = previous ? previous[metric.key] : null;
    if (
      isValidScore(previousValue, scaleMax) &&
      previousValue - value >= rules.drop_min
    ) {
      reasons.push({
        label: rules.labels.drop,
        text: `${metric.label}が前月 ${previousValue} から ${value}`
      });
    }
  });

  return reasons;
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

function buildAlerts(currentRows, previousById, metrics, rules, scaleMax) {
  return currentRows
    .map((row) => {
      const previous = previousById.get(row.student_id) || null;
      return {
        student_id: row.student_id,
        student_name: row.student_name,
        reasons: alertReasons(row, previous, metrics, rules, scaleMax)
      };
    })
    .filter((row) => row.reasons.length > 0)
    .sort((a, b) => {
      if (b.reasons.length !== a.reasons.length) {
        return b.reasons.length - a.reasons.length;
      }
      return a.student_id - b.student_id;
    });
}

function buildOverview(demoData, options) {
  const { metricConfig, rules, month } = options;
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
  const metrics = flattenMetrics(metricConfig);

  return {
    months,
    selected_month: selectedMonth,
    rules_note: rules.ui_note || rules.note,
    campus_metrics: buildCampusMetrics(currentRows, metricConfig, scaleMax),
    alerts: buildAlerts(currentRows, previousById, metrics, rules, scaleMax),
    students: buildStudentRows(
      currentRows,
      previousById,
      metricConfig,
      scaleMax
    )
  };
}

module.exports = {
  buildOverview
};
