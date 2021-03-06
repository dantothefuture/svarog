import {
  JSONSchema7,
  JSONSchema7Definition,
} from 'json-schema';

import cel from '../cel';
import compile from './';

export default function(schema: JSONSchema7, ref: string, strictRef: string): string {
  const properties = schema.properties || {};
  const requiredProperties = new Set(schema.required || []);
  const allProperties = Object.keys(properties);
  const actualKeys = cel.ref(cel.call(cel.ref(ref, 'keys')));
  const actualKeysSize = cel.call(cel.ref(actualKeys, 'size'));

  let guard = cel.calc(ref, 'is', cel.ref('map'));

  if (allProperties.length > 0) {
    const expectedKeys = cel.val(allProperties);
    guard = cel.calc(guard, '&&', cel.call(cel.ref(actualKeys, 'hasOnly'), expectedKeys));
  }

  allProperties.forEach(key => {
    const value = properties[key];
    const valueRef = cel.ref(ref, key);

    const loose = cel.calc(strictRef, '==', cel.val(false));
    const includesKey = cel.call(cel.ref(actualKeys, 'hasAll'), cel.val([key]));
    const doesNotIncludeKey = cel.calc(includesKey, '==', cel.val(false));

    const skipAssert = requiredProperties.has(key)
      ? cel.calc(loose, '&&', doesNotIncludeKey)
      : doesNotIncludeKey;

    const valueGuard = typeof value === 'boolean'
      ? value
        ? includesKey
        : doesNotIncludeKey
      : compile(value, valueRef, strictRef);

    guard = cel.calc(guard, '&&', cel.calc(skipAssert, '||', valueGuard));
  });

  if (typeof schema.minProperties === 'number') {
    const minPropertiesGuard = cel.calc(actualKeysSize, '>=', cel.val(schema.minProperties));
    guard = cel.calc(guard, '&&', minPropertiesGuard);
  }

  if (typeof schema.maxProperties === 'number') {
    const maxPropertiesGuard = cel.calc(actualKeysSize, '<=', cel.val(schema.maxProperties));
    guard = cel.calc(guard, '&&', maxPropertiesGuard);
  }

  // TODO: propertyNames
  // TODO: dependencies
  // TODO: patternProperties

  return guard;
}
