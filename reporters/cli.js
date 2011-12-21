var path = require('path');

module.exports.MAX_FILENAME_LENGTH = 60;
module.exports.name = "cli";
module.exports.format = function(coverageData, table) {    
    var stats = coverageData.stats();
    var filename = path.relative(process.cwd(), coverageData.filename);
    
    if (filename.length > module.exports.MAX_FILENAME_LENGTH) {
        filename = "…" + filename.substr(filename.length - module.exports.MAX_FILENAME_LENGTH + 2);
    }
    
    table.push([
        filename,
        Math.floor(stats.percentage * 100) + "%", 
        stats.missing, 
        stats.total,
        Math.floor(stats.blocks.percentage * 100) + "%",
        stats.blocks.missing,
        stats.blocks.total]);
}