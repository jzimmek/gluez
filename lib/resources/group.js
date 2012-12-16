module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("groupadd --gid "+opts.gid+" "+name)
      .eq("cat /etc/group | grep -E '^"+name+":' | wc -l", 1)
      .eq("cat /etc/group | grep -E '^"+name+":' | cut -f 3 -d ':' | grep '"+opts.gid+"' | wc -l", 1);
  });
};