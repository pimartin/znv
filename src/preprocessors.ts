import * as z from "zod";

import { assertNever } from "./util";

const { ZodFirstPartyTypeKind: TypeName } = z;

export function getStringPreprocessorByZodType(
  spec: z.ZodFirstPartySchemaTypes
): (arg: string | undefined) => unknown {
  const { typeName } = spec._def;

  switch (typeName) {
    case TypeName.ZodString:
    case TypeName.ZodEnum:
      return (arg) => arg;

    case TypeName.ZodNumber:
      return (arg) =>
        z
          .string()
          .regex(/^\d+(\.\d+)?$/, {
            message: "Value doesn't appear to be a number!",
          })
          .transform(Number)
          .parse(arg);

    case TypeName.ZodBigInt:
      return (arg) =>
        z
          .string()
          .regex(/^\d+$/, { message: "Value doesn't appear to be a bigint!" })
          .transform(BigInt)
          .parse(arg);

    case TypeName.ZodBoolean:
      return (arg) =>
        z
          .union([
            z.enum(["true", "yes", "1"]).transform(() => true),
            z.enum(["false", "no", "0"]).transform(() => false),
          ])
          .parse(arg);

    case TypeName.ZodArray:
    case TypeName.ZodObject:
    case TypeName.ZodTuple:
    case TypeName.ZodRecord:
      return (arg) => {
        if (!arg) return arg;
        return JSON.parse(arg);
      };

    case TypeName.ZodEffects:
      // eslint-disable-next-line unicorn/consistent-destructuring -- false positive
      return getStringPreprocessorByZodType(spec._def.schema);

    case TypeName.ZodDefault:
      // eslint-disable-next-line unicorn/consistent-destructuring -- false positive
      return getStringPreprocessorByZodType(spec._def.innerType);

    case TypeName.ZodOptional: {
      const { innerType } = spec._def;
      return (arg) => {
        if (arg == null) return undefined;
        return getStringPreprocessorByZodType(innerType);
      };
    }

    case TypeName.ZodNullable: {
      const { innerType } = spec._def;
      return (arg) => {
        if (arg == null) return null;
        return getStringPreprocessorByZodType(innerType);
      };
    }

    case TypeName.ZodDate:
      return (arg) => {
        if (!arg) return arg;
        return new Date(arg);
      };

    case TypeName.ZodLiteral:
      switch (typeof spec._def.value) {
        case "number":
          return getStringPreprocessorByZodType({
            _def: { typeName: TypeName.ZodNumber },
          } as z.ZodFirstPartySchemaTypes);
        case "string":
          return getStringPreprocessorByZodType({
            _def: { typeName: TypeName.ZodString },
          } as z.ZodFirstPartySchemaTypes);
        case "boolean":
          return getStringPreprocessorByZodType({
            _def: { typeName: TypeName.ZodBoolean },
          } as z.ZodFirstPartySchemaTypes);
        default:
          return (arg) => arg;
      }

    case TypeName.ZodUnion:
    case TypeName.ZodIntersection:
    case TypeName.ZodNativeEnum:
      throw new Error(
        `Zod type not yet supported: "${typeName}" (PRs welcome)`
      );

    case TypeName.ZodUndefined:
    case TypeName.ZodNull:
    case TypeName.ZodAny:
    case TypeName.ZodUnknown:
    case TypeName.ZodVoid:
    case TypeName.ZodNever:
    case TypeName.ZodLazy:
    case TypeName.ZodFunction:
    case TypeName.ZodPromise:
    case TypeName.ZodMap:
    case TypeName.ZodSet:
      throw new Error(`Zod type not supported at top level: ${typeName}`);

    default: {
      assertNever(typeName);
    }
  }
}

export function getPreprocessedValidator(spec: z.ZodFirstPartySchemaTypes) {
  return z.preprocess(
    getStringPreprocessorByZodType(spec) as (arg: unknown) => unknown,
    spec
  );
}
