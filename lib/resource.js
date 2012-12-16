var Steps = require("./steps.js");

var id = 1;

var Resource = function(label, noop){
  this.id = id++;
  this.label = label;
  this.functionName = "fun"+id;
  this.noop = noop;

  this.steps = new Steps;
  this.notifyEntries = [];
  this.data = null;

  this.notifies = function(resource){
    this.notifyEntries.push(resource);
    return this;
  };

  this.subscribes = function(resource){
    resource.notifies(this);
    return this;
  };

  this.step = function(code){
    return this.steps.step(code);
  };

  this.transfer = function(data){
    this.data = new Buffer(data).toString("base64");
    return this;
  };
};


module.exports = Resource;