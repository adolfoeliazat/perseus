const Selector = require("./selector.js");

/**
 * A Gorgon lint rule consists of a name, a selector, a pattern and a function
 * that is passed the results of matching the selector and pattern and
 * returns a lint error message, if there is one At least one of the
 * selector and pattern must be specified. If there is no selector, we
 * default to "text" so that the pattern only matches text nodes.  If
 * there is no pattern, we just match the entire content of the
 * selected node.
 *
 * The lint function gets passed the TraversalState object and the
 * full content string for the node, but is also passed the node array
 * that is the result of the selector match and the array of strings
 * that results from the regexp match. So the signature is:
 *
 *  lint_callback(traversalState,
 *                currentNode,
 *                selectedNodes,
 *                matchedStrings)
 *
 * XXX: actually, maybe we can just pass the match results. In particular
 *  maybe we don't need to pass the traversal state.
 *
 * If there is no lint at the currentNode, then this function should
 * return a falsy value. If there is lint, then the function should
 * return an error message describing the problem.
 *
 * As a special case, if the node is a text node (that is, has a content
 * property of type string) then it can return an error message that
 * applies to only a portion of that string: {
 *     message: the error message
 *     start: the start index of the error
 *     end: the end index of the error
 * }
 *
 * If a lint rule does not specify a callback function but does specify
 * an error message, then we'll use a default function that unconditionally
 * returns the specified message, and bases the start index on the pattern
 * match index.
 *
 * When we want to report lint in existing content, we can just display
 * the error messages. When we want to display lint in the Perseus editor
 * we can use the result of the callback function to actually mutate the
 * markdown parse tree
 *
 * We may want to be able to specify rules (without functions) in JSON
 * files, so we also define a factory method that takes a single object
 * as its argument and is more flexible than the constructor.
 */
class Rule {
    constructor(name, selector, pattern, lint) {
        if (!selector && !pattern) {
            throw new Error("Lint rules must have a selector or pattern");
        }

        this.name = name;
        this.selector = selector || Rule.DEFAULT_SELECTOR;
        this.pattern = pattern;
        if (typeof lint === "function") {
            this.lint = lint;
        } else {
            this.lint = this._defaultLintFunction;
            this.message = lint;
        }
    }

    // A factory method for use with rules described in JSON files
    static makeRule(options) {
        return new Rule(
            options.name || "unnamed rule",
            options.selector ? Selector.parse(options.selector) : null,
            Rule.makePattern(options.pattern),
            options.message
        );
    }

    // Make a pattern from the specified string. If the string begins
    // with '/', treat it as a regular expression. Otherwise, just
    // return it as a string
    static makePattern(text) {
        if (!text || text[0] !== "/") {
            return text;
        }

        const lastSlash = text.lastIndexOf("/");
        const pattern = text.substring(1, lastSlash);
        const flags = text.substring(lastSlash + 1);
        return new RegExp(pattern, flags);
    }

    // Check the node n to see if it violates this lint rule.
    // A return value of false means there is no lint.
    // A returned object indicates a lint error.
    check(node, traversalState, content) {
        // First, see if we match the selector.
        // If no selector was passed to the constructor, we use a
        // default selector that matches text nodes.
        const selectorMatch = this.selector.match(traversalState);

        // If the selector did not match, then we're done
        if (!selectorMatch) {
            return false;
        }

        // If the selector matched, then see if the pattern matches
        let patternMatch;
        if (this.pattern) {
            if (typeof this.pattern === "string") {
                // If it is just a string we match with indexOf
                const matchIndex = content.indexOf(this.pattern);
                if (matchIndex !== -1) {
                    // Create a fake RegExp match object
                    patternMatch = new PatternMatchResult(
                        content,
                        this.pattern,
                        matchIndex
                    );
                }
            } else {
                // otherwise assume it is a RegExp
                patternMatch = content.match(this.pattern);
            }
        } else {
            // If there is no pattern, then just match all of the content
            // Again, we create a fake RegExp match object
            patternMatch = new PatternMatchResult(content, content, 0);
        }

        // If the pattern didn't match, then we're done
        if (!patternMatch) {
            return false;
        }

        const error = this.lint(selectorMatch, patternMatch);

        if (!error) {
            return false;
        } else if (typeof error === "string") {
            return {
                rule: this.name,
                message: error,
                start: 0,
                end: content.length,
            };
        } else {
            error.rule = this.name;
            return error;
        }
    }

    _defaultLintFunction(selectorMatch, patternMatch) {
        return {
            message: this.message,
            start: patternMatch.index,
            end: patternMatch.index + patternMatch[0].length,
        };
    }
}

Rule.DEFAULT_SELECTOR = Selector.parse("text");

class PatternMatchResult {
    constructor(input, match, index) {
        const result = [match];
        result.index = index;
        result.input = input;
        return result;
    }
}

module.exports = Rule;
