// Types
type Position = {
  line: number;
  column: number;
};

type State = {
  position: Position;
  text: string;
}

type Maybe<T> = T | null;

type ParserError = {
  isError: true;
  position: Position;
  message: string;
}

type ParserResult<T> = {
  isError: false;
  value: T;
  state: State;
}

type Result<T> = ParserError | ParserResult<T>;
export type Lazy<T> = () => T;

export const makeInput = (text: string): State => ({
  text,
  position: {
    line: 1,
    column: 1
  }
})

const getCharacterFromInput = (input: State): Maybe<[string, State]> => {
  const text = input.text;
  if (text.length === 0) return null;
  const { line, column } = input.position;
  const first = text[0];
  if (first === '\n') return [
    first, {
      position: {
        line: line + 1,
        column: 1
      },
      text: text.slice(1)
    }
  ];
  return [
    first, {
      position: {
        line,
        column: column + 1
      },
      text: text.slice(1)
    }
  ];
};

type ParserFn<A> = (input: State) => Result<A>;

export class Parser<A> {
  readonly parse: ParserFn<A>;
  static EMPTY_ERRROR: ParserError = {
    isError: true,
    position: { line: 1, column: 1 },
    message: 'Empty parser'
  }

  public constructor(parse: ParserFn<A>) {
    this.parse = parse;
  }

  // bind :: Parser a -> (a -> Parser b) -> Parser b
  public bind<B>(f: (a: A) => Parser<B>): Parser<B> {
    return new Parser<B>(input => {
      const result = this.parse(input);
      if (result.isError) return result;
      const { value, state: rest } = result;
      return f(value).parse(rest);
    })
  }

  public parseIf(predicate: (a: A) => boolean, description: string) {
    return new Parser(input => {
      const result = this.parse(input);
      if (result.isError) return {
        ...result,
        message: `Expected ${description}, but reach the end of input`
      }
      if (predicate(result.value)) return result;
      return {
        isError: true,
        position: input.position,
        message: `Expected ${description}, but got ${result.value}`
      }
    })
  }

  // pure :: a -> Parser a
  static pure<A>(a: A) {
    return new Parser(input => ({
      isError: false,
      value: a,
      state: input
    }));
  }

  // fmap :: (a -> b) -> Parser a -> Parser b
  fmap<B>(f: (a: A) => B) {
    return new Parser(input => {
      const result = this.parse(input);
      if (result.isError) return result;
      return {
        ...result,
        value: f(result.value)
      }
    });
  }

  apply<B>(fp: Parser<(a: A) => B>): Parser<B> {
    return new Parser(input => {
      const result = fp.parse(input);
      if (result.isError) return result;
      const { value: f, state: rest } = result;
      return this.fmap(f).parse(rest);
    })
  }

  static empty<A>() {
    return new Parser<A>(input => ({
      isError: true,
      position: input.position,
      message: 'Empty parser'
    }))
  }

  static choice<A>(p1: Parser<A>, p2: Parser<A>) {
    return new Parser(input => {
      const result = p1.parse(input);
      if (result.isError) return p2.parse(input);
      return result;
    })
  }

  static lazyChoice<A>(p1: Lazy<Parser<A>>, p2: Lazy<Parser<A>>) {
    return new Parser(input => {
      const result = p1().parse(input);
      if (result.isError) return p2().parse(input);
      return result;
    })
  }

  static multipleChoice<A>(...ps: Parser<A>[]) {
    return new Parser(input => {
      let result: Result<A> = Parser.EMPTY_ERRROR;
      for (const p of ps) {
        result = p.parse(input);
        if (!result.isError) break;
      }
      return result;
    })
  }

  static multipleLazyChoice<A>(...ps: Lazy<Parser<A>>[]) {
    return new Parser(input => {
      let result: Result<A> = Parser.EMPTY_ERRROR;
      for (const p of ps) {
        result = p().parse(input);
        if (!result.isError) break;
      }
      return result;
    })
  }

  // Parse zero or more
  static many<A>(p: Parser<A>) {
    return Parser.choice(Parser.some(p), Parser.pure([] as A[]))
  }

  // Parse one or more
  static some<A>(p: Parser<A>): Parser<A[]> {
    return p.bind(a => Parser.many(p).bind(as => Parser.pure([a, ...as])))
  }

  static sepBy<A, Sep>(p: Parser<A>, sep: Parser<Sep>): Parser<A[]> {
    return Parser.choice(Parser.sepBySome(p, sep), Parser.pure([] as A[]))
  }

  // Parse one or more, separated by `sep`
  static sepBySome<A, Sep>(p: Parser<A>, sep: Parser<Sep>): Parser<A[]> {
    return p.bind(a => Parser.many(sep.bind(_ => p)).bind(as => Parser.pure([a, ...as])))
  }

  static chainLeft<A>(p: Parser<A>, op: Parser<(a: A) => (b: A) => A>): Parser<A> {
    const rest = (a: A): Parser<A> => Parser.choice(
      op.bind(f => p.bind(b => rest(f(a)(b)))),
      Parser.pure(a)
    )
    return p.bind(rest)
  }
}

// Parse any character
export const item = new Parser(input => {
  const result = getCharacterFromInput(input);
  if (result === null) return {
    isError: true,
    position: input.position,
    message: 'Unexpected end of input'
  };
  const [character, rest] = result;
  return {
    isError: false,
    value: character,
    state: rest
  };
})

// Primitive parsers
const WHITE_SPACES = [' ', '\n', '\t'];
export const digit = item.parseIf(c => c >= '0' && c <= '9', 'a digit');
export const lower = item.parseIf(c => c >= 'a' && c <= 'z', 'a lower case letter');
export const upper = item.parseIf(c => c >= 'A' && c <= 'Z', 'an upper case letter');
export const whitespace = item.parseIf(c => WHITE_SPACES.includes(c), 'a whitespace');
export const letter = Parser.choice(lower, upper);
export const alphanum = Parser.choice(letter, digit);
export const whitespaces = Parser.many(whitespace);

// Complex parsers
export const token = <A>(p: Parser<A>) => p.bind(a => whitespaces.bind(_ => Parser.pure(a)));
export const symbol = (s: string) => token(str(s));
export const char = (c: string) => item.parseIf(character => character === c, c);
export const str = (s: string): Parser<string> => s.length === 0 ? Parser.pure("")
  : char(s[0]).bind(c => str(s.slice(1)).bind(cs => Parser.pure(c + cs)));
