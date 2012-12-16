var _ = require("underscore")._;

var Step = function(code){
  this.code = code;
  this.checks = [];
};

_.each(["eq", "lt", "le", "gt", "ge"], function(op){
  Step.prototype[op] = function(){
    this.check.apply(this, [arguments[0], "-"+op, arguments[1]]);
    return this;
  };
});

Step.prototype.checkCmd = function(cmd){
  this.checks.push(cmd);
};

Step.prototype.check = function(){
  switch(arguments.length){
    case 1:
      this.checks.push("test " + arguments[0]);
      break;
    case 3:
      this.checks.push('test \\"\\$('+arguments[0]+')\\"'+' '+arguments[1]+' \\"'+arguments[2]+'\\"');
      break;
    default:
      throw "invalid argument";
  }
  return this;
};

module.exports = Step;