const Rule = require("../../rule.js");

module.exports = Rule.makeRule({
    name: "image-alt-text",
    selector: "image",
    lint: function(nodes) {
        const image = nodes[0];
        if (!image.alt || !image.alt.trim()) {
            return `Images should have alt text:
for accessibility, all images should have alt text.
Specify alt text inside square brackets after the !.`;
        } else if (image.alt.length < 5) {
            return `Images should have alt text:
for accessibility, all images should have descriptive alt text.
This image's alt text is only ${image.alt.length} characters long.`;
        }
    },
});
