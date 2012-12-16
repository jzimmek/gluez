var _ = require("underscore")._;

module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    opts.chmod = opts.chmod || "644";
    opts.vars = opts.vars || {};

    resource.step("touch " + name).check("-f " + name);
    resource.step("chmod "+opts.chmod+" "+name).check("stat -L --format=%a "+name, "==", opts.chmod);

    resource.transfer(_.size(opts.vars) > 0 ? _.template(opts.source.toString())(opts.vars) : opts.source);

    resource.step("chmod u+w "+name+" && cat ~/.__transfer__ | base64 -i -d - > "+name+" && chmod "+opts.chmod+" "+name)
      .check("cat ~/.__transfer__ | base64 -i -d - | md5sum - | cut -f 1 -d ' '", "==", "\\$(md5sum "+name+" | cut -f 1 -d ' ')");
  });
};