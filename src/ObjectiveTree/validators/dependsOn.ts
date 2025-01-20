export const validateDependsOnInput = (dependsOn: string) => {
  return /t|T|G|g\d+\.?\d+(, |,)*$/.test(dependsOn);
};

export const validateDependsOn = (dependsOn: string[], allNodes: string[]) => {
  const allNodesSet = new Set(allNodes);
  return dependsOn.every((dep) => {
    const isValid = allNodesSet.has(dep);
    if (!isValid) {
      throw new Error(
        `Invalid dependsOn input node should exist in the goal model: ${dep}`
      );
    }
    return isValid;
  });
};
