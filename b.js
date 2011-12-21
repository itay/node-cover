
module.exports = function() {
    console.log("B1", global.a);
    global.a = 5;
    console.log("B2", global.a);
};