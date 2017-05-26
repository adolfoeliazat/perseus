const Rule = require("../../rule.js");

module.exports = Rule.makeRule({
    name: "heading-sentence-case",
    selector: "heading",
    pattern: /^\W*[a-z]/, // first letter is lowercase
    message: `First letter is lowercase:
the first letter of a heading should be capitalized.`,
});
