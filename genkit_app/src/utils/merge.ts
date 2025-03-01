export function mergeDeep<T>(target: T, overrides: Partial<T>): T {
  // If either value is not an object, return the override or target
  if (
    typeof target !== "object" ||
    target === null ||
    typeof overrides !== "object" ||
    overrides === null
  ) {
    return (overrides as T) ?? target;
  }

  // Create a new object to avoid mutating the original
  const result = { ...target };

  // Iterate through all properties in the override object
  for (const key in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const targetValue = (target as any)[key];
      const overrideValue = (overrides as any)[key];

      // If both values are objects, recursively merge them
      if (
        typeof targetValue === "object" &&
        targetValue !== null &&
        typeof overrideValue === "object" &&
        overrideValue !== null
      ) {
        // process arrays
        if (Array.isArray(targetValue) && Array.isArray(overrideValue)) {
          // remove duplicates
          (result as any)[key] = [
            ...new Set([...targetValue, ...overrideValue]),
          ];
        } else {
          (result as any)[key] = mergeDeep(targetValue, overrideValue);
        }
      } else {
        // Otherwise, use the override value if it exists, or keep the target value
        (result as any)[key] =
          overrideValue !== undefined ? overrideValue : targetValue;
      }
    }
  }

  return result as T;
}
