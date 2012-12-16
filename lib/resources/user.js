module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    var cmd = "useradd --create-home --uid "+opts.uid+" --gid "+opts.gid+" --shell /bin/bash";
    if(opts.groups)
      cmd += " -G "+opts.groups.join(",");

    cmd += " "+name;

    resource.step(cmd)
      .eq("cat /etc/passwd | grep -E '^"+name+":' | wc -l", 1)
      .eq("cat /etc/passwd | cut -f 3 -d ':' | grep '"+opts.uid+"' | wc -l", 1)
      .eq("cat /etc/passwd | cut -f 4 -d ':' | grep '"+opts.gid+"' | wc -l", 1);
  });
};