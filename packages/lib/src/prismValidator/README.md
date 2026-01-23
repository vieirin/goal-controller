# PRISM Validator

## Overview

The `prismValidator` package provides comprehensive validation of generated PRISM models against the expected structure derived from a GoalTree. It ensures that all goals have corresponding modules, validates context variables, checks transition counts, verifies variable declarations, and generates detailed validation reports.

## Development Note

**This package was developed by an AI agent following human instructions, with full access to and understanding of the existing codebase structure, patterns, and conventions.** The implementation was guided by iterative human feedback and requirements, leveraging the AI's ability to analyze the entire codebase to ensure consistency with existing code patterns, type definitions, and architectural decisions.

## Architecture

The validator is organized into several focused modules:

### Core Components

- **`parser.ts`**: Parses PRISM model strings into structured data structures, extracting modules, variables, transitions, formulas, and constants.
- **`expectedElements.ts`**: Calculates expected elements (variables, transitions, formulas, context variables) based on the GoalTree structure.
- **`validator.ts`**: Compares expected elements with parsed elements and generates validation results.
- **`report.ts`**: Formats validation reports into human-readable strings and JSON serialization.
- **`types.ts`**: Defines all TypeScript types used throughout the validator.
- **`index.ts`**: Main entry point that orchestrates validation and report generation.

## Features

### Validation Coverage

The validator checks:

1. **Goal Modules**:

   - Ensures each goal has a corresponding PRISM module
   - Validates goal-specific variables (pursued, achieved, chosen, failed)
   - Verifies transition counts match expected patterns
   - Checks for required formulas (achievable, achieved_maintain)
   - Validates context variables are declared in the System module

2. **ChangeManager Module**:

   - Verifies all tasks have `pursued` and `achieved` variables
   - Validates all required task transitions are present

3. **System Module**:
   - Ensures all context variables (from `maintain` and `assertion` conditions) are declared
   - Validates all resource variables are declared

### Expected Elements Calculation

The validator intelligently calculates expected elements based on:

- **Goal Types**: Choice, degradation, sequence, interleaved, alternative goals have different variable and transition requirements
- **Execution Details**: Different execution patterns require different transition structures
- **ExecConditions**: Both `maintain` and `assertion` conditions contribute to expected context variables
- **Task Relationships**: Parent-child relationships affect transition generation
- **Resource Dependencies**: Resources are tracked separately from context variables

### Goal Type Reporting

The validator tracks and reports how many goals of each type were expected vs. emitted:

- **Choice**: Goals with `executionDetail.type === 'choice'`
- **Degradation**: Goals with `executionDetail.type === 'degradation'`
- **Sequence**: Goals with `executionDetail.type === 'sequence'`
- **Interleaved**: Goals with `executionDetail.type === 'interleaved'`
- **Alternative**: Goals with `executionDetail.type === 'alternative'`
- **Basic**: Goals with no execution detail (null)

Goal types are extracted from the PRISM module headers (e.g., `// Type: sequence`) that appear before each goal module. The validator compares the expected count (from the GoalTree) with the emitted count (from the parsed PRISM model) for each type.

## Usage

### Basic Usage

```typescript
import { validate } from './prismValidator';
import { loadPistarModel } from '../GoalTree';
import { convertToTree } from '../GoalTree/creation';
import { edgeDTMCTemplate } from '../templateEngine/engine';

// Load and convert model
const model = loadPistarModel({
  filename: 'examples/experiments/1-minimal.txt',
});
const tree = convertToTree({ model });

// Generate PRISM model
const prismModel = edgeDTMCTemplate({
  gm: tree,
  fileName: 'examples/experiments/1-minimal.txt',
});

// Validate
const report = validate(
  tree,
  prismModel,
  'examples/experiments/1-minimal.txt',
);

// Check results
if (report.summary.totalMissing > 0) {
  console.error('Validation failed!');
  console.log(formatValidationReport(report));
}
```

### Report Formats

#### Human-Readable Format

```typescript
import { formatValidationReport } from './prismValidator';

const report = validate(goalTree, prismModel);
console.log(formatValidationReport(report));
```

#### JSON Format

The validator automatically writes JSON reports to `logs/<modelFileName>.validation.json` when a `modelFileName` is provided:

```typescript
// JSON report is automatically written to logs/examples/experiments/1-minimal.txt.validation.json
const report = validate(
  tree,
  prismModel,
  'examples/experiments/1-minimal.txt',
);
```

The JSON report includes goal type counts:

```json
{
  "summary": { "expected": 41, "emitted": 41, "missing": 0 },
  "goalTypes": {
    "choice": { "expected": 0, "emitted": 0, "missing": 0 },
    "degradation": { "expected": 0, "emitted": 0, "missing": 0 },
    "sequence": { "expected": 2, "emitted": 2, "missing": 0 },
    "interleaved": { "expected": 0, "emitted": 0, "missing": 0 },
    "alternative": { "expected": 0, "emitted": 0, "missing": 0 },
    "basic": { "expected": 3, "emitted": 3, "missing": 0 }
  },
  ...
}
```

#### Programmatic Access

```typescript
import { getValidationSummary } from './prismValidator';

const summary = getValidationSummary(report);
console.log(
  `Expected: ${summary.expected}, Emitted: ${summary.emitted}, Missing: ${summary.missing}`,
);

// Access goal type counts
console.log(
  `Choice goals: expected=${report.goalTypes.choice.expected}, emitted=${report.goalTypes.choice.emitted}`,
);
console.log(
  `Sequence goals: expected=${report.goalTypes.sequence.expected}, emitted=${report.goalTypes.sequence.emitted}`,
);

// Access node-type aggregated summary
console.log(
  `Goal modules: expected=${report.summary.byNodeType.goals.modules.expected}, emitted=${report.summary.byNodeType.goals.modules.emitted}`,
);
console.log(
  `Task variables: expected=${report.summary.byNodeType.tasks.variables.expected}, emitted=${report.summary.byNodeType.tasks.variables.emitted}`,
);
console.log(
  `Resource variables: expected=${report.summary.byNodeType.resources.variables.expected}, emitted=${report.summary.byNodeType.resources.variables.emitted}`,
);
```

## Report Structure

### ValidationReport

```typescript
type ValidationReport = {
  goals: Map<string, GoalValidation>;
  changeManager: ChangeManagerValidation;
  system: SystemValidation;
  goalTypes: {
    choice: ElementCount;
    degradation: ElementCount;
    sequence: ElementCount;
    interleaved: ElementCount;
    alternative: ElementCount;
    basic: ElementCount;
  };
  summary: {
    totalExpected: number;
    totalEmitted: number;
    totalMissing: number;
    byNodeType: {
      goals: {
        modules: { expected: number; emitted: number };
      };
      tasks: {
        variables: { expected: number; emitted: number };
        transitions: { expected: number; emitted: number };
      };
      resources: {
        variables: { expected: number; emitted: number };
      };
    };
  };
};
```

### Element Counts

Each validation result includes:

- `expected`: Number of expected elements
- `emitted`: Number of elements found in the PRISM model
- `missing`: Number of missing elements
- `details`: Lists of expected, emitted, and missing element names

## Integration

The validator is integrated into the main generation pipeline:

```typescript
// src/templateEngine/engine.ts
export const generateValidatedPrismModel = ({
  gm,
  fileName,
  clean = false,
}: {
  gm: GoalTree;
  fileName: string;
  clean?: boolean;
}): string => {
  const prismModel = edgeDTMCTemplate({ gm, fileName, clean });
  const report = validate(gm, prismModel);
  if (report.summary.totalMissing > 0) {
    throw new Error('PRISM model is not valid');
  }
  return prismModel;
};
```

This ensures that only valid PRISM models are generated and saved.

## Testing

Comprehensive tests are located in `test/prismValidator/prismValidator.test.ts`, covering all delivery drone examples and validating that:

- All expected elements are present
- No expected elements are missing
- Emitted counts are at least as high as expected counts (allowing for extra generated elements)

## Implementation Details

### Context Variable Handling

The validator correctly distinguishes between:

- **Context Variables**: Variables from `maintain` and `assertion` conditions in goals and tasks
- **Resource Variables**: Variables representing resources (filtered out from context variables)

Context variables from child tasks are also collected, as they may be used in parent goal transitions.

### Transition Parsing

The parser extracts:

- Transition labels (e.g., `[pursue_G0]`)
- Guard conditions
- Update expressions
- Variables referenced in guards (for validation purposes)

### Formula Matching

Formulas are matched to goals using prefix matching (e.g., `G1_achievable` matches goal `G1`), with careful handling to avoid false matches (e.g., `G1` not matching `G10`).

## Dependencies

- `../GoalTree/types`: GoalTree type definitions
- `../GoalTree/utils`: Utility functions for traversing goal trees
- `../GoalTree/treeVariables`: Functions for extracting context variables
- `../templateEngine/common`: Common naming functions for PRISM elements
- `../logger/filePath`: Shared file path utilities for log/report generation

## Future Enhancements

Potential improvements:

- Validation of transition guard correctness
- Validation of update expression correctness
- Cross-module reference validation
- Performance optimization for large models
- More detailed error messages with suggestions
