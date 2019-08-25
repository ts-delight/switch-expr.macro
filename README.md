# About

An expression-oriented fluent alternative to javascript's switch-statement that compiles away to ternary expressions.

## Example

Source:

```js
import Switch from 'switch-expr.macro';

const isAllowed = Switch(userType)
  .case('employee', true)
  .else('customer', false)
  .default(false)();
```

Compiled output:

```js
const isAllowed =
  userType === 'employee' ? true : userType === 'customer' ? false : false;
```

## Why ?

1. Javascript switch-else statements are not expressions.
2. Ternary expressions are ugly and even more so when nested.
3. Solutions like [lodash.cond](https://lodash.com/docs/latest#cond) have unnecessary function invocation overhead and are less readable.
   To ensure lazy evaluation we need to wrap each branch in function.
4. We love fluent APIs.

This plugin is likely to become obsolete once [do-expressions](https://github.com/tc39/proposal-do-expressions) become supported by typescript ([Relevant issue](https://github.com/Microsoft/TypeScript/issues/13156)).
If you don't care about type checking, then you can try out [this babel-plugin](https://babeljs.io/docs/en/babel-plugin-proposal-do-expressions).

## Installation

This utility is implemented as a [babel-macro](https://github.com/kentcdodds/babel-plugin-macros).

Refer babel's [setup instructions](https://babeljs.io/setup) to learn how to setup your project to use [babel](https://babeljs.io) for compilation.

1. Install `babel-plugin-macros` and `switch-expr.macro`:

```js
npm install --save-dev babel-plugin-macros switch-expr.macro
```

2. Add babel-plugin-macros to .babelrc (if not already preset):

```js
// .babelrc

module.exports = {
  presets: [
    // ... other presets
  ],
  plugins: [
    'babel-plugin-macros', // <-- REQUIRED
    // ... other plugins
  ],
};
```

## Features

- Branches are evaluated lazily

```js
// src/foo.js

import Switch from 'switch-expr.macro';

const isAllowed = Switch(userType)
    .case("employee", isEmployeeAllowed())
    .else("customer", isCustomerAllowed())
    .default(false)();

// if userType is "employee" then isCustomerAllowed function will never be
// executed
```

## Usage with TypeScript

This library is type-safe and comes with type definitions.

All code must be processed through babel. Compilation through tsc (only) is not supported.

Recommended babel configuration:

```js
// .babelrc

module.exports = {
  presets: [
    '@babel/preset-typescript',
    // ... other presets
  ],
  plugins: [
    'babel-plugin-macros',
    // ... other plugins
  ],
};
```

### Flow based type inference

One caveat is that TypeScript's flow-based type inference will not treat `.case`, `.default` branches same as normal `case/default` branches.

AFAIK, currently there is no workaround for feasible.

## Caveats

Every Switch/case/default chain fluent must end with an terminating invocation without interruptions.

For example:

```js
const a = 10;
const intermediate = Switch(a).case(1, 2);
const result = intermediate();
```

Above code will fail to compile.

Because the entire Switch/case/end chain is compiled away, anything returned by Switch/case/default can not be assigned, referenced, or used in any computation.

## You may also like:

1. **[if-expr.macro](https://github.com/ts-delight/if-expr.macro):** Similar utility, providing a fluent expression-oriented macro replacement for if statement

## License

MIT
