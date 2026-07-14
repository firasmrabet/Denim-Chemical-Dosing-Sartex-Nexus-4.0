declare module "regression" {
  export interface Result {
    equation: number[];
    r2: number;
    string: string;
    points: [number, number][];
    predict: (x: number) => [number, number];
  }
  interface RegressionAPI {
    linear(data: [number, number][], options?: { precision?: number }): Result;
    exponential(data: [number, number][], options?: { precision?: number }): Result;
    logarithmic(data: [number, number][], options?: { precision?: number }): Result;
    power(data: [number, number][], options?: { precision?: number }): Result;
    polynomial(
      data: [number, number][],
      options?: { precision?: number; order?: number },
    ): Result;
  }
  const regression: RegressionAPI;
  export default regression;
}
