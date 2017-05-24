const assert = require("assert");
const Selector = require("../selector.js");

describe("gorgon selector parser", () => {
    const validExpressions = [
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
    ];

    const invalidExpressions = [
        "", // Expected node type
        " ", // Expected node type
        "<", // Expected node type
        "+", // Expected node type
        "~", // Expected node type
        "**", // Unexpected token
        "foo*", // Unexpected token
        "*/foo/", // Unexpected token
        "()", // Unexpected token
    ];

    validExpressions.forEach(s => {
        it("parses '" + s + "'", () => {
            const e = Selector.parse(s);
            assert.ok(e instanceof Selector);
            assert.equal(e.toString().replace(/\s/g, ""), s.replace(/\s/g, ""));
        });
    });

    invalidExpressions.forEach(s => {
        it("rejects '" + s + "'", () => {
            assert.throws(() => {
                Selector.parse(s);
            });
        });
    });
});
