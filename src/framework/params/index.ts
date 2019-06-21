export * from './combine.js';
export * from './filter.js';
export * from './options.js';
export * from './exclude.js';

export interface IParamsAny {
    [k: string]: any;
}
export type ParamAnyIterable = Iterable<IParamsAny>;
export type ParamAnyIterator = IterableIterator<IParamsAny>;

export type ParamSpec = boolean | number | string;
export interface IParamsSpec {
    [k: string]: ParamSpec;
}
export type ParamSpecIterable = Iterable<IParamsSpec>;
export type ParamSpecIterator = IterableIterator<IParamsSpec>;

export function paramsEquals(x: IParamsSpec | null, y: IParamsSpec | null): boolean {
    if (x === y) {
        return true;
    }
    if (x === null || y === null) {
        return false;
    }

    for (const xk of Object.keys(x)) {
        if (!y.hasOwnProperty(xk)) {
            return false;
        }
        if (x[xk] !== y[xk]) {
            return false;
        }
    }

    for (const yk of Object.keys(y)) {
        if (!x.hasOwnProperty(yk)) {
            return false;
        }
    }
    return true;
}

export function paramsSupersets(sup: IParamsSpec | null, sub: IParamsSpec | null): boolean {
    if (sub === null) {
        return true;
    }
    if (sup === null) {  // && sub !== undefined
        return false;
    }
    for (const k of Object.keys(sub)) {
        if (!sup.hasOwnProperty(k) || sup[k] !== sub[k]) {
            return false;
        }
    }
    return true;
}
