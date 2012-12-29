if(typeof(window) === "undefined")
  var _ = require("underscore")._;

// --------------------------
// Shell
// --------------------------

var Shell = function(fun, username){
  this.entries = [];
  this.username = username||"root";
  this.homeDir = this.username == "root" ? "/root" : "/home/"+this.username;
  fun.apply(this);
};
Shell.prototype.recipes = {};

Shell.prototype.recipe = function(recipeName, opts){
  opts = opts||{};
  return this.recipes[recipeName].apply(this, [opts]);
};

Shell.prototype.su = function(fun, username){
  var sh = new Shell(fun, username);
  var self = this;
  sh._w = function(str){
    self._w(str);
  };
  this.entries.push(sh);
  return sh;
};


Shell.prototype.w = function(str, numIndent){
  numIndent = arguments.length > 0 ? numIndent : 0;
  var indent = "";

  for(var i=0; i < numIndent; i++)
    indent += "  ";

  this._w(indent+str);
};

Shell.prototype._w = function(str){
  console.info(str);
};

Shell.prototype.writeFunctions = function(dry){
  _.each(this.entries, function(r){
    if(r instanceof Shell)  r.writeFunctions(dry);
    else{
      this.w("function "+r.functionName+" {");
      
      r.writeFunctionInfo(1);
      r.writeTransferStart(0);
      r.writeFunctionBody(1, dry);
      r.writeTransferEnd(1);

      this.w("}");
    }
  }, this);
};

Shell.prototype.writeFunctionCalls = function(dry){
  _.each(this.entries, function(r){
    if(r.noop) return;

    if(r instanceof Shell)    r.writeFunctionCalls(dry);
    else                      this.w(r.functionName + " # " + this.username + " " + r.label);
  }, this);  
};

Shell.prototype.generate = function(dry){
  this.w("#!/bin/bash");
  this.writeFunctions(dry);
  this.writeFunctionCalls(dry);
};

Shell.registerRecipe = function(recipeName, fun){
  Shell.prototype.recipes[recipeName] = function(opts){
    opts = opts || {};
    fun.apply(this, [opts]);
  };
};

Shell.registerResource = function(resourceName, fun){
  Shell.prototype[resourceName] = function(name, opts){
    opts = opts || {};
    
    var r = new Resource(this, resourceName+":"+name, opts.noop == true);
    fun.apply(r, [name, opts]);

    this.entries.push(r);

    return r;
  };
};

// --------------------------
// Step
// --------------------------

var Step = function(code){
  this.code = code;
  this.checks = [];
};

Step.prototype.checkCmd = function(cmd){
  this.checks.push(cmd);
};

Step.prototype.check = function(){
  switch(arguments.length){
    case 1:
      this.checks.push("test " + arguments[0]);
      break;
    case 3:
      this.checks.push('test \\"\\$('+arguments[0]+')\\"'+' '+arguments[1]+' \\"'+arguments[2]+'\\"');
      break;
    default:
      throw "invalid argument";
  }
  return this;
};

_.each(["eq", "lt", "le", "gt", "ge"], function(op){
  Step.prototype[op] = function(){
    this.check.apply(this, [arguments[0], "-"+op, arguments[1]]);
    return this;
  };
});

// --------------------------
// Resource
// --------------------------

var Resource = function(shell, label, noop){
  this.shell = shell;
  this.id = Resource.id++;
  this.label = label;
  this.functionName = "fun"+this.id;
  this.noop = noop;

  this.steps = [];
  this.notifyEntries = [];
  this.data = null;
};
Resource.id = 1;

Resource.prototype.notifies = function(resource){
  this.notifyEntries.push(resource);
  return this;
};

Resource.prototype.subscribes = function(resource){
  resource.notifies(this);
  return this;
};

Resource.prototype.transfer = function(data){
  var encode64 = function(str){
    if(typeof(window) === "undefined")    return new Buffer(str).toString("base64");
    else                                  return window.btoa(unescape(encodeURIComponent(str)));
  };

  this.data = encode64(data);
  return this;
};

Resource.prototype.step = function(code){
  var s = new Step(code);
  this.steps.push(s);
  return s;
};

Resource.prototype.wrapCode = function(code){
  return "su -l "+this.shell.username+" -c \""+code+"\"";
};

Resource.prototype.writeUp2date = function(indent){
  this.shell.w("echo \"up2date ["+this.shell.username+"] "+this.label+"\"", indent);
};

Resource.prototype.writeNotUp2date = function(indent){
  this.shell.w("echo \"not up2date ["+this.shell.username+"] "+this.label+"\"", indent);
};

Resource.prototype.writeExitCodeCheck = function(success, failure, indent){
  this.shell.w('if [[ "$?" -eq "0" ]]; then', indent);

  if(success)
    success.apply(this, [indent+1]);

  if(failure){
    this.shell.w("else", indent);
    failure.apply(this, [indent+1]);
  }

  this.shell.w("fi", indent);
};

Resource.prototype.writeFunctionInfo = function(indent){
  this.shell.w("# "+this.shell.username+" "+this.label, indent);
};

Resource.prototype.writeTransferStart = function(indent){
  if(this.data != null){
    this.shell.w("[[ -f "+this.shell.homeDir+"/.__transfer__ ]] && rm "+this.shell.homeDir+"/.__transfer__", indent+1);
    this.shell.w("\ncat >"+this.shell.homeDir+"/.__transfer__ <<\\EOF\n"+this.data+"\nEOF\n", indent);
  }
};

Resource.prototype.writeTransferEnd = function(indent){
  if(this.data != null){
    this.shell.w("rm "+this.shell.homeDir+"/.__transfer__", indent);
  }
};

Resource.prototype.writeFunctionBody = function(indent, dry){
  if(this.steps.length == 1 && this.steps[0].checks.length == 0){
    if(dry){
      this.writeNotUp2date(indent);
      this.writeFunctionNotifies(indent); 
    }else{
      this.shell.w(this.wrapCode(this.steps[0].code), indent);
      this.writeExitCodeCheck(
        // success
        function(indent){ 
          this.writeUp2date(indent);
          this.writeFunctionNotifies(indent); 
        }, 
        // failure
        function(indent){
          this.writeNotUp2date(indent);
          this.shell.w("exit 1", indent);
        },
        indent
      );
    }
  }else{
    this.shell.w(_.map(this.steps, function(s){ return this.wrapCode(s.checks.join(" && ")); }, this).join(" && "), indent);
    this.writeExitCodeCheck(
      // success
      function(indent){
        this.writeUp2date(indent);
      },
      // failure
      function(indent){
        this.writeNotUp2date(indent);
        if(!dry){
          for(var i=0; i < this.steps.length; i++){
            this.shell.w(this.wrapCode(this.steps[i].checks.join(" && ")) + " || " + this.wrapCode(this.steps[i].code), indent);
            this.shell.w(_.map(this.steps.slice(0, i+1), function(s){ return this.wrapCode(s.checks.join(" && ")); }, this).join(" && "), indent);
            this.writeExitCodeCheck(
              // success
              function(indent){
                this.shell.w("echo \"updating ["+this.shell.username+"] ("+(i+1)+"/"+this.steps.length+") "+this.label+"\"", indent);
              },
              // failure
              function(indent){
                this.shell.w("echo \"not up2date ["+this.shell.username+"] ("+(i+1)+"/"+this.steps.length+") "+this.label+"\"", indent);
                this.shell.w("exit 1", indent);
              },
              indent
            );
          }
          this.writeUp2date(indent);
        }
        this.writeFunctionNotifies(indent); 
      },
      indent
    );
  }
};

Resource.prototype.writeFunctionNotifies = function(indent){
  _.each(this.notifyEntries, function(n){
    this.shell.w(n.functionName + " # " + n.label, indent);
  }, this);
};

// --------------------------
// Resources
// --------------------------

Shell.registerResource("edit", function(name, opts){
  this.add = function(line){
    this.step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && echo '"+line+"' >> "+name)
      .check("cat "+name+" | grep '"+line+"' | wc -l", "-eq", 1);
    return this;
  };
  this.remove = function(line){
    this.step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && cat "+name+" | grep -v '"+line+"' > "+name+".tmp && mv "+name+".tmp "+name)
      .check("cat "+name+" | grep '"+line+"' | wc -l", "-eq", 0);
    return this;
  };
  this.substitute = function(pattern, replacement){
    this.step("cp "+name+" "+name+".bak"+(new Date().getTime())+" && sed 's/"+pattern+"/"+replacement+"/g' -i "+name)
      .check("cat "+name+" | md5sum - | cut -f 1 -d ' '", "==", "\\$(cat "+name+" | sed 's/"+pattern+"/"+replacement+"/g' | md5sum - | cut -f 1 -d ' ')");
    return this;
  };
});

Shell.registerResource("install", function(name, opts){
  this.step("apt-get install "+name+" --yes")
    .eq("apt-cache policy "+name+" | grep Installed | wc -l", 1)
    .eq("apt-cache policy "+name+" | grep Installed | grep '(none)' | wc -l", 0);
});

Shell.registerResource("compile", function(name, opts){
  this.step("mkdir ~/tmp").check("-d ~/tmp");

  var filename = name.split("/")[name.split("/").length-1];
  this.step("wget --no-check-certificate -O ~/tmp/"+filename+" "+name+" && cd ~/tmp && rm -rf ./"+opts.folder+" && "+opts.extract+" && cd "+opts.folder+" && "+opts.compile)
    .check("-x "+opts.executable);
});

Shell.registerResource("copy", function(name, opts){
  this.step("cp "+opts.source+" "+name).checkCmd("cmp " + opts.source+" "+name+" > /dev/null 2>&1");
});

Shell.registerResource("disable", function(name, opts){
  this.step("/usr/sbin/update-rc.d -f "+name+" remove")
    .eq("update-rc.d -n -f "+name+" remove | grep '/etc/rc' | wc -l", 0);
});

Shell.registerResource("enable", function(name, opts){
  this.step("/usr/sbin/update-rc.d "+name+" defaults")
    .ge("update-rc.d -n -f "+name+" remove | grep '/etc/rc' | wc -l", 1);
});

Shell.registerResource("gem_install", function(name, opts){
  this.step("gem install "+name+" --version "+opts.version+" --user-install --no-rdoc --no-ri")
    .eq("gem list "+name+" --installed --version "+opts.version+" | grep 'true' | wc -l", 1);
});

Shell.registerResource("group", function(name, opts){
  this.step("groupadd --gid "+opts.gid+" "+name)
    .eq("cat /etc/group | grep -E '^"+name+":' | wc -l", 1)
    .eq("cat /etc/group | grep -E '^"+name+":' | cut -f 3 -d ':' | grep '"+opts.gid+"' | wc -l", 1);
});

Shell.registerResource("link", function(name, opts){
  this.step("ln -f -s "+opts.target+" "+name).check("-L "+name);
});

Shell.registerResource("postgresql_database", function(name, opts){
  this.step("echo 'create database "+name+" with owner = "+name+"' | psql").eq("echo '\\l' | psql -t | cut -f 1 -d '|' | grep "+name+" | wc -l", 1);
});

Shell.registerResource("postgresql_role", function(name, opts){
  this.step("echo \\\"create role "+name+" with login password '"+opts.password+"'\\\" | psql")
    .eq("echo '\\du' | psql -A --field-separator ' ' | cut -f 1 -d ' ' | grep "+name+" | wc -l", 1);
});

Shell.registerResource("shell", function(name, opts){
  this.step(name);
  this.noop = true;
});

Shell.registerResource("start", function(name, opts){
  opts.sleep = opts.sleep || 1;
  var s = this.step("service "+name+" start && sleep "+opts.sleep);

  if(opts.status)   s.eq("service "+name+" status 2>&1 | "+opts.status[0], opts.status[1]);
  else              s.eq("service "+name+" status 2>&1 | grep -E 'Running|is running|start/running' | wc -l", 1);
});

Shell.registerResource("stop", function(name, opts){
  opts.sleep = opts.sleep || 1;
  var s = this.step("service "+name+" stop && sleep "+opts.sleep);

  if(opts.status)     s.eq("service "+name+" status 2>&1 | "+opts.status[0], opts.status[1]);
  else                s.eq("service "+name+" status 2>&1 | grep 'not running' | wc -l", 1);
});

Shell.registerResource("transfer", function(name, opts){
  opts.chmod = opts.chmod || "644";
  opts.vars = opts.vars || {};

  this.step("touch " + name).check("-f " + name);
  this.step("chmod "+opts.chmod+" "+name).check("stat -L --format=%a "+name, "==", opts.chmod);

  this.transfer(_.size(opts.vars) > 0 ? _.template(opts.source.toString())(opts.vars) : opts.source);

  this.step("chmod u+w "+name+" && cat ~/.__transfer__ | base64 -i -d - > "+name+" && chmod "+opts.chmod+" "+name)
    .check("cat ~/.__transfer__ | base64 -i -d - | md5sum - | cut -f 1 -d ' '", "==", "\\$(md5sum "+name+" | cut -f 1 -d ' ')");
});

Shell.registerResource("user", function(name, opts){
  var cmd = "useradd --create-home --uid "+opts.uid+" --gid "+opts.gid+" --shell /bin/bash";
  if(opts.groups)
    cmd += " -G "+opts.groups.join(",");

  cmd += " "+name;

  this.step(cmd)
    .eq("cat /etc/passwd | grep -E '^"+name+":' | wc -l", 1)
    .eq("cat /etc/passwd | cut -f 3 -d ':' | grep '"+opts.uid+"' | wc -l", 1)
    .eq("cat /etc/passwd | cut -f 4 -d ':' | grep '"+opts.gid+"' | wc -l", 1);
});

Shell.registerResource("dir", function(name, opts){
  this.step("mkdir " + name).check("-d "+name);

  if(opts.chmod)
    this.step("chmod " + opts.chmod + " "+name).check("stat -L --format=%a "+name, "==", opts.chmod);
});

Shell.registerResource("file", function(name, opts){
  this.step("touch " + name).check("-f "+name);

  if(opts.chmod)
    this.step("chmod " + opts.chmod + " "+name).check("stat -L --format=%a "+name, "==", opts.chmod);
});

if(typeof(window) === "undefined"){
  module.exports = Shell;
}