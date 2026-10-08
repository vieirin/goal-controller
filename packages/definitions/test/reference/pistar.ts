// Pinned from vn/rt-langium-notation @ b61def8: packages/ui/lib/workbench/pistar.ts (composeNodeText)
// (scripts/sync-reference.sh; do not edit)
export const composeNodeText = (
  id: string,
  name: string,
  notation: string | null,
): string => {
  const base = `${id}: ${name.trim()}`;
  return notation && notation.trim() ? `${base} [${notation.trim()}]` : base;
};
