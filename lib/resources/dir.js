module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("mkdir " + name).check("-d "+name);

    if(opts.chmod)
      resource.step("chmod " + opts.chmod + " "+name).check("stat -L --format=%a "+name, "==", opts.chmod);
  });
};