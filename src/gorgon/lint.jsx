const React = require('react');

const Lint = React.createClass({
    propTypes: {
        children: React.PropTypes.oneOfType([
            React.PropTypes.arrayOf(React.PropTypes.node),
            React.PropTypes.node,
        ]),
        display: React.PropTypes.oneOf(["block", "inline"]),
        title: React.PropTypes.string.isRequired,
        message: React.PropTypes.string,
    },
    render: function() {
        const title = `${this.props.title}:\n${this.props.message}`;
        if (this.props.display === 'block') {
            return <div
                style={{
                    backgroundColor: '#fdd',
                    borderRight: '3px dotted red',
                }}
                title={title}
            >
                {this.props.children}
            </div>;
        } else {
            return <span
                style={{
                    backgroundColor: '#fcc',
                    textDecoration: 'dotted red underline',
                }}
                title={title}
            >
                {this.props.children}
            </span>;
        }
    },
});

module.exports = Lint;
