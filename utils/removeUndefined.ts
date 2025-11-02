export function removeUndefined(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj
      .map(item => removeUndefined(item))
      .filter(item => item !== undefined); // remove undefined entries in arrays
  }
  if (typeof obj === 'object') {
    const out: any = {};
    Object.keys(obj).forEach((k) => {
      const v = (obj as any)[k];
      const cleaned = removeUndefined(v);
      if (cleaned !== undefined) {
        out[k] = cleaned;
      }
    });
    return out;
  }
  return obj;
}
