// This class is an internal utility that just treats an array as a stack
// and gives us a top method so we don't have to do the a[a.length-1] thing
// all the time. The values() method returns a copy of the internal
// array so we don't have to worry about clients altering our state
class Stack {
    constructor() {
        this.stack = [];
    }
    push(v) {
        this.stack.push(v);
    }
    pop() {
        return this.stack.pop();
    }
    top() {
        return this.stack[this.stack.length - 1];
    }
    values() {
        return this.stack.slice(0);
    }
    toString() {
        return this.stack.toString();
    }
}

// An instance of this class is passed to the callback function for
// each node traversed. The class itself is not exported, but its
// methods define the API available to the traversal callback.
class TraversalState {
    constructor(root) {
        this.root = root;

        // When the callback is called, this property will hold the
        // node that is currently being traversed.
        this._currentNode = null;

        // TODO: is this actually all that useful?
        this._currentNodeType = null;

        // This is a stack of the objects and arrays that we've
        // traversed through before reaching the currentNode.
        // It is different than the ancestors array.
        this._containers = new Stack();

        // This stack has the same number of elements as the ancestors
        // stack. The last element of this._indexes[] is the index of
        // the current node in the object or array that is the last elemnet
        // of this._containers[]. If the last element of this._containers[] is
        // an array, then the last element of this stack will be a number.
        // Otherwise if the last ancestor is an object, then the last index
        // will be a string property name.
        this._indexes = new Stack();

        // This is a stack of the ancestor nodes of the current one.
        // It is different than the containers[] stack because it only
        // includes nodes, not arrays.
        this._ancestors = new Stack();

        // This stack contains the type properties of all of the nodes
        // in the ancestors stack. This will be useful for matching
        // CSS-style selectors.
        this._ancestorTypes = new Stack();

        // At any point in the traversal, this property will hold the
        // concatenated text content of the currentNode and its descendants.
        this._textContent = "";
    }

    currentNode() {
        return this._currentNode;
    }

    currentNodeType() {
        return this._currentNodeType;
    }

    textContent() {
        return this._textContent;
    }

    ancestors() {
        return this._ancestors.values();
    }

    ancestorTypes() {
        return this._ancestorTypes.values();
    }

    nextSibling() {
        let siblings = this._containers.top();

        // If we're at the root of the tree or if the parent is an
        // object instead of an array, then there are no siblings.
        if (!siblings || !Array.isArray(siblings)) {
            return null;
        }

        let index = this._indexes.top();
        if (siblings.length > index + 1) {
            return siblings[index + 1];
        } else {
            return null; // There is no next sibling
        }
    }

    previousSibling() {
        let siblings = this._containers.top();

        // If we're at the root of the tree or if the parent is an
        // object instead of an array, then there are no siblings.
        if (!siblings || !Array.isArray(siblings)) {
            return null;
        }

        let index = this._indexes.top();
        if (index > 0) {
            return siblings[index - 1];
        } else {
            return null; // There is no previous sibling
        }
    }

    // Remove the next sibling node (if there is one) from the tree.
    removeNextSibling() {
        let siblings = this._containers.top();
        if (siblings && Array.isArray(siblings)) {
            let index = this._indexes.top();
            if (siblings.length > index + 1) {
                return siblings.splice(index + 1, 1)[0];
            }
        }
        return null;
    }

    // Replace the current node in the tree. If newNode is null or
    // undefined, then this is a node deletion. If newNode is an
    // object then this is a 1-for-1 replacement. If newNode is an
    // array, then it is an insertion. The new node or nodes will not
    // be traversed, so this can safely be used to reparent a node
    // beneath another.
    replace(newNodes) {
        let parent = this._containers.top();
        let index = this._indexes.top();

        if (!parent) {
            throw new Error("Can't replace the root of the tree");
        }

        // Treat an empty array the same as null or undefined: a deletion
        if (Array.isArray(newNodes) && newNodes.length == 0) {
            newNodes = null;
        }

        if (!newNodes) {
            // The deletion case
            if (Array.isArray(parent)) {
                parent.splice(index, 1);
                // Decrement the index so the loop the next level up doesn't
                // get messed up.
                this._indexes.pop();
                this._indexes.push(index - 1);
            } else {
                delete parent[index];
            }
        } else if (Array.isArray(newNodes)) {
            // The insertion case
            if (Array.isArray(parent)) {
                parent.splice(index, 1, newNodes);
                // Adjust the index so we don't traverse any new nodes.
                this._indexes.pop();
                this._indexes.push(index + newNodes.length - 1);
            } else {
                parent[index] = newNodes;
            }
        } else {
            // The replacement case
            // In this case, newNodes is actually just one node.
            parent[index] = newNodes;
        }
    }
}

class TreeTransformer {
    constructor(root) {
        this.root = root;
    }

    isNode(n) {
        return n && typeof n === "object" && typeof n.type === "string";
    }

    isTextNode(n) {
        return (
            this.isNode(n) && n.type === "text" && typeof n.content === "string"
        );
    }

    traverse(f) {
        this._traverse(this.root, new TraversalState(this.root), f);
    }

    _traverse(node, state, f) {
        let content = "";
        if (this.isNode(node)) {
            state._containers.push(node);
            state._ancestors.push(node);
            state._ancestorTypes.push(node.type);

            if (node.type === "text" && typeof node.content === "string") {
                content = node.content;
            }

            // Recurse on the node.
            // If there was content above, this should be a no-op
            //
            // TODO
            // Maybe do a switch here based on type field and have custom
            // recursion for each node type?
            let keys = Object.keys(node);
            keys.forEach(key => {
                // Never recurse on the type property
                if (key === "type") return;
                let value = node[key];
                // Ignore properties that are null or primitive
                if (value && typeof value === "object") {
                    state._indexes.push(key);
                    content += this._traverse(value, state, f);
                    state._indexes.pop();
                }
            });

            state._currentNodeType = state._ancestorTypes.pop();
            state._currentNode = state._ancestors.pop();
            state._containers.pop();
            state._textContent = content;

            // Post-order callback. Do we also need a pre-order as well?
            f(node, state);
        } else if (Array.isArray(node)) {
            state._containers.push(node);
            // We need to test the length each time because
            // removeNextSibling() can alter the siblings array.
            // Also, if the callback uses remove or replace to change
            // the number of elements in the array, we have to be
            // careful to update the index appropriately. We use the
            // popped index value for that.
            let index = 0;
            while (index < node.length) {
                let child = node[index];
                state._indexes.push(index);
                content += this._traverse(child, state, f);
                index = state._indexes.pop() + 1;
            }
            state._containers.pop();
        }
        return content;
    }
}

module.exports = TreeTransformer;
