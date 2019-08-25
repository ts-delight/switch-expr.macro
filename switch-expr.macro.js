const { createMacro, MacroError } = require('babel-plugin-macros');
const pkgName = 'switch-expr.macro';
const debug = require('debug')(pkgName);

const SwitchExpr = ({ references, state, babel }) => {
  debug('Initial state:', state);

  // Utilities to help with ast construction
  const t = babel.types;
  // Complete source code if file
  const { code } = state.file;
  const refKeys = Object.keys(references);
  const invalidRefKeys = refKeys.filter(key => key !== 'default');

  if (invalidRefKeys.length > 0) {
    throw new MacroError(
      `Invalid import from switch-expr.macro: ${invalidRefKeys.join(', ')}`
    );
  }

  const processed = new Set();
  const refs = references.default;

  // Print well formatted errors
  const failWith = (errCode, node, message) => {
    if (node.loc) console.log(codeFrameColumns(code, node.loc, { message }));
    const error = new Error(`ERR${errCode}: ${message}`);
    error.code = `ERR${errCode}`;
    throw error;
  };

  const processReference = (nodePath, references) => {
    if (processed.has(nodePath.node)) return;
    let parentPath = parentPathOf(nodePath);
    if (parentPath.node.type !== 'CallExpression') {
      failWith(
        1,
        parentPath.node,
        'Expected Switch to be invoked as a function'
      );
    }
    const args = parentPath.node.arguments;
    ensureArgsProcessed(args, references);
    if (args.length !== 1) {
      failWith(
        2,
        parentPath.node,
        'Expected Switch to have been invoked with a single argument'
      );
    }
    let target = parentPath.node.arguments[0];
    let wrappedStatement = null;
    if (target.type.match(/Expression$/)) {
      const id = parentPath.scope.generateUidIdentifier('_switchTarget$');
      wrappedStatement = t.variableDeclaration('const', [
        t.variableDeclarator(id, target),
      ]);
      target = id;
    }
    let { topMostPath, resultExpr } = processChain(
      parentPath,
      target,
      references
    );
    if (wrappedStatement) {
      resultExpr = t.callExpression(
        t.functionExpression(
          null,
          [],
          t.blockStatement([wrappedStatement, t.returnStatement(resultExpr)])
        ),
        []
      );
    }
    topMostPath.replaceWith(resultExpr);
    processed.add(nodePath.node);
  };

  const parentPathOf = nodePath => nodePath.findParent(() => true);

  const processChain = (parentPath, target, references) => {
    let cases = [];
    let defaultCase = null;

    while (true) {
      const nextParentPath = parentPathOf(parentPath);
      if (
        t.isMemberExpression(nextParentPath.node) &&
        nextParentPath.node.object === parentPath.node
      ) {
        parentPath = nextParentPath;
        const memberNode = parentPath.node;
        const propName = memberNode.property.name;
        if (propName === 'case') {
          if (defaultCase)
            failWith(
              3,
              nextParentPath.node,
              'Cases can not be added after default case'
            );
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath, propName);
          const args = parentPath.node.arguments;
          ensureArgsProcessed(args, references);
          debug('Encountered case:', parentPath.node.arguments);
          cases.push(parentPath.node.arguments);
        } else if (propName === 'default') {
          if (defaultCase)
            failWith(
              4,
              nextParentPath.node,
              'Default case has already been specified'
            );
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath, propName);
          const args = parentPath.node.arguments;
          ensureArgsProcessed(args, references);
          defaultCase = parentPath.node.arguments[0];
          debug('Encountered default case:', defaultCase);
        } else {
          failWith(
            5,
            memberNode,
            'Unexpected member invocation on Switch chain'
          );
        }
      } else if (
        t.isCallExpression(nextParentPath.node) &&
        nextParentPath.node.callee === parentPath.node
      ) {
        return {
          topMostPath: nextParentPath,
          resultExpr: makeConditional(
            cases,
            defaultCase || t.identifier('undefined'),
            target
          ),
        };
      } else {
        failWith(6, parentPath.node, 'Unterminated Switch-chain');
      }
    }
  };

  const assertCallExpr = (parentPath, propName) => {
    if (!t.isCallExpression(parentPath.node)) {
      failWith(
        7,
        parentPath.node,
        `Expected member ${propName} to have been invoked as a function`
      );
    }
  };

  const makeConditional = (cases, defaultCase, target) => {
    debug('Making conditional from: ', cases);
    if (cases.length === 0) return defaultCase;
    else {
      const [match, outcome] = cases[0];
      return t.conditionalExpression(
        t.binaryExpression('===', target, match),
        outcome,
        makeConditional(cases.slice(1), defaultCase, target)
      );
    }
  };

  const ensureArgsProcessed = (args, references) => {
    for (const arg of args) {
      for (let i = 0; i < references.length; i++) {
        const nodePath = references[i];
        const parent = nodePath.findParent(p => p.node === arg);
        if (!parent) continue;
        processReference(nodePath, references.slice(i + 1));
      }
    }
  };

  for (let i = 0; i < refs.length; i++) {
    const nodePath = refs[i];
    processReference(nodePath, refs.slice(i + 1));
  }
};

module.exports = createMacro(SwitchExpr);
