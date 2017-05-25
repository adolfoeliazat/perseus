/*
 * Parse a selector string according to a grammar like this:
 *
 * selector := treeSelector (, treeSelector)*
 *
 * treeSelector := nodeSelector (combinator nodeSelector)*
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
        const c = this.tokens[this.tokenIndex][0];
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
    }

    skipSpace() {
        while (this.nextToken() === " ") {
            this.consume();
        }
    }

    // Parse a comma-separarted sequence of tree selectors
    parse() {
        const ts = this.parseTreeSelector();
        let token = this.nextToken();

        if (!token) {
            // If we're at the end of the string we're done
            return ts;
        }

        const treeSelectors = [ts];
        while (token) {
            // Expect a comma between selectors
            if (token === ",") {
                this.consume();
            } else {
                throw new SelectorParseError("Expected comma");
            }

            treeSelectors.push(this.parseTreeSelector());
            token = this.nextToken();
        }

        return new SelectorList(treeSelectors);
    }

    // Parse a sequence of node selectors linked together with
    // hierarchy combinators: space, >, + and ~.
    parseTreeSelector() {
        this.skipSpace();
        let ns = this.parseNodeSelector();

        for (;;) {
            const token = this.nextToken();

            if (!token || token === ",") {
                return ns;
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

    // Parse a single node selector.
    // For now, this is just a node type or a wildcard.
    //
    // TODO(davidflanagan): we may need to extend this with attribute
    // selectors like 'heading[level=3]', or with pseudo-classes like
    // paragraph:first
    parseNodeSelector() {
        // First, skip any whitespace
        this.skipSpace();

        const t = this.nextToken();
        if (t === "*") {
            this.consume();
            return new AnyNode();
        } else if (this.isIdentifier()) {
            this.consume();
            return new TypeSelector(t);
        }

        throw new SelectorParseError("Expected node type");
    }
}

// We break the input string into tokens with this regexp. Token types
// are identifiers, integers, regular expressions, punctuation and
// spaces.  Note that spaces tokens are only returned when they appear
// before an identifier or wildcard token and are otherwise omitted.
Parser.TOKENS = /([a-zA-Z]\w*)|(\d+)|[^\s]|(\s(?=[a-zA-Z\*]))/g;

class Selector {
    static parse(selectorText) {
        return new Parser(selectorText).parse();
    }

    // Return an array of the nodes that matched or false if no match
    match(state) {
        throw new Error("Selector subclasses must implement match()");
    }

    toString() {
        return "Unknown selector class";
    }
}

class SelectorList extends Selector {
    constructor(selectors) {
        super();
        this.selectors = selectors;
    }

    match(state) {
        for (let i = 0; i < this.selectors.length; i++) {
            const s = this.selectors[i];
            const result = s.match(state);
            if (result) {
                return result;
            }
        }
        return false;
    }

    toString() {
        let result = "";
        for (let i = 0; i < this.selectors.length; i++) {
            result += i > 0 ? ", " : "";
            result += this.selectors[i].toString();
        }
        return result;
    }
}

class AnyNode extends Selector {
    match(state) {
        return [state.currentNode()];
    }

    toString() {
        return "*";
    }
}

class TypeSelector extends Selector {
    constructor(type) {
        super();
        this.type = type;
        this.attributeRequirements = []; // NYI
    }

    match(state) {
        const node = state.currentNode();
        if (node.type === this.type) {
            return [node];
        } else {
            return false;
        }
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

    match(state) {
        const rightResult = this.right.match(state);
        if (rightResult) {
            state = state.clone();
            while (state.hasParent()) {
                state.goToParent();
                const leftResult = this.left.match(state);
                if (leftResult) {
                    return leftResult.concat(rightResult);
                }
            }
        }
        return false;
    }

    toString() {
        return this.left.toString() + " " + this.right.toString();
    }
}

class ParentCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    match(state) {
        const rightResult = this.right.match(state);
        if (rightResult) {
            if (state.hasParent()) {
                state = state.clone();
                state.goToParent();
                const leftResult = this.left.match(state);
                if (leftResult) {
                    return leftResult.concat(rightResult);
                }
            }
        }
        return false;
    }

    toString() {
        return this.left.toString() + " > " + this.right.toString();
    }
}

class PreviousCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    match(state) {
        const rightResult = this.right.match(state);
        if (rightResult) {
            if (state.hasPreviousSibling()) {
                state = state.clone();
                state.goToPreviousSibling();
                const leftResult = this.left.match(state);
                if (leftResult) {
                    return leftResult.concat(rightResult);
                }
            }
        }
        return false;
    }

    toString() {
        return this.left.toString() + " + " + this.right.toString();
    }
}

class SiblingCombinator extends SelectorCombinator {
    constructor(left, right) {
        super(left, right);
    }

    match(state) {
        const rightResult = this.right.match(state);
        if (rightResult) {
            state = state.clone();
            while (state.hasPreviousSibling()) {
                state.goToPreviousSibling();
                const leftResult = this.left.match(state);
                if (leftResult) {
                    return leftResult.concat(rightResult);
                }
            }
        }
        return false;
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
