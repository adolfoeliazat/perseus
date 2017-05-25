const assert = require("assert");
const PerseusMarkdown = require("../../perseus-markdown.jsx");
const TreeTransformer = require("../tree-transformer.js");
const Rule = require("../rule.js");

describe("Gorgon lint Rules class", () => {
    const markdown = `
### This Heading is in Title Case

This paragraph contains forbidden words. Poop!

This paragraph contains an unescaped $ sign.
`;

    const ruleDescriptions = [
        {
            name: "heading-title-case",
            selector: "heading",
            pattern: "/\\s[A-Z][a-z]/",
            message: `Title case in heading:
Only capitalize the first word of headings.`,
        },
        {
            name: "profanity",
            pattern: "/poop|crap/i",
            message: `Profanity:
this is a family website!`,
        },
        {
            name: "unescaped-dollar",
            selector: "unescapedDollar",
            message: `Unescaped '$':
If writing math, pair with another $.
Otherwise escape it by writing \\$.`,
        },
    ];

    let rules = [];

    function parseTree() {
        return PerseusMarkdown.parse(markdown);
    }

    it("has a makeRules() factory method", () => {
        rules = ruleDescriptions.map(Rule.makeRule);
        assert.equal(rules.length, ruleDescriptions.length);
        rules.forEach(r => assert.ok(r instanceof Rule));
    });

    it("rules.check() works", () => {
        const tree = parseTree;
        const tt = new TreeTransformer(tree);
        const warnings = [];

        tt.traverse((node, state, content) => {
            rules.forEach(r => {
                const lint = r.check(node, state, content);
                if (lint) {
                    warnings.push(lint);
                }
            });

            assert.equal(warnings.length, 3);
            assert.equal(warnings[0].rule, ruleDescriptions[0].name);
            assert.equal(warnings[0].message, ruleDescriptions[0].message);

            assert.equal(warnings[1].rule, ruleDescriptions[1].name);
            assert.equal(warnings[1].message, ruleDescriptions[1].message);

            assert.equal(warnings[2].rule, ruleDescriptions[2].name);
            assert.equal(warnings[2].message, ruleDescriptions[2].message);
        });
    });
});
