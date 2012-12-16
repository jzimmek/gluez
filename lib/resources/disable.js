module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("/usr/sbin/update-rc.d -f "+name+" remove")
      .eq("update-rc.d -n -f "+name+" remove | grep '/etc/rc' | wc -l", 0);
  });
};