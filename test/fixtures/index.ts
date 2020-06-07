import Switch from '../../lib/switch-expr.macro';

const fn = <T>(i: T) => i;

export const r1 = Switch(10)
  .case(1, fn(2))
  .case(2, fn(3))
  .case(fn(3), fn(4) + 1)();

export const r2 = Switch(10)
  .case(1, fn(2))
  .case(2, fn(3))
  .case(
    fn(3),
    Switch(20)
      .case(1, 2)
      .case(2, 3)()
  )
  .default(5)();

export const r3 = Switch(10).default(10)();

export const r4 = Switch(2 + fn(10))
  .case(12, fn(20))
  .default(10)();

export const r5 = Switch(10)
  .case(Switch(10).default(10)(), fn(20))
  .case(2, fn(3))
  .case(
    fn(3),
    Switch(20)
      .case(1, 2)
      .case(2, 3)()
  )();
