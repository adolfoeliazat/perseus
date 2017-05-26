const Rule = require("../../rule.js");

module.exports = Rule.makeRule({
    name: "long-paragraph",
    selector: "paragraph",
    pattern: /^.{501,}/,
    lint: function(nodes, match) {
        return `Paragraph too long:
This paragraph is ${match.input.length} characters long.
Shorten it to 500 characters or fewer.`;
    },
});
