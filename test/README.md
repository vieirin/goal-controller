# Test Suite

## EMF Goal Tree Tests

### emfGoalTree.test.ts

This test suite compares the structure of the new EMF-based goal tree representation with the old intermediate representation (IR) `GoalTreeWithParent` to ensure structural compatibility.

#### Test Input

The test uses `examples/labSamplesWithSideEffect.txt` as the input model file.

#### Test Coverage

1. **Basic Structure**

   - Validates that both representations have a root node
   - Compares root node IDs and names
   - Verifies root node types (Goal vs Task)

2. **Tree Traversal and Node Count**

   - Counts goal nodes in both representations
   - Compares goal IDs throughout the entire tree structure
   - Ensures no goals are missing or duplicated

3. **Goal Properties**

   - Compares goal types (Achieve vs Maintain)
   - Validates utility and cost values
   - Checks context/assertion conditions
   - Verifies maintain conditions for maintain goals

4. **Parent-Child Relationships**

   - Compares child counts for each goal
   - Validates child IDs match between representations
   - Ensures tree structure consistency

5. **Execution Details**

   - Compares execution operators (Interleaved, Alternative, Any)
   - Maps EMF `RuntimeOp` to old IR execution detail types

6. **Resources**

   - Verifies resources are attached to tasks
   - Compares resource counts between representations

7. **Dependencies**
   - Validates goal dependencies match
   - Ensures dependency IDs are consistent

#### Known Issues

The EMF model files (`src/edgeEMFModel/`) contain pre-existing TypeScript errors related to null assignments and missing methods. These errors are unrelated to the test file and do not affect the test logic. The test file uses `// @ts-nocheck` to bypass these pre-existing TypeScript errors during test execution.

#### Running the Tests

```bash
npm test -- test/emfGoalTree.test.ts
```

Note: The tests require TypeScript path mappings to be configured (which are set in `tsconfig.json` and `.mocharc.json`).
