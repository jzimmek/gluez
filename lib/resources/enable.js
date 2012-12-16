module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("/usr/sbin/update-rc.d "+name+" defaults")
      .ge("update-rc.d -n -f "+name+" remove | grep '/etc/rc' | wc -l", 1);
  });
};