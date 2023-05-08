/**
 * A JSON parser
 * ==================
 * data Json = 
 *    JsonNull
 *    | JsonBool Bool
 *    | JsonNumber Number
 *    | JsonString String
 *    | JsonArray [Json]
 *    | JsonObject [(String, Json)]
 */

import { Lazy, Parser, char, digit, item, str, whitespaces } from "../parser.ts";

type JsonNull = {
  type: 'null'
}

const NULL: JsonNull = { type: 'null' };

type JsonBool = {
  type: 'boolean';
  value: boolean;
}

const TRUE: JsonBool = { type: 'boolean', value: true };
const FALSE: JsonBool = { type: 'boolean', value: false };

type JsonNumber = {
  type: 'number';
  value: number;
}

type JsonString = {
  type: 'string';
  value: string;
}

type Json = JsonNull | JsonBool | JsonNumber | JsonString
  | { type: 'array', value: Json[] }
  | { type: 'object', value: { key: string, value: Json }[] }

// Utility functions

// Parsing between enclosure
const between = <Left, Right, Middle>(left: Parser<Left>, right: Parser<Right>, middle: Parser<Middle>) => left.bind(_ => middle.bind(m => right.bind(_ => Parser.pure(m))));

// JSON Null
const jsonNull: Parser<Json> = str('null').fmap(_ => NULL);

// JSON Bool
const jsonBool: Parser<Json> = Parser.choice(
  str('true').fmap(_ => TRUE),
  str('false').fmap(_ => FALSE)
);


/**
 * JSONString string
 * ===============
 * JsonString = " ExtChar* "
 * ExtChar = ValidChar | EscapedChar
 * ValidChar is any character with ASCII code from 32 to 69631, except " and \
 * EscapedChar = \ ( " | \ | / | b | f | n | r | t | u Hex Hex Hex Hex )
 * Hex = Digit | a | b | c | d | e | f | A | B | C | D | E | F
 */

const isHex = (c: string) => c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F';
const isValidChar = (c: string) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 69631 && c !== '"' && c !== '\\';

const SPECIAL_ESCAPE_CHARS = [
  ['"', '"'],
  ['\\', '\\'],
  ['/', '/'],
  ['b', '\b'],
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
].map(([c, v]) => char(c).bind(_ => Parser.pure(v)))

const validChar = item.parseIf(isValidChar, 'a valid character');
const hexChar = item.parseIf(isHex, 'a hex character');
const hexString = hexChar.bind(c1 => hexChar.bind(c2 => hexChar.bind(c3 => hexChar.bind(c4 => Parser.pure([c1, c2, c3, c4].join(''))))));
const unicode = char('u').bind(_ => hexString.bind(hex => Parser.pure(String.fromCharCode(parseInt(hex, 16)))));
const escapedChar = char('\\').bind(_ => Parser.choice(unicode, Parser.multipleChoice(...SPECIAL_ESCAPE_CHARS)));
const string = between(char('"'), char('"'), Parser.many(Parser.choice(validChar, escapedChar)).bind(cs => Parser.pure(cs.join(''))));
const jsonString: Parser<Json> = string.fmap(value => ({ type: 'string', value }));

/**
 * JSONNumber number
 * ===============
 * number = -? integer fraction? exponent?
 * integer = 0 | [1-9] [0-9]*
 * fraction = . [0-9]+
 * exponent = (e | E) [-+]? [0-9]+
 */

// Composite JSON
const none = Parser.pure('');
const nonZero = digit.parseIf(c => c !== '0', 'a non-zero digit');
const integer = Parser.choice(char('0'),
  nonZero.bind(c => Parser.many(digit)
    .bind(cs => Parser.pure([c, ...cs].join('')))));
const fraction = char('.').bind(_ => Parser.some(digit).bind(cs => Parser.pure(`.${cs.join('')}`)));
const exponent = Parser.choice(char('e'), char('E'))
  .bind(_ => Parser.multipleChoice(char('+'), char('-'), none)
    .bind(sign => Parser.some(digit)
      .bind(digits => Parser.pure(`E${sign}${digits.join('')}`))));
const number = Parser.choice(char('-'), none)
  .bind(sign =>
    integer.bind(int =>
      Parser.choice(fraction, none).bind(frac =>
        Parser.choice(exponent, none).bind(exp =>
          Parser.pure(`${sign}${int}${frac}${exp}`)))))
  .fmap(Number);
const jsonNumber: Parser<Json> = number.fmap(value => ({ type: 'number', value }));

// Array, Object requires recursion and thus cannot be defined as a single parser, but rather as a lazy parser
let lazyJson: () => Parser<Json>;

// JSON Array
const lazyJsonElement = () => between(whitespaces, whitespaces, lazyJson());
const lazyArray = () => between(char('['), char(']'), Parser.sepBy(lazyJsonElement(), char(',')));
const lazyJsonArray: Lazy<Parser<Json>> = () => lazyArray().fmap(value => ({ type: 'array', value }));

// JSON Object
const key = between(whitespaces, whitespaces, string);
const lazyMember = () => key.bind(key => char(':').bind(_ => lazyJsonElement().bind(value => Parser.pure({ key, value }))));
const lazyObject: Lazy<Parser<Json>> = () => between(char('{'), char('}'),
  Parser.choice(
    Parser.sepBy(lazyMember(), char(',')),
    whitespaces.fmap(_ => [])
  )
).fmap(value => ({ type: 'object', value }));

lazyJson = () => between(whitespaces, whitespaces, Parser.multipleLazyChoice(
  () => jsonNull,
  () => jsonBool,
  () => jsonString,
  () => jsonNumber,
  lazyJsonArray,
  lazyObject
))

export default {
  jsonNull,
  jsonBool,
  jsonString,
  jsonNumber,
  parser: lazyJson()
};