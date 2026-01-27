# SLEEC Template Engine

## Overview

The SLEEC Template Engine is a code generator that transforms goal models (from [PiStar](https://www.cin.ufpe.br/~jhcp/pistar/tool/#)) into SLEEC (Specification Language for Event-based Control) format. SLEEC is a formal specification language designed for runtime monitoring and enforcement of behavioral requirements in event-driven systems.

**Purpose:** Generate formal SLEEC specifications from high-level goal models, enabling automated verification and runtime monitoring of task-based systems.

**Input:** Goal tree structure (`GoalTree`) containing tasks with:
- Preconditions and postconditions
- Triggering events
- Temporal constraints
- Fluent names for state tracking

**Output:** Valid SLEEC specification with:
- Event definitions (external and fluent-based)
- Measure declarations (boolean and scale variables)
- Rules for task lifecycle (start, pursue, achieve, fail, obstacle)

## Architecture

### Core Components

```
sleecTemplateEngine/
├── index.ts              # Main entry point
├── definitions.ts        # Generates def_start...def_end block
│   ├── extractTriggeringEvents()
│   ├── extractFluentEvents()
│   ├── extractFluentNames()
│   ├── extractObstacleEvents()
│   └── extractMeasures()
│       └── semanticSortScaleValues()  # Smart ordering for scale values
├── fluents.ts            # Generates fluent state definitions
│   └── generateFluents()
├── rules.ts              # Generates rule_start...rule_end block
│   └── generateObstacleEventsRules()
├── purposes.ts           # Generates purpose_start...purpose_end block
│   └── generatePurposes()
└── shared.ts             # Shared utilities and types
```

### Data Flow

```
GoalTree
    ↓
allByType(type: 'task')  ← Extract all task nodes
    ↓
┌───────────────────────────────────────┐
│  sleecTemplateEngine(tree)            │
├───────────────────────────────────────┤
│  1. generateDefinitions(tasks)        │
│     - Extract events & measures       │
│     - Generate def_start block        │
│                                       │
│  2. generateTaskRules(tasks)          │
│     - Generate rule_start block       │
│     - Create lifecycle rules          │
└───────────────────────────────────────┘
    ↓
SLEEC Specification String
```

## How It Works

### 1. Definition Generation (`def_start...def_end`)

The definition block declares all events and measures (variables) used in the specification.

#### Event Categories

**External Events** - User-defined triggering events:
```sleec
event MeetingUser
event PatientAsleep
event DataCollected
```

**Fluent Events** - Task lifecycle state transitions (4 per task):
```sleec
event StartTrackVitals
event PursuingTrackVitals
event AchievedTrackVitals
event ReportFailureTrackVitals
```

**Obstacle Events** - Events that prevent task execution:
```sleec
event AchievedObtainConsentPartialTracking
```

#### Measure Extraction

Variables are automatically detected from task preconditions and postconditions:

**Boolean Measures** - Simple presence checks:
```typescript
// From condition: {purposeProtocolInformed}
measure purposeProtocolInformed: boolean
```

**Scale Measures** - Variables with enumerated values:
```typescript
// From condition: ({patientDiscomfort} = d_low) or ({patientDiscomfort} = d_moderate)
measure patientDiscomfort: scale(d_low, d_moderate, d_high)
```

#### Fluent Definitions

Fluents represent the active state of tasks (started but not yet achieved). Each task generates one fluent definition:

```sleec
fluent TaskName <{StartTaskName}, {AchievedTaskName}>
```

**Example:**
```sleec
fluent InformPurposeandProtocol <{StartInformPurposeandProtocol}, {AchievedInformPurposeandProtocol}>
fluent ObtainConsentFullTracking <{StartObtainConsentFullTracking}, {AchievedObtainConsentFullTracking}>
fluent TrackVitalSigns <{StartTrackVitalSigns}, {AchievedTrackVitalSigns}>
```

The fluent becomes true when the Start event occurs and becomes false when the Achieved event occurs, providing a way to track whether a task is currently in progress.

**Semantic Value Ordering:**

The engine intelligently orders scale values using pattern detection:

```typescript
// Input (any order): d_high, d_low, d_moderate
// Output: scale(d_low, d_moderate, d_high)

// Recognized patterns:
// Low tier:    low, l, min, minimum, small, weak
// Medium tier: moderate, med, medium, m, normal, average
// High tier:   high, h, max, maximum, large, strong

// Examples:
['r_high', 'r_low', 'r_moderate']  → ['r_low', 'r_moderate', 'r_high']
['max', 'min', 'med']              → ['min', 'med', 'max']
['zebra', 'apple', 'mango']        → ['apple', 'mango', 'zebra'] // alphabetical fallback
```

### 2. Rule Generation (`rule_start...rule_end`)

Each task generates 3-4 lifecycle rules following the SLEEC task execution pattern.

#### Standard Task Rules (3 rules per task)

**Rule 1: Start Condition**
```sleec
RuleT1_1 when MeetingUser and (not {purposeProtocolInformed})
         then StartInformPurposeAndProtocol
```
- **When:** External event occurs AND precondition holds
- **Then:** Transition to Start state

**Rule 2: Pursue Transition**
```sleec
RuleT1_2 when StartInformPurposeAndProtocol
         then PursuingInformPurposeAndProtocol
         within 120 seconds
```
- **When:** Task started
- **Then:** Begin pursuing the task
- **Temporal:** Must happen within time constraint

**Rule 3: Achieve or Fail**
```sleec
RuleT1_3 when PursuingInformPurposeAndProtocol and {purposeProtocolInformed}
         then AchievedInformPurposeAndProtocol
         unless (not {purposeProtocolInformed})
         then ReportFailureInformPurposeAndProtocol
```
- **When:** Task pursuing AND postcondition satisfied → Achieved
- **Unless:** Postcondition violated → ReportFailure

#### Obstacle Rule (optional 4th rule)

If a task has an `ObstacleEvent` property, an additional rule is generated:

```sleec
RuleT6_Obstacle when AchievedObtainConsentPartialTracking
                then not PursuingTrackVitalsOutdoors
```
- **When:** Obstacle event occurs
- **Then:** Stop pursuing the task

### 3. Output Structure

Complete SLEEC specification:

```sleec
def_start
    event ExternalEvent1
    event ExternalEvent2

    event StartTaskFluent
    event PursuingTaskFluent
    event AchievedTaskFluent
    event ReportFailureTaskFluent

    measure booleanVar: boolean
    measure scaleVar: scale(low, moderate, high)

    fluent TaskFluent <{StartTaskFluent}, {AchievedTaskFluent}>
def_end

rule_start
    RuleT1_1 when ... then ...
    RuleT1_2 when ... then ... within ...
    RuleT1_3 when ... then ... unless ... then ...
    RuleT1_Obstacle when ... then not ...
rule_end

purpose_start
    P1 when ContextEvent and Condition then Event
purpose_end
```

## Key Functions

### `sleecTemplateEngine(tree: GoalTree): string`

Main entry point. Orchestrates the generation process.

**Parameters:**
- `tree` - Goal tree structure from PiStar model

**Returns:** Complete SLEEC specification as a string

**Example:**
```typescript
import { sleecTemplateEngine } from './sleecTemplateEngine';
import { loadPistarModel, convertToTree } from '../GoalTree';

const model = loadPistarModel({ filename: 'examples/bsn-model.txt' });
const tree = convertToTree({ model });
const sleecSpec = sleecTemplateEngine(tree);
// Write to file or use for verification
```

### `extractMeasures(tasks: GoalNode[]): Measure[]`

Analyzes task conditions to extract variable declarations.

**Algorithm:**
1. Scan all preconditions and postconditions
2. Find variables using regex: `/\{(\w+)\}/g`
3. Detect scale variables: `/\{(\w+)\}\s*=\s*(\w+)/g`
4. Collect all values for each scale variable
5. Sort scale values semantically
6. Mark remaining variables as boolean

**Returns:** Sorted array of measure definitions with types and scale values

**Exported:** Yes (useful for testing and validation)

### `semanticSortScaleValues(values: string[]): string[]`

Orders scale values based on semantic meaning (low → medium → high).

**Algorithm:**
1. Extract suffix from each value (part after last `_`)
2. Match suffix against known patterns (low/med/high tiers)
3. If all values have recognized patterns, sort by tier
4. Otherwise, fall back to alphabetical sort

**Pattern Detection:**
- Handles prefixed values: `d_low`, `r_moderate`, `priority_high`
- Supports abbreviations: `l`, `m`, `h`, `min`, `med`, `max`
- Works with full words: `low`, `moderate`, `high`, `minimum`, `maximum`

**Example:**
```typescript
semanticSortScaleValues(['d_high', 'd_low', 'd_moderate'])
// Returns: ['d_low', 'd_moderate', 'd_high']

semanticSortScaleValues(['zebra', 'apple'])
// Returns: ['apple', 'zebra'] (alphabetical fallback)
```

### `generateDefinitions(tasks: GoalNode[]): string`

Creates the `def_start...def_end` block with all events, measures, and fluents.

**Process:**
1. Extract all event types (external, fluent, obstacle)
2. Filter and deduplicate events
3. Extract and classify measures
4. Generate fluent definitions
5. Format into SLEEC syntax with proper grouping

**Grouping Strategy:**
- External events (sorted alphabetically)
- Fluent events (grouped by task, with blank line separators)
- Obstacle events (sorted alphabetically)
- Measures (sorted alphabetically)
- Fluent definitions

### `generateFluents(tasks: GoalNode[]): string[]`

Generates fluent state definitions for all tasks.

**Format:** `fluent TaskName <{StartTaskName}, {AchievedTaskName}>`

**Process:**
1. Iterate through all tasks
2. Extract fluent name (task name with spaces removed)
3. Generate start and achieved event names
4. Return array of fluent definition lines

**Example:**
```typescript
const tasks = [{ name: 'Track Vital Signs', ... }];
const fluents = generateFluents(tasks);
// Returns: ['    fluent TrackVitalSigns <{StartTrackVitalSigns}, {AchievedTrackVitalSigns}>']
```

**Note:** Tasks with no name are skipped.

### `generateTaskRules(tasks: GoalNode[]): string`

Creates the `rule_start...rule_end` block with task lifecycle rules.

**Process:**
1. Iterate through all tasks
2. Generate 3 standard rules per task (start, pursue, achieve/fail)
3. Add obstacle rule if `ObstacleEvent` property exists
4. Format with proper naming conventions (`RuleT1_1`, `RuleT1_2`, etc.)

**Rule Naming:**
- Task ID dots are replaced with underscores: `T.1` → `RuleT_1_1`
- Standard rules numbered 1-3
- Obstacle rule named `RuleT{id}_Obstacle`

## Example Usage

### Input: Goal Model Task

```json
{
  "id": "T5",
  "text": "T5: Track Vital Signs",
  "type": "istar.Task",
  "customProperties": {
    "PreCond": "((({patientDiscomfort} = d_low) or ({patientDiscomfort} = d_moderate)) or ({patientDiscomfort} = d_high))",
    "TriggeringEvent": "PatientAsleep",
    "TemporalConstraint": "300 seconds",
    "PostCond": "{vitalsSignsCollected}",
    "FluentName": "TrackVitals"
  }
}
```

### Output: SLEEC Specification

```sleec
def_start
    event PatientAsleep

    event StartTrackVitals
    event PursuingTrackVitals
    event AchievedTrackVitals
    event ReportFailureTrackVitals

    measure patientDiscomfort: scale(d_low, d_moderate, d_high)
    measure vitalsSignsCollected: boolean

    fluent TrackVitals <{StartTrackVitals}, {AchievedTrackVitals}>
def_end

rule_start
    RuleT5_1 when PatientAsleep and ((({patientDiscomfort} = d_low) or ({patientDiscomfort} = d_moderate)) or ({patientDiscomfort} = d_high))
             then StartTrackVitals

    RuleT5_2 when StartTrackVitals
             then PursuingTrackVitals
             within 300 seconds

    RuleT5_3 when PursuingTrackVitals and {vitalsSignsCollected}
             then AchievedTrackVitals
             unless (not {vitalsSignsCollected})
             then ReportFailureTrackVitals
rule_end
```

## Testing

The template engine includes comprehensive test coverage:

**Test Files:**
- `packages/lib/test/sleecTemplateEngine/extractMeasures.test.ts`
- `packages/lib/test/sleecTemplateEngine/fluents.test.ts`
- `packages/lib/test/sleecTemplateEngine/purposes.test.ts`

**extractMeasures Coverage:**
- ✅ Boolean measure extraction
- ✅ Scale measure detection
- ✅ Scale value extraction and ordering
- ✅ Semantic pattern recognition
- ✅ Alphabetical fallback
- ✅ Value deduplication
- ✅ Mixed boolean/scale usage
- ✅ Prefix handling (`d_low`, `r_moderate`)
- ✅ Alternative patterns (`min/med/max`)
- ✅ BSN goal model integration

**generateFluents Coverage:**
- ✅ Single/multiple task fluent generation
- ✅ Space removal from task names
- ✅ Skip tasks with no name
- ✅ Empty tasks list handling
- ✅ Correct fluent format validation
- ✅ BSN Goal Model task names

**generatePurposes Coverage:**
- ✅ Achieve type purpose generation
- ✅ Maintain type purpose generation
- ✅ Sequential label generation (P1, P2, P3)
- ✅ Missing property error handling
- ✅ Nested goals in tree

**Run Tests:**
```bash
pnpm test -- --grep "sleecTemplateEngine"
```

## Related Documentation

- **Main Repository:** See [main README](../../../../README.md) for overall architecture
- **PRISM Template Engine:** See `packages/lib/src/templateEngine/` for PRISM model generation
- **Goal Tree Structure:** See `packages/lib/src/GoalTree/` for input data structures
- **SLEEC Language:** [SLEEC specification](https://www.sleec.io) for language reference

## Future Enhancements

Potential improvements for the template engine:

1. **Custom Scale Patterns** - Allow users to define custom tier patterns
2. **Constraint Validation** - Verify that temporal constraints are valid
3. **Measure Type Inference** - Detect numeric ranges for integer measures
4. **Rule Optimization** - Combine similar rules to reduce specification size
5. **Error Recovery** - Provide suggestions when patterns aren't recognized
6. **SLEEC Validation** - Integrate with SLEEC parser for syntax validation

## Contributing

When contributing to the SLEEC template engine:

1. **Add Tests** - Include tests for new features or bug fixes
2. **Update This README** - Document architectural changes
3. **Maintain Backward Compatibility** - Don't break existing SLEEC outputs
4. **Follow Patterns** - Use consistent naming and code style
5. **Validate Output** - Test against reference SLEEC files

## References

- **SLEEC Language Specification:** https://www.sleec.io
- **PiStar Goal Modeling Tool:** https://www.cin.ufpe.br/~jhcp/pistar/tool/
- **Example Reference Output:** `reference/sleec-bsn.sleec`
- **Example Goal Models:** `examples/goalModel-sleec.txt`, `examples/goalModel-sleec2.txt`
