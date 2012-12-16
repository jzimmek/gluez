module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("gem install "+name+" --version "+opts.version+" --user-install --no-rdoc --no-ri")
      .eq("gem list "+name+" --installed --version "+opts.version+" | grep 'true' | wc -l", 1);
  });
};