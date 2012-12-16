var Step = require("./step.js");

var Steps = function(){
  this.entries = [];
};

Steps.prototype.step = function(code){
  var s = new Step(code);
  this.entries.push(s);
  return s;
};

module.exports = Steps;