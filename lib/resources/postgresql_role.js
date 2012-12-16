module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("echo \\\"create role "+name+" with login password '"+opts.password+"'\\\" | psql")
      .eq("echo '\\du' | psql -A --field-separator ' ' | cut -f 1 -d ' ' | grep "+name+" | wc -l", 1);
  });
};