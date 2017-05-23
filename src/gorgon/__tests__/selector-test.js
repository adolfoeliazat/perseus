const assert = require("assert");
const Selector = require("../selector.js");

describe("gorgon node selector", () => {
    describe("parser", () => {
        let validExpressions = [
            "*",
            " * ",
            "para",
            "list para",
            "\tlist   para\n",
            "list > para",
            "list + para",
            "list ~ para",
            "list list para",
            "para~heading~para~heading",
            "*/foo/",
            "heading /[A-Z]+/i",
        ];

        let invalidExpressions = [
            "", // Expected node type
            " ", // Expected node type
            "<", // Expected node type
            "+", // Expected node type
            "~", // Expected node type
            "**", // Unexpected token
            "foo*", // Unexpected token
            "foo/bar/ baz", // pattern must be last element
        ];

        validExpressions.forEach(s => {
            it("parses '" + s + "'", () => {
                let e = Selector.parse(s);
                assert.ok(e instanceof Selector);
                assert.equal(
                    e.toString().replace(/\s/g, ""),
                    s.replace(/\s/g, "")
                );
            });
        });

        invalidExpressions.forEach(s => {
            it("rejects '" + s + "'", () => {
                assert.throws(() => {
                    let e = Selector.parse(s);
                });
            });
        });
    });
});
