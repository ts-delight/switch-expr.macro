const { createMacro, MacroError } = require('babel-plugin-macros');
const { once, uniqueId } = require('lodash');
const traverse = require('@babel/traverse').default;
const debug = require('debug')('switch-expr.macro');

const SwitchExpr = ({ references, state, babel }) => {
  debug('state:', state.file.ast);

  const t = babel.types;
  const refKeys = Object.keys(references);
  const invalidRefKeys = refKeys.filter(key => key !== 'default');

  if (invalidRefKeys.length > 0) {
    throw new MacroError(
      `Invalid import from switch-expr.macro: ${invalidRefKeys.join(', ')}`
    );
  }

  const processed = new Set();
  const refs = references.default;

  let identifiers = null;

  const collectIdentifiers = once(() => {
    identifiers = new Set();
    traverse(state.file.ast, {
      Identifier(path) {
        identifiers.add(path.node.name);
      },
    });
  });

  const isIdentifierPresent = name => {
    collectIdentifiers();
    return identifiers.has(name);
  };

  const processReference = (nodePath, references) => {
    if (processed.has(nodePath.node)) return;
    let parentPath = parentPathOf(nodePath);
    if (parentPath.node.type !== 'CallExpression') {
      throw new MacroError(
        `Expected Switch to be invoked as a function at ${stringifyLocStart(
          parentPath.node.loc
        )}`
      );
    }
    const args = parentPath.node.arguments;
    ensureArgsProcessed(args, references);
    if (args.length !== 1) {
      throw new MacroError(
        `Expected Switch to have been invoked with a single argument at ${stringifyLocStart(
          parentPath.node.loc
        )}`
      );
    }
    let target = parentPath.node.arguments[0];
    let wrappedStatement = null;
    if (target.type.match(/Expression$/)) {
      let id;
      while (true) {
        id = uniqueId('_switchTarget$');
        debug('Checking for identifier:', id);
        if (!isIdentifierPresent(id)) break;
      }
      wrappedStatement = t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(id), target),
      ]);
      target = t.identifier(id);
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

  const stringifyLocStart = loc => {
    if (!loc || !loc.start) return '';
    if (!loc.start.column) return `L${loc.start.line}`;
    return `L${loc.start.line}C${loc.start.column}`;
  };

  const processChain = (parentPath, target, references) => {
    const branches = {
      consequent: [],
      alternate: [],
    };

    let cases = [];
    let defaultCase = null;

    while (true) {
      const nextParentPath = parentPathOf(parentPath);
      if (nextParentPath.node.type === 'MemberExpression') {
        parentPath = nextParentPath;
        const memberNode = parentPath.node;
        const propName = memberNode.property.name;
        if (propName === 'case') {
          if (defaultCase)
            throw new Error('Cases can not be added after default case');
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath, propName);
          const args = parentPath.node.arguments;
          ensureArgsProcessed(args, references);
          debug('Encountered case:', parentPath.node.arguments);
          cases.push(parentPath.node.arguments);
        } else if (propName === 'default') {
          if (defaultCase)
            throw new Error('Default case has already been specified');
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath, propName);
          const args = parentPath.node.arguments;
          ensureArgsProcessed(args, references);
          defaultCase = parentPath.node.arguments[0];
          debug('Encountered default case:', defaultCase);
        } else if (propName === 'end') {
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath, propName);
          return {
            topMostPath: parentPath,
            resultExpr: makeConditional(
              cases,
              defaultCase || t.identifier('undefined'),
              target
            ),
          };
        } else {
          throw new MacroError(
            `Unexpected member invocation on Switch chain: ${propName} at ${stringifyLocStart(
              memberNode.loc
            )}`
          );
        }
      } else {
        throw new Error(
          `Expected the Switch-chain (started at ${stringifyLocStart(
            parentPath.node.loc
          )}) to have been terminated with an end`
        );
      }
    }
  };

  const assertCallExpr = (parentPath, propName) => {
    if (parentPath.node.type !== 'CallExpression') {
      throw new MacroError(
        `Expected member ${propName} to have been invoked as a function at ${stringifyLocStart(
          parentPath.node.loc
        )}`
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

  const ensureSingleArg = (parentPath, propName) => {
    if (parentPath.node.arguments.length !== 1) {
      throw new MacroError(
        `Expected member ${propName} to have been invoked with one argument at ${stringifyLocStart(
          parentPath.node.loc
        )}`
      );
    }
    return parentPath.node.arguments[0];
  };

  const assertExprLike = (arg, parentPath, propName) => {
    if (
      arg.type !== 'Identifier' &&
      !arg.type.match(/Expression$/) &&
      !arg.type.match(/Literal$/)
    ) {
      throw new MacroError(
        `Expected argument passed to ${propName} to have been an identifier, literal or expression at ${stringifyLocStart(
          parentPath.node.loc
        )}`
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
