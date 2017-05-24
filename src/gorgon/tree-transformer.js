// This class is an internal utility that just treats an array as a stack
// and gives us a top() method so we don't have to do the a[a.length-1] thing
// all the time. The values() method returns a copy of the internal
// array so we don't have to worry about clients altering our state
class Stack {
    constructor(array) {
        this.stack = array ? array.slice(0) : [];
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
    size() {
        return this.stack.length;
    }
    toString() {
        return this.stack.toString();
    }
    clone() {
        return new Stack(this.stack);
    }
    equals(that) {
        if (!that || !that.stack || that.stack.length !== this.stack.length) {
            return false;
        }
        for (let i = 0; i < this.stack.length; i++) {
            if (this.stack[i] !== that.stack[i]) {
                return false;
            }
        }
        return true;
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

        // This is a stack of the objects and arrays that we've
        // traversed through before reaching the currentNode.
        // It is different than the ancestors array.
        this._containers = new Stack();

        // This stack has the same number of elements as the _containers
        // stack. The last element of this._indexes[] is the index of
        // the current node in the object or array that is the last element
        // of this._containers[]. If the last element of this._containers[] is
        // an array, then the last element of this stack will be a number.
        // Otherwise if the last container is an object, then the last index
        // will be a string property name.
        this._indexes = new Stack();

        // This is a stack of the ancestor nodes of the current one.
        // It is different than the containers[] stack because it only
        // includes nodes, not arrays.
        this._ancestors = new Stack();
    }

    currentNode() {
        return this._currentNode;
    }

    parent() {
        return this._ancestors.top();
    }

    ancestors() {
        return this._ancestors.values();
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

    clone() {
        let clone = new TraversalState(this.root);
        clone._currentNode = this._currentNode;
        clone._containers = this._containers.clone();
        clone._indexes = this._indexes.clone();
        clone._ancestors = this._ancestors.clone();
        return clone;
    }

    equals(that) {
        return (
            this.root === that.root &&
            this._currentNode === that._currentNode &&
            this._containers.equals(that._containers) &&
            this._indexes.equals(that._indexes) &&
            this._ancestors.equals(that._ancestors)
        );
    }

    // Returns true iff this node has an ancestor
    hasParent() {
        return this._ancestors.size() !== 0;
    }

    // Returns true iff the current node has a previous sibling
    hasPreviousSibling() {
        return Array.isArray(this._containers.top()) && this._indexes.top() > 0;
    }

    // Modify this traversal state object to have the state it would have
    // had when visiting the previous sibling. Note that you may want to
    // use clone() to make a copy before modifying the state object like this.
    goToPreviousSibling() {
        if (!this.hasPreviousSibling()) {
            throw new Error(
                "goToPreviousSibling(): node has no previous sibling"
            );
        }

        this._currentNode = this.previousSibling();
        let index = this._indexes.pop();
        this._indexes.push(index - 1);
    }

    // Modify this object to look like it will look when we (later) visit
    // the ancestor node of this node. Don't modify the instance passed
    // to the tree traversal callback. Instead, make a copy with clone()
    // and modify that. This method is useful when matching CSS-style
    // parent and ancestor selectors.
    goToParent() {
        if (!this.hasParent()) {
            throw new Error("goToParent(): node has no ancestor");
        }

        this._currentNode = this._ancestors.pop();

        // We need to pop the containers and indexes stacks at least once
        // and more as needed until we restore the invariant that
        // this._containers.top()[this.indexes.top()] === this._currentNode
        while (
            this._containers.size() &&
            this._containers.top()[this._indexes.top()] !== this._currentNode
        ) {
            this._containers.pop();
            this._indexes.pop();
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

    // Do a post-order traversal of node and its descendants, invoking
    // the callback function f() once for each node and returning the
    // concatenated text content of the node and its descendants. f()
    // is passed three arguments: the current node, a TraversalState
    // object representing the current state of the traversal, and
    // a string that holds the concatenated text of the node and its
    // descendants.
    _traverse(node, state, f) {
        let content = "";
        if (this.isNode(node)) {
            state._containers.push(node);
            state._ancestors.push(node);

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
                // Only recurse on objects and arrays.
                if (value && typeof value === "object") {
                    state._indexes.push(key);
                    content += this._traverse(value, state, f);
                    state._indexes.pop();
                }
            });

            state._currentNode = state._ancestors.pop();
            state._containers.pop();

            // Note that this is post-order traversal. We call the
            // callback on the way back up the tree, not on the way down.
            // That way we already know all the content contained within
            // the node.
            f(node, state, content);
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
