var _ = require("underscore")._,
    fs = require("fs");

var register = function ($){
  $.resource("dir", function(name, opts, step){
    step("mkdir " + name).check("-d " + name);
  });

  $.resource("file", function(name, opts, step){
    step("touch " + name).check("-f " + name);

    if(opts.chmod)    
      step("chmod "+opts.chmod+" "+name).check("stat -L --format=%a "+name, opts.chmod);
  });

  $.resource("install", function(name, opts, step){
    step("apt-get install "+name+" --yes")
      .eq("apt-cache policy "+name+" | grep Installed | wc -l", 1)
      .eq("apt-cache policy "+name+" | grep Installed | grep '(none)' | wc -l", 0);
  });

  $.resource("enable", function(name, opts, step){
    step("/usr/sbin/update-rc.d "+name+" defaults")
      .ge("update-rc.d -n -f "+name+" remove | grep '/etc/rc' | wc -l", 1);
  });

  $.resource("disable", function(name, opts, step){
    step("/usr/sbin/update-rc.d -f "+name+" remove")
      .eq("update-rc.d -n -f "+name+" remove | grep '/etc/rc' | wc -l", 0);
  });

  $.resource("transfer", function(name, opts, step, transfer){
    opts.vars = opts.vars || {};
    opts.chmod = opts.chmod || "644";

    step("touch " + name).check("-f " + name);
    step("chmod "+opts.chmod+" "+name).check("stat -L --format=%a "+name, opts.chmod);

    transfer(_.size(opts.vars) > 0 ? _.template(opts.source.toString())(opts.vars) : opts.source);

    step("chmod u+w "+name+" && cat ~/.__transfer__ | base64 -i -d - > "+name+" && chmod "+opts.chmod+" "+name)
      .check("cat ~/.__transfer__ | base64 -i -d - | md5sum - | cut -f 1 -d ' '", "\\$(md5sum "+name+" | cut -f 1 -d ' ')");
  });

  $.resource("compile", function(name, opts, step){
    step("mkdir ~/tmp").check("-d ~/tmp");

    var filename = name.split("/")[name.split("/").length-1];
    step("wget --no-check-certificate -O ~/tmp/"+filename+" "+name+" && cd ~/tmp && rm -rf ./"+opts.folder+" && "+opts.extract+" && cd "+opts.folder+" && "+opts.compile)
      .check("-x "+opts.executable);
  });

  $.resource("link", function(name, opts, step){
    step("ln -f -s "+opts.target+" "+name).check("-L "+name);
  });

  $.resource("shell", function(name, opts, step){
    var s = step(name);
    if(opts.check)
      s.check(opts.check);
  });

  $.resource("start", function(name, opts, step){
    opts.sleep = opts.sleep || 1;
    var s = step("service "+name+" start && sleep "+opts.sleep);

    if(opts.status)   s.eq("service "+name+" status 2>&1 | "+opts.status[0], opts.status[1]);
    else              s.eq("service "+name+" status 2>&1 | grep -E 'Running|is running|start/running' | wc -l", 1);
  });

  $.resource("stop", function(name, opts, step){
    opts.sleep = opts.sleep || 1;
    var s = step("service "+name+" stop && sleep "+opts.sleep);

    if(opts.status)     s.eq("service "+name+" status 2>&1 | "+opts.status[0], opts.status[1]);
    else                s.eq("service "+name+" status 2>&1 | grep 'not running' | wc -l", 1);
  });

  $.resource("user", function(name, opts, step){
    var cmd = "useradd --create-home --uid "+opts.uid+" --gid "+opts.gid+" --shell /bin/bash";
    if(opts.groups)
      cmd += " -G "+opts.groups.join(",");

    cmd += " "+name;

    step(cmd)
      .eq("cat /etc/passwd | grep -E '^"+name+":' | wc -l", 1)
      .eq("cat /etc/passwd | cut -f 3 -d ':' | grep '"+opts.uid+"' | wc -l", 1)
      .eq("cat /etc/passwd | cut -f 4 -d ':' | grep '"+opts.gid+"' | wc -l", 1);
  });

  $.resource("group", function(name, opts, step){
    step("groupadd --gid "+opts.gid+" "+name)
      .eq("cat /etc/group | grep -E '^"+name+":' | wc -l", 1)
      .eq("cat /etc/group | grep -E '^"+name+":' | cut -f 3 -d ':' | grep '"+opts.gid+"' | wc -l", 1);
  });

  $.resource("postgresql_role", function(name, opts, step){
    step("echo \\\"create role "+name+" with login password '"+opts.password+"'\\\" | psql")
      .eq("echo '\\du' | psql -A --field-separator ' ' | cut -f 1 -d ' ' | grep "+name+" | wc -l", 1);
  });

  $.resource("postgresql_database", function(name, opts, step){
    step("echo 'create database "+name+" with owner = "+name+"' | psql").eq("echo '\\l' | psql -t | cut -f 1 -d '|' | grep "+name+" | wc -l", 1);
  });

  $.resource("gem_install", function(name, opts, step){
    step("gem install "+name+" --version "+opts.version+" --user-install --no-rdoc --no-ri")
      .eq("gem list "+name+" --installed --version "+opts.version+" | grep 'true' | wc -l", 1);
  });

  $.resource("add_line", function(name, opts, step){
    name = name.split("#")[0];
    for(var i=0; i < opts.entries.length; i++){
      var line = opts.entries[i];

      step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && echo '"+line+"' >> "+name)
        .eq("cat "+name+" | grep '"+line+"' | wc -l", 1);
    }
  });

  $.resource("remove_line", function(name, opts, step){
    name = name.split("#")[0];
    for(var i=0; i < opts.entries.length; i++){
      var line = opts.entries[i];

      step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && cat "+name+" | grep -v '"+line+"' > "+name+".tmp && mv "+name+".tmp "+name)
        .eq("cat "+name+" | grep '"+line+"' | wc -l", 0);
    }
  });

  $.resource("substitute", function(name, opts, step){
    name = name.split("#")[0];
    for(var i=0; i < opts.entries.length; i++){
      var pattern = opts.entries[i][0];
      var replacement = opts.entries[i][1];
    
      step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && sed 's/"+pattern+"/"+replacement+"/g' -i "+name)
        .check("cat "+name+" | md5sum - | cut -f 1 -d ' '", "\\$(cat "+name+" | sed 's/"+pattern+"/"+replacement+"/g' | md5sum - | cut -f 1 -d ' ')")
    }
  });
};

module.exports = {register: register};