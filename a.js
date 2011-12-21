
var vm = require('vm');

var createContext = function() {    
    // Create our context
    var context = {};
    
    for(var k in global) {
        context[k] = global[k];
    }
    
    // Set everything into the context
    context.require = require;
    context.__filename = __filename;
    context.__dirname = __dirname;
    context.process = process;
    context.console = console;
    context.module = module;
    context.exports = {};
    context.global = context;
    
    return context;
};

var code = [
    "console.log('IN', global.a);",
    "var b = require('./b');",
    "b();",
    "console.log('IN2', global.a);",
    "global.a = 11;",
    "b();"
].join("\n");

global.a = 2;
//vm.runInNewContext(code, createContext(), __filename);

console.log('IN', global.a);
var b = require('./b');
b();
console.log('IN2', global.a);
global.a = 11;
b()