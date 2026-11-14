/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * assembly/index/calculateLoad
 * @param cpu `f64`
 * @param mem `f64`
 * @returns `f64`
 */
export declare function calculateLoad(cpu: number, mem: number): number;
/**
 * assembly/index/getRank
 * @param load `f64`
 * @returns `i32`
 */
export declare function getRank(load: number): number;
