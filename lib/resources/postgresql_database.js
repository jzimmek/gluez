module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("echo 'create database "+name+" with owner = "+name+"' | psql").eq("echo '\\l' | psql -t | cut -f 1 -d '|' | grep "+name+" | wc -l", 1);
  });
};