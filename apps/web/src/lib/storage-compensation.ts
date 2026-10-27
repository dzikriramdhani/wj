type RemoveResult = { error?: unknown };

/**
 * Best-effort compensation for objects uploaded by the current request only.
 * Callers must supply only paths they generated and successfully uploaded.
 */
export async function compensateUploadedObjects(
  paths: readonly string[],
  remove: (ownedPaths: string[]) => Promise<RemoveResult>,
) {
  if (!paths.length) return true;

  try {
    const { error } = await remove([...paths]);
    return !error;
  } catch {
    return false;
  }
}
