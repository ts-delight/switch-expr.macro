import * as path from 'path';
import { transformFileSync } from '@babel/core';

test('Transformations', () => {
  expect(transformFileSync(path.join(__dirname, 'fixtures/index.ts'))!.code)
    .toMatchInlineSnapshot(`
    "\\"use strict\\";

    Object.defineProperty(exports, \\"__esModule\\", {
      value: true
    });
    exports.r5 = exports.r4 = exports.r3 = exports.r2 = exports.r1 = void 0;

    const fn = i => i;

    const r1 = 10 === 1 ? fn(2) : 10 === 2 ? fn(3) : 10 === fn(3) ? fn(4) + 1 : undefined;
    exports.r1 = r1;
    const r2 = 10 === 1 ? fn(2) : 10 === 2 ? fn(3) : 10 === fn(3) ? 20 === 1 ? 2 : 20 === 2 ? 3 : undefined : 5;
    exports.r2 = r2;
    const r3 = 10;
    exports.r3 = r3;

    const r4 = function () {
      const _switchTarget$ = 2 + fn(10);

      return _switchTarget$ === 12 ? fn(20) : 10;
    }();

    exports.r4 = r4;
    const r5 = 10 === 10 ? fn(20) : 10 === 2 ? fn(3) : 10 === fn(3) ? 20 === 1 ? 2 : 20 === 2 ? 3 : undefined : undefined;
    exports.r5 = r5;"
  `);
});
