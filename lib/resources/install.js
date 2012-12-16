module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("apt-get install "+name+" --yes")
      .eq("apt-cache policy "+name+" | grep Installed | wc -l", 1)
      .eq("apt-cache policy "+name+" | grep Installed | grep '(none)' | wc -l", 0);
  });
};