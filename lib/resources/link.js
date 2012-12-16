module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("ln -f -s "+opts.target+" "+name).check("-L "+name);
  });
};