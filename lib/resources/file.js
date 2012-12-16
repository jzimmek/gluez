module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("touch " + name).check("-f "+name);

    if(opts.chmod)
      resource.step("chmod " + opts.chmod + " "+name).check("stat -L --format=%a "+name, "==", opts.chmod);
  });
};