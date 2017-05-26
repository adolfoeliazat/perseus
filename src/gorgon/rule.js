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
 *  lint_callback(selectedNodes, matchedStrings)
 *
 * If there is no lint at the currentNode, then this function should
 * return a falsy value. If there is lint, then the function should
 * return an error message describing the problem.
 *
 * As a special case, if the node is a text node (that is, has a content
 * property of type string) then it can return an error message that
 * applies to only a portion of that string. This is done by returning
 * an object of this form:
 *   {
 *     message: the error message
 *     start: the start index of the error
 *     end: the end index of the error
 *   }
 *
 * If you pass a string to the rule() constructor in place of a lint function
 * then it will use a default function that unconditionally returns the
 * error message. If the node is a text node, it will add the start and end
 * indexes of the portion of the string that matched the pattern.
 *
 * Rule.makeRule() is a factory method that takes a single object as its
 * argument and is useful when lint rules are described in JSON data structures.
 * In this case, it expects an object with string properties. The name
 * property is passed as the first argument to the Rule() construtctor.
 * The selector property, if specified, is passed to Selector.parse() and
 * the resulting Selector object is used as the second argument to Rule().
 * The pattern property specifies the third argument to Rule(). If this string
 * begins with a '/', then it is turned into a RegExp. Otherwise it is passed
 * to Rule() as a fixed string. Finally, if a lint property is defined it
 * is passed as the final argument to Rule(), and otherwise the messsage
 * property is defined.
 *
 * Once a Rule has been created with Rule() or Rule.makeRule(), you can
 * use it by calling its check() method. The arguments to this method are
 * the same as the arguments that a TreeTransformer passes to its traversal
 * callback function. So if you have a parse tree and a list of Rule objects
 * you can use a TreeTransformer to visit each node, and then call the check()
 * method of each Rule object while visiting that node.
 *
 * TODO(davidflanagan): allow rules to be locale-sensitive. The rules for
 * appropriate capitalization in a heading may vary from language to language
 * for example, and we don't want to apply English rules to content in
 * other languages.
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
            options.lint || options.message
        );
    }

    // If the argument is a regular expression or a string that does
    // not begin with / then just return it. Otherwise, compile it to
    // a regular expression.
    static makePattern(pattern) {
        if (!pattern || pattern instanceof RegExp || pattern[0] !== "/") {
            return pattern;
        }

        const lastSlash = pattern.lastIndexOf("/");
        const expression = pattern.substring(1, lastSlash);
        const flags = pattern.substring(lastSlash + 1);
        return new RegExp(expression, flags);
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
