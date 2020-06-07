import { createMacro, MacroError } from 'babel-plugin-macros';
import { codeFrameColumns } from '@babel/code-frame';
import _debug from 'debug';
import * as t from '@babel/types';
import { NodePath } from '@babel/core';
import { Node } from '@babel/traverse';

const pkgName = 'switch-expr.macro';
const debug = _debug(pkgName);

export default createMacro(function SwitchExpr({ references, state }) {
  debug('Initial state:', state);

  // Complete source code if file
  const { code } = state.file;
  const refKeys = Object.keys(references);
  const invalidRefKeys = refKeys.filter((key) => key !== 'default');

  if (invalidRefKeys.length > 0) {
    throw new MacroError(
      `Invalid import from switch-expr.macro: ${invalidRefKeys.join(', ')}`
    );
  }

  const processed = new Set();
  const refs = references.default;

  // Print well formatted errors
  const failWith = (errCode: number, node: t.Node, message: string) => {
    if (node.loc) console.log(codeFrameColumns(code, node.loc, { message }));
    const qualifiedCode = `ERR:SwitchExpr:${errCode}`;
    const error: Error & { code?: string } = new Error(
      `${qualifiedCode}: ${message}`
    );
    error.code = qualifiedCode;
    throw error;
  };

  const processReference = (
    nodePath: NodePath<Node>,
    references: NodePath<Node>[]
  ) => {
    if (processed.has(nodePath.node)) return;
    let parentPath = parentPathOf(nodePath);
    if (parentPath.node.type !== 'CallExpression') {
      failWith(
        1,
        parentPath.node,
        'Expected Switch to be invoked as a function'
      );
    }
    var callNode = parentPath.node as t.CallExpression;
    const args = callNode.arguments;

    ensureExpressionArr(args);
    ensureArgsProcessed(args, references);
    if (args.length !== 1) {
      failWith(
        2,
        callNode,
        'Expected Switch to have been invoked with a single argument'
      );
    }
    let target = args[0];
    let wrappedStatement = null;
    if (target.type.match(/Expression$/)) {
      var targetExpr = target as t.Expression;
      const id = parentPath.scope.generateUidIdentifier('_switchTarget$');
      wrappedStatement = t.variableDeclaration('const', [
        t.variableDeclarator(id, targetExpr),
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

  const parentPathOf = (nodePath: NodePath<Node>) =>
    nodePath.findParent(() => true);

  const processChain = (
    parentPath: NodePath<Node>,
    target: t.Expression,
    references: NodePath<Node>[]
  ) => {
    let cases: t.Expression[][] = [];
    let defaultCase = null;

    while (true) {
      const nextParentPath = parentPathOf(parentPath);
      if (
        t.isMemberExpression(nextParentPath.node) &&
        nextParentPath.node.object === parentPath.node
      ) {
        parentPath = nextParentPath;
        const memberNode = parentPath.node as t.MemberExpression;
        const propName: string = memberNode.property.name;
        if (propName === 'case') {
          if (defaultCase)
            failWith(
              3,
              nextParentPath.node,
              'Cases can not be added after default case'
            );
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath.node, propName);
          const args = parentPath.node.arguments;
          ensureExpressionArr(args);
          ensureArgsProcessed(args, references);
          debug('Encountered case:', args);
          cases.push(args);
        } else if (propName === 'default') {
          if (defaultCase)
            failWith(
              4,
              nextParentPath.node,
              'Default case has already been specified'
            );
          parentPath = parentPathOf(parentPath);
          assertCallExpr(parentPath.node, propName);
          const args = parentPath.node.arguments;
          ensureExpressionArr(args);
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
        if (defaultCase) {
          ensureExpression(defaultCase);
        }
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

  function ensureExpression(node: t.Node): asserts node is t.Expression {
    if (!t.isExpression(node)) {
      failWith(
        8,
        node,
        `Expected function argument to be an expression but found ${node.type} instead`
      );
    }
  }

  function ensureExpressionArr(
    nodes: t.Node[]
  ): asserts nodes is t.Expression[] {
    for (const n of nodes) {
      ensureExpression(n);
    }
  }

  function assertCallExpr(
    node: t.Node,
    propName: string
  ): asserts node is t.CallExpression {
    if (!t.isCallExpression(node)) {
      failWith(
        7,
        node,
        `Expected member ${propName} to have been invoked as a function`
      );
    }
  }

  const makeConditional = (
    cases: t.Expression[][],
    defaultCase: t.Expression,
    target: t.Expression
  ): t.Expression => {
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

  const ensureArgsProcessed = (
    args: t.Expression[],
    references: NodePath<t.Node>[]
  ) => {
    for (const arg of args) {
      for (let i = 0; i < references.length; i++) {
        const nodePath = references[i];
        const parent = nodePath.findParent((p) => p.node === arg);
        if (!parent) continue;
        processReference(nodePath, references.slice(i + 1));
      }
    }
  };

  for (let i = 0; i < refs.length; i++) {
    const nodePath = refs[i];
    processReference(nodePath, refs.slice(i + 1));
  }
});
