export const description = `
Unit tests for parameterization system.
`;

import { DefaultFixture } from '../framework/default_fixture.js';
import {
  IParamsSpec,
  paramsEquals,
  ParamSpecIterable,
  pcombine,
  pexclude,
  pfilter,
  poptions,
  TestGroup,
} from '../framework/index.js';

export const group = new TestGroup();

class ParamsTest extends DefaultFixture {
  public expectSpecEqual(act: ParamSpecIterable, exp: IParamsSpec[]) {
    const a = Array.from(act);
    this.expect(a.length === exp.length && a.every((x, i) => paramsEquals(x, exp[i])));
  }
}

group.test('options', null, ParamsTest, (t) => {
  t.expectSpecEqual(poptions('hello', [1, 2, 3]), [{ hello: 1 }, { hello: 2 }, { hello: 3 }]);
});

// TODO: somehow "subgroup" the combine tests

group.test('combine/none', null, ParamsTest, (t) => {
  t.expectSpecEqual(pcombine([]), []);
});

group.test('combine/zeroes and ones', null, ParamsTest, (t) => {
  t.expectSpecEqual(pcombine([[], []]), []);
  t.expectSpecEqual(pcombine([[], [{}]]), []);
  t.expectSpecEqual(pcombine([[{}], []]), []);
  t.expectSpecEqual(pcombine([[{}], [{}]]), [{}]);
});

group.test('combine/mixed', null, ParamsTest, (t) => {
  t.expectSpecEqual(
    pcombine([poptions('x', [1, 2]), poptions('y', ['a', 'b']), [{ p: 4 }, { q: 5 }], [{}]]), [
      { p: 4, x: 1, y: 'a' },
      { q: 5, x: 1, y: 'a' },
      { p: 4, x: 1, y: 'b' },
      { q: 5, x: 1, y: 'b' },
      { p: 4, x: 2, y: 'a' },
      { q: 5, x: 2, y: 'a' },
      { p: 4, x: 2, y: 'b' },
      { q: 5, x: 2, y: 'b' },
    ]);
});

group.test('filter', null, ParamsTest, (t) => {
  t.expectSpecEqual(pfilter([{ a: true, x: 1 }, { a: false, y: 2 }], (p) => p.a), [{ a: true, x: 1 }]);
});

group.test('exclude', null, ParamsTest, (t) => {
  t.expectSpecEqual(
    pexclude([{ a: true, x: 1 }, { a: false, y: 2 }], [{ a: true }, { a: false, y: 2 }]),
    [{ a: true, x: 1 }]);
});
