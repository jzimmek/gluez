module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("cp "+opts.source+" "+name).checkCmd("cmp " + opts.source+" "+name+" > /dev/null 2>&1");
  });
};