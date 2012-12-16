module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    resource.step("mkdir ~/tmp").check("-d ~/tmp");

    var filename = name.split("/")[name.split("/").length-1];
    resource.step("wget --no-check-certificate -O ~/tmp/"+filename+" "+name+" && cd ~/tmp && rm -rf ./"+opts.folder+" && "+opts.extract+" && cd "+opts.folder+" && "+opts.compile)
      .check("-x "+opts.executable);
  });
};