const assert = require("assert");
const PerseusMarkdown = require("../../perseus-markdown.jsx");
const TreeTransformer = require("../tree-transformer.js");

describe("Individual lint rules tests", () => {
    function testRule(rule, markdown) {
        const tree = PerseusMarkdown.parse(markdown);
        const tt = new TreeTransformer(tree);
        const warnings = [];
        tt.traverse((node, state, content) => {
            const check = rule.check(node, state, content);
            if (check) {
                warnings.push(check);
            }
        });

        return warnings.length === 0 ? null : warnings;
    }

    function expectWarning(rule, strings) {
        if (typeof strings === "string") {
            strings = [strings];
        }

        it(`Rule ${rule.name} warns`, () => {
            for (const string of strings) {
                assert.ok(
                    testRule(rule, string) !== null,
                    `Expected ${rule.name} to warn for:\n'${string}'`
                );
            }
        });
    }

    function expectPass(rule, strings) {
        if (typeof strings === "string") {
            strings = [strings];
        }

        it(`Rule ${rule.name} passes`, () => {
            for (const string of strings) {
                assert.ok(
                    testRule(rule, string) === null,
                    `Expected ${rule.name} to pass for:\n'${string}'`
                );
            }
        });
    }

    // 299 characters
    const sentence = new Array(25).fill("lorem ipsum").join(" ");

    // long-paragraph rule warns about paragraphs over 500 characters
    expectWarning(
        require("../rules/general/long-paragraph.js"),
        sentence + sentence
    );
    expectPass(require("../rules/general/long-paragraph.js"), [
        sentence,
        sentence + "\n\n" + sentence,
    ]);

    expectWarning(
        require("../rules/general/heading-level-1.js"),
        "# Level 1 heading"
    );
    expectPass(
        require("../rules/general/heading-level-1.js"),
        "## Level 1 heading\n\n### Level 3 heading"
    );

    expectWarning(
        require("../rules/general/heading-level-skip.js"),
        "## heading 1\n\n#### heading 2"
    );
    expectPass(require("../rules/general/heading-level-skip.js"), [
        "## heading 1\n\n### heading 2\n\n#### heading 3\n\n### heading 4",
        "## heading 1\n\n##heading 2\n\n##heading3",
    ]);

    expectWarning(
        require("../rules/general/heading-title-case.js"),
        "## This Heading is in Title Case"
    );
    expectPass(require("../rules/general/heading-title-case.js"), [
        "## This heading is in sentence case",
        "## Acronyms: The CIA, NSA, DNI, and FBI",
        "## The Great War",
    ]);

    expectWarning(require("../rules/general/heading-sentence-case.js"), [
        "## this heading is uncapitalized",
        "## 'this' heading is uncapitalized",
        "##   this heading is uncapitalized",
    ]);
    expectPass(require("../rules/general/heading-sentence-case.js"), [
        "## This heading is in sentence case",
        "## 'This heading too'",
        "## 2 + 2 = 4",
    ]);

    expectWarning(require("../rules/general/nested-lists.js"), [
        "1. outer\n  * nested\n  *nested",
        " + outer\n\n   1. nested",
    ]);
    expectPass(require("../rules/general/nested-lists.js"), [
        "-one\n-two\n-three",
        "1. one\n 2. two\n3. three",
        " * one\n\n * two\n\n * three",
    ]);

    expectWarning(require("../rules/general/image-alt-text.js"), [
        "![](http://google.com/)",
        '![](http://google.com/ "title")',
        "![][url-ref]",
        "![ ](http://google.com/)",
        "![ \t\n ](http://google.com/)", // all whitespace
        "![blah](http://google.com/)", // too short to be meaningful
    ]);

    expectPass(require("../rules/general/image-alt-text.js"), [
        "![alt-text](http://google.com)",
        '![alternative text](http://google.com/ "title")',
        "![alt alt alt][url-ref]",
    ]);

    expectWarning(require("../rules/general/blockquoted-math.js"), [
        "> $1$",
        "Quote:\n\n> $x$\n\n",
    ]);
    expectPass(require("../rules/general/blockquoted-math.js"), [
        "$x$",
        "\n$x$\n  $y$\n",
        "> bq #1\n\n$x+y=1$\n\n> bq #2",
    ]);

    expectWarning(require("../rules/general/blockquoted-widget.js"), [
        "> [[☃ passage 1]]",
    ]);
    expectPass(require("../rules/general/blockquoted-widget.js"), [
        "[[☃ passage 1]]",
        "> bq #1\n\nTesting [[☃ passage 1]] testing\n\n> bq #2",
    ]);
});
