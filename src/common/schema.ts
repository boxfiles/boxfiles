import Type from "typebox";

export type Brand<TBase, TBrand extends string> = TBase & {
    readonly __brand: TBrand;
};

export const NonBlankStringSchema = Type.String({ pattern: ".*\\S.*" });

export const BrandedStringSchema = <TBrand extends string>() =>
    Type.Unsafe<Brand<string, TBrand>>(NonBlankStringSchema);
