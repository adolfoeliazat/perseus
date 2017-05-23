/*
 * Parse a selector string according to a grammar like this:
 *
 * selector := nodeSelector (combinator nodeSelector)* (pattern)?
 *
 * combinator := ' ' | '>' | '+' | '~'   // standard CSS3 combinators
 *
 * nodeSelector := nodeType (attributeMatch)*
 *
 * nodeType := '*' | IDENT
 *
 * // This will be needed for testing heading levels, I think
 * // But I could drop it if I implement those differently
 * attributeMatch := '[' IDENT comparator value ']' // ??? NYI
 *
 * // Patterns only allowed on the last nodeSelector because we
 * // don't have the text content for ancestor nodes
 * pattern := '/' <regular expression> '/'
 *
 */
class Parser {
    constructor(s) {
        // Normalize whitespace:
        // - remove leading and trailing whitespace
        // - replace runs of whitespace with single space characters
        s = s.trim().replace(/\s+/g, " ");
        // Convert the string to an array of tokens
        this.tokens = s.match(Parser.TOKENS);
        this.tokenIndex = 0;
    }

    nextToken() {
        return this.tokens[this.tokenIndex];
    }

    consume() {
        this.tokenIndex++;
    }

    isIdentifier() {
        let c = this.tokens[this.tokenIndex][0];
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
    }

    parse() {
        let ns = this.parseNodeSelector();

        for (;;) {
            let token = this.nextToken();

            if (!token) {
                return ns;
            } else if (token[0] === "/") {
                let r = this.parseRegexp();
                if (this.nextToken()) {
                    throw new SelectorParseError(
                        "Pattern must be last element of selector"
                    );
                }
                return new NodeSelectorWithPattern(ns, r);
            } else if (token === " ") {
                this.consume();
                ns = new AncestorCombinator(ns, this.parseNodeSelector());
            } else if (token === ">") {
                this.consume();
                ns = new ParentCombinator(ns, this.parseNodeSelector());
            } else if (token === "+") {
                this.consume();
                ns = new PreviousCombinator(ns, this.parseNodeSelector());
            } else if (token === "~") {
                this.consume();
                ns = new SiblingCombinator(ns, this.parseNodeSelector());
            } else {
                throw new SelectorParseError("Unexpected token: " + token);
            }
        }
    }

    parseNodeSelector() {
        // First, skip any whitespace
        while (this.nextToken() === " ") {
            this.consume();
        }

        let t = this.nextToken();
        if (t === "*") {
            this.consume();
            return new AnyNode();
        } else if (this.isIdentifier()) {
            this.consume();
            return new NodeSelector(t);
        }

        throw new SelectorParseError("Expected node type");
    }

    parseRegexp() {
        let token = this.nextToken();
        if (token[0] !== "/") {
            return null;
        }

        let pattern, flags;
        if (token[token.length - 1] === "i") {
            pattern = token.substring(1, token.length - 2);
            flags = "i";
        } else {
            pattern = token.substring(1, token.length - 1);
        }

        this.consume();
        return new RegExp(pattern, flags);
    }
}

// We break the input string into tokens with this regexp. Token types
// are identifiers, integers, regular expressions, punctuation and
// spaces.  Note that spaces tokens are only returned when they appear
// before an identifier or wildcard token. Regular expression tokens
// may include an 'i' flag for case-insensitive matching, but other
// flags are not supported.
Parser.TOKENS = /([a-zA-Z]\w*)|(\d+)|(\/[^\/]+\/i?)|([>+~\[\]*=/:])|(\s(?=[a-zA-Z\*]))/g;

class Selector {
    static parse(selectorText) {
        return new Parser(selectorText).parse();
    }
}

class NodeSelectorWithPattern extends Selector {
    constructor(selector, pattern) {
        super();
        this.selector = selector;
        this.pattern = pattern;
    }

    toString() {
        return this.selector.toString() + this.pattern.toString();
    }
}

class AnyNode extends Selector {
    toString() {
        return "*";
    }
}

class NodeSelector extends Selector {
    constructor(type) {
        super();
        this.type = type;
        this.attributeRequirements = []; // NYI
    }

    toString() {
        return this.type;
    }
}

class SelectorCombinator extends Selector {
    constructor(left, right) {
        super();
        this.left = left;
        this.right = right;
    }
}

class AncestorCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    toString() {
        return this.left.toString() + " " + this.right.toString();
    }
}

class ParentCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    toString() {
        return this.left.toString() + " > " + this.right.toString();
    }
}

class PreviousCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    toString() {
        return this.left.toString() + " + " + this.right.toString();
    }
}

class SiblingCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    toString() {
        return this.left.toString() + " ~ " + this.right.toString();
    }
}

class SelectorParseError extends Error {
    constructor(message) {
        super(message);
    }
}

module.exports = Selector;
