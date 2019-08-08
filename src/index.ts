interface TopLevel {
  type: "query" | "mutation" | "subscription";
  name: string,
  vars?: { [name: string]: any };
  selectors: Selector[];
}

type Selector = string | Field;

interface Field {
  name: string;
  alias?: string;
  args?: { [name: string]: any };
  selectors?: Selector[];
}

interface Fragment {
  on: string;
  selectors: Selector[];
}

function idt(indent: number) {
  return "".padStart(indent);
}

function stringifyArgs(args: {[name: string]: any}): string {
  return Object.keys(args).map(name => {
    return `${name}: ${(typeof args[name] === 'string' && args[name].startsWith('$')) ? args[name] : JSON.stringify(args[name]).replace(/"(.+?)":/g, "$1: ")}`
  }).join(", ")
}

function stringifyVars(vars: {[name: string]: string}): string {
  return Object.keys(vars).map(name => {
    return `${name}: ${vars[name]}`
  }).join(", ")
}

function stringifyField(field: Selector, indent: number): string {
  if (typeof field === 'string') return field;
  
  let out = "";
  out += field.alias ? field.alias + ": ": "";
  out += field.name;
  out += field.args ? "(" + stringifyArgs(field.args) + ")" : "";
  out += field.selectors && field.selectors.length && " {\n" +
    field.selectors.map(f => stringifyField(f, indent + 2)).map(f => idt(indent) + f).join(",\n") +
    "\n" + idt(indent - 2) + "}";
  return out;
}

function stringifyQuery(query: TopLevel, indent = 2): string {
  let out = "";
  out += query.type + " " + query.name;
  out += query.vars ? "(" + stringifyVars(query.vars) + ")" : "";
  out += " {\n";
  out += query.selectors.map(f => stringifyField(f, indent + 2)).map(f => idt(indent) + f).join(",\n")
  out += "\n}";
  return out;
}

interface Parser {
  parse(regex: RegExp): string[];
}

function createParser(str: string): Parser {
  let left = str;

  return {
    parse(regex: RegExp): string[] {
      const res = regex.exec(left);
      if (!res) throw new Error(`No match for regex ${regex} in ${str}`);
      left = left.substr(res[0].length).trim();
      return Array.from(res).slice(1);
    }
  }
}

function parseArgs(parser: Parser): Field["args"] {
  const args: Field["args"] = {};
  try { while(true) {
    const [name, open] = parser.parse(/^(\w+)\s*:\s*({)?/);
    if (open) args[name] = parseArgs(parser);
    else args[name] = parser.parse(/^([^},]+)/)[0];
    parser.parse(/^\s*,?/)
  }} catch(e) {}
  parser.parse(/^\s*}?/)
  return args;
}

function parseFields(parser: Parser): Selector[] {
  const res: Selector[] = [];
  let name, alias, args, open;
  try {
    while (true) {
      ([alias, name, args, open] = parser.parse(/^(?:([\w_]+)\s*:\s*)?([\w_]+)\s*(?:\((.+?)\))?\s*({)?/mi));
      let selectors: Selector[] = [];

      let field: Selector = {
        name
      };
      if (args) field.args = parseArgs(createParser(args));
      if (alias) field.alias = alias;
      if (open) field.selectors = parseFields(parser);

      if (!args && !alias && !open) field = field.name;

      res.push(field);
      parser.parse(/^\s*}?,?/)
    }
  } catch(e) {
    // throw e; console.error(e);
  }
  return res;
}

function parseQuery(query: string): TopLevel {
  const parser = createParser(query);
  const [typ, name, vars] = parser.parse(/^(\w+)\s+(\w+)\s*(?:\((.+?)\))?\s*{/mi);
  return {
    type: typ as TopLevel["type"],
    name,
    vars: vars.split(",").map(v => v.trim().split(":").map(s => s.trim())).reduce((acc, [name, value]) => Object.assign(acc, { [name]: value }), {}),
    selectors: parseFields(parser),
  };
}

const stringified = stringifyQuery({
  type: "query",
  name: "books",
  vars: {
    "$var": "String"
  },
  selectors: [
    {
      name: "allBooks",
      args: {
        filter: { id: 5 },
        meme: "$var"
      },
      selectors: [
        "__typename",
        "id",
        "title",
        "filter"
      ]
    },
    "hello"
  ]
});
console.log(stringified);
const parsed = parseQuery(stringified);

console.log(JSON.stringify(parsed, void 0, 2));

