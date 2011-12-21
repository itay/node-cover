var bunker         = require('bunker')
var Module         = require('module').Module;
var path           = require('path');
var fs             = require('fs');
var vm             = require('vm');
var _              = require('underscore');

// Coverage tracker
function CoverageData (filename, bunker) {
    this.bunker = bunker;
    this.filename = filename;
    this.nodes = {};
    this.source = this.bunker.sources[0];
};

// Note that a node has been visited
CoverageData.prototype.visit = function(node) {
    var node = this.nodes[node.id] = this.nodes[node.id] || {node:node, count:0}
    node.count++;
};

// Get all the nodes we did not see
CoverageData.prototype.missing = function() {
    // Find all the nodes which we haven't seen
    var nodes = this.nodes;
    var missing = this.bunker.nodes.filter(function(node) {
        return !nodes[node.id];
    });

    return missing;
};

// Get all the nodes we did see
CoverageData.prototype.seen = function() {  
    // Find all the nodes we have seen
    var nodes = this.nodes;
    var seen = this.bunker.nodes.filter(function(node) {
        return !!nodes[node.id];
    });
    
    return seen;
};

// Calculate node coverage statistics
CoverageData.prototype.blocks = function() {  
    var parentToNode = {};
    var nodeToParent = {};
    var parents = [];
    var blockId = 0;
    var seenParent = {};
    
    var start = new Date();
    var numBlocks = 0;
    
    // For each node, find its parent
    this.bunker.nodes.forEach(function(node) {
        var parent = node.parent() || {start: {}, end: {}, label: function() { return ""; }};
        
        // This is a hack to get a unique identifier to the parent
        var key = [parent.start.line, parent.start.col, parent.end.line, parent.end.col, parent.label()].join(",");
        
        if (seenParent.hasOwnProperty(key)) {
            nodeToParent[node.id] = seenParent[key];
        }
        else {
            numBlocks++;
            nodeToParent[node.id] = blockId;
            seenParent[key] = blockId++;
        }
    });
    
    // Note which parents (blocks) we've already seen
    var nodes = this.nodes;
    var seenBlocks = {};
    this.bunker.nodes.forEach(function(node) {
        if (nodes[node.id]) {
              seenBlocks[nodeToParent[node.id]] = true;
        }
    });
    
    // Calculate the stats and return them
    var numSeenBlocks = _.keys(seenBlocks).length;
    var numMissingBlocks = numBlocks - numSeenBlocks;
    
    var toReturn = {
        total: numBlocks,
        seen: numSeenBlocks,
        missing: numMissingBlocks,
        percentage: numSeenBlocks / numBlocks
    };
          
    var end = new Date();
    //console.log("Blocks took: " + (end-start));
    
    return toReturn;
};

// Explode all multi-line nodes into single-line ones.
var explodeNodes = function(coverageData, fileData) {  
    var missing = coverageData.missing(); 
    var newNodes = [];
    
    // Get only the multi-line nodes.
    var multiLineNodes = missing.filter(function(node) {
        return (node.node[0].start.line < node.node[0].end.line);
    });
    
    for(var i = 0; i < multiLineNodes.length; i++) {
        // Get the current node and delta
        var node = multiLineNodes[i];
        var lineDelta = node.node[0].end.line - node.node[0].start.line + 1;
        
        for(var j = 0; j < lineDelta; j++) {
            // For each line in the multi-line node, we'll create a 
            // new node, and we set the start and end columns
            // to the correct vlaues.
            var curLine = node.node[0].start.line + j;
            var startCol = 0;
            var endCol = fileData[curLine].length;;
                
            if (curLine === node.node[0].start.line) {
                startCol = node.node[0].start.col;
            }
            else if (curLine === node.node[0].end.line) {
                startCol = 0;
                endCol = node.node[0].end.col;
            }
            
            var newNode = {
                node: [
                    {
                        start: {
                            line: curLine,
                            col: startCol
                        },
                        end: {
                            line: curLine,
                            col: endCol
                        }
                    }
                ]
            };
            
            newNodes.push(newNode);
        }
    }
    
    return newNodes;
}

// Get per-line code coverage information
CoverageData.prototype.coverage = function() {  
    var missingLines = this.missing();
    var fileData = fs.readFileSync(this.filename, 'utf8').split('\n');
    
    // Get a dictionary of all the lines we did observe being at least
    // partially covered
    seen = {};
    
    this.seen().forEach(function(node) {
        seen[node.node[0].start.line] = true;
    });
    
    // Add all the new multi-line nodes.
    missingLines = missingLines.concat(explodeNodes(this, fileData));
    
    var seenNodes = {};
    missingLines = missingLines.sort(
        function(lhs, rhs) {
          var lhsNode = lhs.node[0];
          var rhsNode = rhs.node[0];
          
          // First try to sort based on line
          return lhsNode.start.line < rhsNode.start.line ? -1 : // first try line
                 lhsNode.start.line > rhsNode.start.line ? 1  :
                 lhsNode.start.col < rhsNode.start.col ? -1 : // then try start col
                 lhsNode.start.col > rhsNode.start.col ? 1 :
                 lhsNode.end.col < rhsNode.end.col ? -1 : // then try end col
                 lhsNode.end.col > rhsNode.end.col ? 1 : 
                 0; // then just give up and say they are equal
    }).filter(function(node) {
        // If it is a multi-line node, we can just ignore it
        if (node.node[0].start.line < node.node[0].end.line) {
            return false;
        }
        
        // We allow multiple nodes per line, but only one node per
        // start column (due to how bunker works)
        var okay = false;
        if (seenNodes.hasOwnProperty(node.node[0].start.line)) {
            var isNew = (seenNodes[node.node[0].start.line].indexOf(node.node[0].start.col) < 0);
            if (isNew) {
                seenNodes[node.node[0].start.line].push(node.node[0].start.col);
                okay = true;
            }
        }
        else {
            seenNodes[node.node[0].start.line] = [node.node[0].start.col];
            okay = true;
        }
        
        return okay;
    });
    
    var coverage = {};
    
    missingLines.forEach(function(node) {
        // For each missing line, add some information for it
        var line = node.node[0].start.line + 1;
        var startCol = node.node[0].start.col;
        var endCol = node.node[0].end.col;
        var source = fileData[line - 1];
        var partial = seen.hasOwnProperty(line - 1) && seen[line - 1];
        
        if (coverage.hasOwnProperty(line)) {
            coverage[line].missing.push({startCol: startCol, endCol: endCol});
        }
        else {
            coverage[line] = {
                  partial: partial,
                  source: source,
                  missing: [{startCol: startCol, endCol: endCol}]
            };
      }
    });
    
    return coverage;
};

// Get statistics for the entire file, including per-line code coverage
// and block-level coverage
CoverageData.prototype.stats = function() {
    var missing = this.missing();
    var filedata = fs.readFileSync(this.filename, 'utf8').split('\n');
    
    var observedMissing = [];
    var linesInfo = missing.sort(function(lhs, rhs) {
        return lhs.node[0].start.line < rhs.node[0].start.line ? -1 :
               lhs.node[0].start.line > rhs.node[0].start.line ? 1  :
               0;
        }).filter(function(node) {
            // Make sure we don't double count missing lines due to multi-line
            // issues
            var okay = (observedMissing.indexOf(node.node[0].start.line) < 0);
            if(okay) {
              observedMissing.push(node.node[0].start.line);
            }
            
            return okay;
        }).map(function(node, idx, all) {
            // For each missing line, add info for it
            return {
                lineno: node.node[0].start.line + 1,
                source: function() { return filedata[node.node[0].start.line]; }
            };
        });
        
    var numLines = filedata.length;
    var numMissingLines = observedMissing.length;
    var numSeenLines = numLines - numMissingLines;
    var percentageCovered = numSeenLines / numLines;
        
    return {
        percentage: percentageCovered,
        lines: linesInfo,
        missing: numMissingLines,
        seen: numSeenLines,
        total: numLines,
        coverage: this.coverage(),
        source: this.bunker.sources[0],
        blocks: this.blocks()
    };
};

var globals = {};

// Create the execution environment for the file
var createEnvironment = function(module, filename) {
    // Create a new requires
    var req = function(path) {
        return Module._load(path, module);
    };
    
    // Add various pieces of information to it
    req.resolve = function(request) {
        return Module._resolveFilename(request, module)[1];
    };
    
    req.paths = Module._paths;
    req.main = process.mainModule;
    req.extensions = Module._extensions;
    req.registerExtension = function() {
        throw new Error('require.registerExtension() removed. Use ' +
                        'require.extensions instead.');
    }
    require.cache = Module._cache;

    // Copy over the globals
    var g = globals[module.parent.filename];
    var ctxt = {};
    for(var k in g) {
        ctxt[k] = g[k];
    }

    // And create our context
    ctxt.require    = req;
    ctxt.exports    = module.exports;
    ctxt.__filename = filename;
    ctxt.__dirname  = path.dirname(filename);
    ctxt.process    = process;
    ctxt.console    = console;
    ctxt.module     = module;
    ctxt.global     = ctxt;

    globals[module.filename] = ctxt;

    return ctxt;
};

// Require the CLI module of cover and return it,
// in case anyone wants to use it programmatically
var cli = function() {
    return require('./bin/cover');
}

var cover = function(fileRegex, ignore, passedInGlobals) {
    globals[module.parent.filename] = passedInGlobals;
    
    var originalRequire = require.extensions['.js'];
    var coverageData = {};
    var match = null;
    var target = this;
    
    ignore = ignore || {};
    
    if (fileRegex instanceof RegExp) {
        match = regex;
    }
    else {
        match = new RegExp(fileRegex ? (fileRegex.replace(/\//g, '\\/').replace(/\./g, '\\.')) : ".*", '');
    }
        
    require.extensions['.js'] = function(module, filename) {
        if(!match.test(filename)) return originalRequire(module, filename);
        
        // If the specific file is to be ignored
        var full = path.resolve(filename); 
        if(ignore[full]) {
          return originalRequire(module, filename);
        }
        
        // If any of the parents of the file are to be ignored
        do {
          full = path.dirname(full);
          if (ignore[full]) {
            return originalRequire(module, filename);
          }
        } while(full !== path.dirname(full));
        
        // Create the context, read the file, bunkerize it, and setup
        // the coverage tracker
        var context = target.createEnvironment(module, filename);
        var data = fs.readFileSync(filename, 'utf8');
        var bunkerized = bunker(data);
        var coverage = coverageData[filename] = new CoverageData(filename, bunkerized);
            
        // Add the coverage logic to the bunkerized source
        bunkerized.on('node', coverage.visit.bind(coverage));
        bunkerized.assign(context);
        
        // Instrument the code
        var wrapper = '(function(ctxt) { with(ctxt) { return '+Module.wrap(bunkerized.compile())+'; } })';
        var compiledWrapper = vm.runInThisContext(wrapper, filename, true)(context);
            
        // And execute it
        var args = [context.exports, context.require, module, filename, context.__dirname];
        return compiledWrapper.apply(module.exports, args);
    };
    
    // Setup the data retrieval and release functions
    var coverage = function(ready) {
      ready(coverageData);
    };
    
    coverage.release = function() {
      require.extensions['.js'] = originalRequire;
    };
    
    return coverage;
};

module.exports = {
    cover: cover,
    createEnvironment: createEnvironment,
    cli: cli,
    reporters: {
        html:   require('./reporters/html'),
        plain:  require('./reporters/plain'),
        cli:    require('./reporters/cli'),
        json:   require('./reporters/json')
    }
};