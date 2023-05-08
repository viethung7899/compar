/**
 * Simple math grammar
 * ===================
 * expr ::= term (addop term)*
 * term ::= factor (mulop factor)*
 * factor ::= numeric | ( expr )
 * addop ::= + | -
 * mulop ::= * | /
 * number ::= digit+
 * digit ::= [0-9]
 */

import { Lazy, Parser, char, digit, symbol, token } from "../parser.ts";
export type Operator = '+' | '-' | '*' | '/';

export type Expression = {
  type: "number",
  value: number
} | {
  type: "binaryExpression",
  operator: Operator,
  left: Expression,
  right: Expression
}

export const Operation: Record<Operator, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
} as const;

const makeExpression = (op: Operator) => (left: Expression) => (right: Expression): Expression => ({
  type: "binaryExpression",
  operator: op,
  left, right
});

const operator = (op: Operator) => symbol(op).fmap(_ => makeExpression(op));

const plusMinus = Parser.choice(operator('+'), operator('-'))
const mulDiv = Parser.choice(operator('*'), operator('/'))
const intString = Parser.some(digit)
const realString = intString.bind(ds => char('.').bind(_ => intString.bind(rs => Parser.pure([...ds, '.', ...rs]))))
const numeric: Parser<Expression> = token(Parser.choice(realString, intString))
  .bind(s => Parser.pure(Number(s.join(''))))
  .fmap(value => ({ type: "number", value }))

let lazyExpr: Lazy<Parser<Expression>>;
let lazyFactor: Lazy<Parser<Expression>>;
let lazyTerm: Lazy<Parser<Expression>>;

lazyExpr = () => Parser.chainLeft(lazyTerm(), plusMinus);
lazyFactor = () => Parser.lazyChoice(
  () => numeric,
  () => symbol('(').bind(_ => lazyExpr().bind(e => symbol(')').bind(_ => Parser.pure(e)))
))
lazyTerm = () => Parser.chainLeft(lazyFactor(), mulDiv);


export default {
  expr: lazyExpr(),
  plusMinus
}