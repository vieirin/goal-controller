/**
 * ESLint rule to prevent direct usage of [...(node.children || []), ...(node.tasks || [])]
 * pattern in favor of using childrenIncludingTasks utility function
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct usage of [...(node.children || []), ...(node.tasks || [])] pattern',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      useChildrenIncludingTasks:
        'Use childrenIncludingTasks({ node: ... }) instead of [...(node.children || []), ...(node.tasks || [])] or [...(node.children ?? []), ...(node.tasks ?? [])]',
    },
  },
  create(context) {
    return {
      ArrayExpression(node) {
        // Check if this is a spread array with exactly 2 elements
        if (
          node.elements &&
          node.elements.length === 2 &&
          node.elements.every((el) => el && el.type === 'SpreadElement')
        ) {
          const [firstSpread, secondSpread] = node.elements;

          // Check if first spread is [...(something.children || [])]
          const firstIsChildrenPattern = isChildrenPattern(firstSpread.argument);
          // Check if second spread is [...(something.tasks || [])]
          const secondIsTasksPattern = isTasksPattern(secondSpread.argument);

          // Check if they reference the same object
          if (firstIsChildrenPattern && secondIsTasksPattern) {
            const firstObject = extractObjectName(firstSpread.argument);
            const secondObject = extractObjectName(secondSpread.argument);

            if (firstObject && secondObject && firstObject === secondObject) {
              context.report({
                node,
                messageId: 'useChildrenIncludingTasks',
              });
              return;
            }
          }
        }
      },
    };
  },
};

/**
 * Check if an expression matches the pattern: (obj.children || []) or (obj.children ?? [])
 */
function isChildrenPattern(expr) {
  if (!expr || expr.type !== 'LogicalExpression') {
    return false;
  }

  // Check for (obj.children || []) or (obj.children ?? [])
  if (expr.operator === '||' || expr.operator === '??') {
    const left = expr.left;
    if (
      left &&
      left.type === 'MemberExpression' &&
      left.property &&
      left.property.name === 'children'
    ) {
      const right = expr.right;
      if (right && right.type === 'ArrayExpression' && right.elements.length === 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an expression matches the pattern: (obj.tasks || []) or (obj.tasks ?? [])
 */
function isTasksPattern(expr) {
  if (!expr || expr.type !== 'LogicalExpression') {
    return false;
  }

  // Check for (obj.tasks || []) or (obj.tasks ?? [])
  if (expr.operator === '||' || expr.operator === '??') {
    const left = expr.left;
    if (
      left &&
      left.type === 'MemberExpression' &&
      left.property &&
      left.property.name === 'tasks'
    ) {
      const right = expr.right;
      if (right && right.type === 'ArrayExpression' && right.elements.length === 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract the object name from an expression like (obj.children || []) or (obj.children ?? [])
 * Returns the object name or null
 */
function extractObjectName(expr) {
  if (!expr || expr.type !== 'LogicalExpression') {
    return null;
  }

  const left = expr.left;
  if (left && left.type === 'MemberExpression' && left.object) {
    if (left.object.type === 'Identifier') {
      return left.object.name;
    }
    // Handle nested member expressions if needed
  }

  return null;
}

