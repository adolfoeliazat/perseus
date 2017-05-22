const TreeTransformer = require('./tree-transformer.js');

// Return true iff n appears to be a node in a parse tree
function isParseTreeNode(n) {
    return n &&
        typeof n === 'object' &&
        typeof n.type === 'string';
}

/**
 * Invoke function f() for each node in the parse tree.
 * If node is an array, we recurse on each element of it.
 * Otherwise if node looks like a parse tree node, we call f() on it.
 * We then recurse on the value of all properties of node.
 *
 * TODO(davidflanagan): It would be good if we had one single canonical
 * traversal function for all markdown parse trees. Right now we've got
 * this one and two different functions in ../perseus-markdown.jsx
 */
function traverse(node, f) {
    if (Array.isArray(node)) {
        node.forEach(n => traverse(n, f));
    } else if (isParseTreeNode(node)) {
        f(node);
        Object.values(node).forEach(n => traverse(n, f));
    }
}

/**
 * Like the traverse() function above, except that if the callback
 * function f() returns an object that object will be used to replace
 * the node in the parse tree. And if it returns and array of objects,
 * then those objects will be spliced in (and not traversed)
 *
 * TODO: what about removing nodes? Return null to remove the node
 * and undefined to leave it unchanged?
 */
function traverseAndReplace(node, f) {
    if (Array.isArray(node)) {
        const nodes = node;
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const replacement = traverseAndReplace(n, f);
            if (replacement) {
                if (Array.isArray(replacement)) {
                    nodes.splice(i, 1, ...replacement);
                    i += replacement.length - 1;
                } else {
                    nodes.splice(i, 1, replacement);
                }
            }
        }
        return null;
    } else if (isParseTreeNode(node)) {
        const replacement = f(node);

        // Does it matter what order we do these in?
        // That is, does the linter need to know the details of
        // things like table nodes?
        for (const key of Object.keys(node)) {
            if (key === "type") {
                continue;
            }
            const child = node[key];
            const replacement = traverseAndReplace(child, f);
            if (replacement) {
                node[key] = replacement;
            }
        }

        return replacement;
    }

    return null;
}

function characterCount(node) {
    let count = 0;
    traverse(node, (n) => {
        if (typeof n.content === 'string') {
            count += n.content.length;
        }
    });
    return count;
}

// I want to write a function to traverse a parse tree and
// coalesce adjacent text nodes. The current version of traverseAndReplace
// above isn't general enough to do it.  Is there a general way to
// do this or do I just write a custom function?

// Does it help at all to treat tree traversal as a JS iterator
// so we can just for/of over it?

// Do we have some kind of tree editor class where we call nextSibling() to get
// the next node in order and then do things like call consume() to
// pass it through or reparent() to insert a lint node? Is that a tree walker
// type structure or something?

/*
Rather than simple tree travesal that just calls a function on each
node, I think the linter will need something richer. A class for
traversing trees. It has callbacks it calls for each node in pre-order
and post-order. And also maintains state, so that at each node we can
inspect the type of all the ancestors and so we also can get a list of
the siblings of each node. Also, for the post-order callback we can
get the full text of everything under the node. And add methods for
reparenting. And combining nodes. (Or maybe just a method for deleting
the next sibling)

If it is easy, make this a general-purpose tree
traverser/transformer/rewriter so it can be its own github project,
but probably easiest to just start out with something custom just for
this project.

*/


function detectLint(parseTree) {
    let tt = new TreeTransformer(parseTree);

    tt.traverse((n,tt) => {
        if (tt.isTextNode(tt.currentNode)) {
            let next = tt.getNextSibling();
            while(tt.isTextNode(next)) {
                tt.currentNode.content += next.content;
                tt.removeNextSibling();
                next = tt.getNextSibling();
            }
        }
    });

    tt.traverse((n,tt) => {
        let prev = tt.getPrevSibling();
        let next = tt.getNextSibling();
        let prevtype = prev ? prev.type : 'none';
        let nexttype = next ? next.type : 'none'
//        console.log(`${prevtype} ${tt.currentNode.type} ${nexttype} > ^${tt.getAncestorTypes()}`);
        console.log(tt.getAncestorTypes(), tt.currentNodeType, tt.textContent);
    });

    traverseAndReplace(parseTree, n => {
        if (n.type === 'unescapedDollar') {
            return {
                type: "lint",
                content: [n],
                display: 'inline',
                title: 'Unescaped $',
                message: `If writing math, pair with another $.
Otherwise escape it by writing \\$.`,
            };
        } else if (n.type === 'paragraph') {
            const length = characterCount(n);
            if (length > 500) {
                return {
                    type: "lint",
                    content: [n],
                    display: 'block',
                    title: "Paragraph too long",
                    message: `Paragraphs should be shorter than 500 characters.
Curent length: ${length}.`,
                };
            }
        }
        return null;
    });
}

module.exports = {
    detectLint,
};
