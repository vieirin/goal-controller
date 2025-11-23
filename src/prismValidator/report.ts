import type { ValidationReport } from './types';

export const serializeValidationReportToJSON = (
  report: ValidationReport,
): Record<string, unknown> => {
  // Convert goals Map to object
  const goalsObject: Record<
    string,
    {
      module: { expected: number; emitted: number; missing: number };
      variables: { expected: number; emitted: number; missing: number };
      transitions: { expected: number; emitted: number; missing: number };
      formulas: { expected: number; emitted: number; missing: number };
      contextVariables: {
        expected: number;
        emitted: number;
        missing: number;
      };
    }
  > = {};

  report.goals.forEach((validation, goalId) => {
    goalsObject[goalId] = {
      module: {
        expected: validation.module.expected,
        emitted: validation.module.emitted,
        missing: validation.module.missing,
      },
      variables: {
        expected: validation.variables.expected,
        emitted: validation.variables.emitted,
        missing: validation.variables.missing,
      },
      transitions: {
        expected: validation.transitions.expected,
        emitted: validation.transitions.emitted,
        missing: validation.transitions.missing,
      },
      formulas: {
        expected: validation.formulas.expected,
        emitted: validation.formulas.emitted,
        missing: validation.formulas.missing,
      },
      contextVariables: {
        expected: validation.contextVariables.expected,
        emitted: validation.contextVariables.emitted,
        missing: validation.contextVariables.missing,
      },
    };
  });

  return {
    summary: {
      expected: report.summary.totalExpected,
      emitted: report.summary.totalEmitted,
      missing: report.summary.totalMissing,
    },
    goals: goalsObject,
    changeManager: {
      taskVariables: {
        expected: report.changeManager.taskVariables.expected,
        emitted: report.changeManager.taskVariables.emitted,
        missing: report.changeManager.taskVariables.missing,
      },
      taskTransitions: {
        expected: report.changeManager.taskTransitions.expected,
        emitted: report.changeManager.taskTransitions.emitted,
        missing: report.changeManager.taskTransitions.missing,
      },
    },
    system: {
      contextVariables: {
        expected: report.system.contextVariables.expected,
        emitted: report.system.contextVariables.emitted,
        missing: report.system.contextVariables.missing,
      },
      resourceVariables: {
        expected: report.system.resourceVariables.expected,
        emitted: report.system.resourceVariables.emitted,
        missing: report.system.resourceVariables.missing,
      },
    },
  };
};

export const formatValidationReport = (report: ValidationReport): string => {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('PRISM MODEL VALIDATION REPORT');
  lines.push('='.repeat(80));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(80));
  lines.push(`Total Expected: ${report.summary.totalExpected}`);
  lines.push(`Total Emitted:  ${report.summary.totalEmitted}`);
  lines.push(`Total Missing:  ${report.summary.totalMissing}`);
  lines.push('');

  // Goals validation
  lines.push('GOALS VALIDATION');
  lines.push('-'.repeat(80));
  report.goals.forEach((validation, goalId) => {
    lines.push(`Goal: ${goalId}`);
    lines.push(
      `  Module: expected=${validation.module.expected}, emitted=${validation.module.emitted}, missing=${validation.module.missing}`,
    );

    lines.push(
      `  Variables: expected=${validation.variables.expected}, emitted=${validation.variables.emitted}, missing=${validation.variables.missing}`,
    );
    if (validation.variables.details.missing.length > 0) {
      lines.push(
        `    Missing: ${validation.variables.details.missing.join(', ')}`,
      );
    }

    lines.push(
      `  Transitions: expected=${validation.transitions.expected}, emitted=${validation.transitions.emitted}, missing=${validation.transitions.missing}`,
    );
    if (validation.transitions.details.missing.length > 0) {
      lines.push(
        `    Missing: ${validation.transitions.details.missing.join(', ')}`,
      );
    }

    lines.push(
      `  Formulas: expected=${validation.formulas.expected}, emitted=${validation.formulas.emitted}, missing=${validation.formulas.missing}`,
    );
    if (validation.formulas.details.missing.length > 0) {
      lines.push(
        `    Missing: ${validation.formulas.details.missing.join(', ')}`,
      );
    }

    lines.push(
      `  Context Variables: expected=${validation.contextVariables.expected}, emitted=${validation.contextVariables.emitted}, missing=${validation.contextVariables.missing}`,
    );
    if (validation.contextVariables.details.missing.length > 0) {
      lines.push(
        `    Missing: ${validation.contextVariables.details.missing.join(
          ', ',
        )}`,
      );
    }
    lines.push('');
  });

  // ChangeManager validation
  lines.push('CHANGE MANAGER VALIDATION');
  lines.push('-'.repeat(80));
  lines.push(
    `Task Variables: expected=${report.changeManager.taskVariables.expected}, emitted=${report.changeManager.taskVariables.emitted}, missing=${report.changeManager.taskVariables.missing}`,
  );
  if (report.changeManager.taskVariables.details.missing.length > 0) {
    lines.push(
      `  Missing: ${report.changeManager.taskVariables.details.missing.join(
        ', ',
      )}`,
    );
  }
  lines.push(
    `Task Transitions: expected=${report.changeManager.taskTransitions.expected}, emitted=${report.changeManager.taskTransitions.emitted}, missing=${report.changeManager.taskTransitions.missing}`,
  );
  if (report.changeManager.taskTransitions.details.missing.length > 0) {
    lines.push(
      `  Missing: ${report.changeManager.taskTransitions.details.missing.join(
        ', ',
      )}`,
    );
  }
  lines.push('');

  // System validation
  lines.push('SYSTEM VALIDATION');
  lines.push('-'.repeat(80));
  lines.push(
    `Context Variables: expected=${report.system.contextVariables.expected}, emitted=${report.system.contextVariables.emitted}, missing=${report.system.contextVariables.missing}`,
  );
  if (report.system.contextVariables.details.missing.length > 0) {
    lines.push(
      `  Missing: ${report.system.contextVariables.details.missing.join(', ')}`,
    );
  }
  lines.push(
    `Resource Variables: expected=${report.system.resourceVariables.expected}, emitted=${report.system.resourceVariables.emitted}, missing=${report.system.resourceVariables.missing}`,
  );
  if (report.system.resourceVariables.details.missing.length > 0) {
    lines.push(
      `  Missing: ${report.system.resourceVariables.details.missing.join(
        ', ',
      )}`,
    );
  }
  lines.push('');

  lines.push('='.repeat(80));

  return lines.join('\n');
};

export const getValidationSummary = (
  report: ValidationReport,
): {
  expected: number;
  emitted: number;
  missing: number;
  byCategory: Record<
    string,
    { expected: number; emitted: number; missing: number }
  >;
} => {
  const byCategory: Record<
    string,
    { expected: number; emitted: number; missing: number }
  > = {};

  // Goals
  let goalsExpected = 0;
  let goalsEmitted = 0;
  let goalsMissing = 0;

  report.goals.forEach((validation) => {
    goalsExpected +=
      validation.module.expected +
      validation.variables.expected +
      validation.transitions.expected +
      validation.formulas.expected +
      validation.contextVariables.expected;
    goalsEmitted +=
      validation.module.emitted +
      validation.variables.emitted +
      validation.transitions.emitted +
      validation.formulas.emitted +
      validation.contextVariables.emitted;
    goalsMissing +=
      validation.module.missing +
      validation.variables.missing +
      validation.transitions.missing +
      validation.formulas.missing +
      validation.contextVariables.missing;
  });

  byCategory.goals = {
    expected: goalsExpected,
    emitted: goalsEmitted,
    missing: goalsMissing,
  };

  // ChangeManager
  byCategory.changeManager = {
    expected:
      report.changeManager.taskVariables.expected +
      report.changeManager.taskTransitions.expected,
    emitted:
      report.changeManager.taskVariables.emitted +
      report.changeManager.taskTransitions.emitted,
    missing:
      report.changeManager.taskVariables.missing +
      report.changeManager.taskTransitions.missing,
  };

  // System
  byCategory.system = {
    expected:
      report.system.contextVariables.expected +
      report.system.resourceVariables.expected,
    emitted:
      report.system.contextVariables.emitted +
      report.system.resourceVariables.emitted,
    missing:
      report.system.contextVariables.missing +
      report.system.resourceVariables.missing,
  };

  return {
    expected: report.summary.totalExpected,
    emitted: report.summary.totalEmitted,
    missing: report.summary.totalMissing,
    byCategory,
  };
};
