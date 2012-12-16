var _ = require("underscore")._;
var Resource = require("./resource.js");

var w = function(str){
  process.stdout.write(str+"\n");
};

var Shell = function(fun, username){
  this.resources = [];
  this.username = username||"root";
  this.homeDir = this.username == "root" ? "/root" : "/home/"+this.username;

  fun.apply(this);
};

Shell.prototype.recipes = {};

Shell.prototype.recipe = function(name, opts){
  opts = opts||{};
  return this.recipes[name].apply(this, [opts]);
};

Shell.registerRecipe = function(recipeName, fun){
  Shell.prototype.recipes[recipeName] = function(opts){
    return fun.apply(this, [opts]);
  };
};

Shell.registerResource = function(resourceName, fun){
  Shell.prototype[resourceName] = function(name, opts){
    opts = opts||{};
    var r = new Resource(resourceName+":"+name, opts.noop == true);
    fun(r, name, opts);
    this.resources.push(r);
    return r;
  };
};

Shell.prototype.su = function(fun, username){
  var sh = new Shell(fun, username);
  this.resources.push(sh);
  return sh;
};

Shell.prototype.wrap = function(code){
  return "su -l "+this.username+" -c \""+code+"\"";
};

Shell.prototype.generateFunctions = function(dryRun){
  _.each(this.resources, function(r){
    if(r instanceof Shell)  r.generateFunctions();
    else{
      w("function "+r.functionName+" {");
      w("  # "+this.username+" "+r.label);

      if(r.data != null){
        w("[[ -f "+this.homeDir+"/.__transfer__ ]] && rm "+this.homeDir+"/.__transfer__");
        w("cat >"+this.homeDir+"/.__transfer__ <<\\EOF\n"+r.data+"\nEOF");
      }

      if(r.steps.entries.length == 1 && r.steps.entries[0].checks.length == 0){
        if(dryRun){
          // no checks == never up2date
          w("    echo \"not up2date "+r.label+"\"");
        }else{
          w("  "  + this.wrap(r.steps.entries[0].code));
          w('  if [[ "$?" -eq "0" ]]; then');
          w("    echo \"up2date ["+this.username+"] "+r.label+"\"");

          _.each(r.notifyEntries, function(n){
            w("    "+n.functionName + " # " + n.label);
          }, this);

          w("  else");
          w("    echo \"not up2date ["+this.username+"] "+r.label+"\"");
          w("    exit 1");
          w("  fi");
        }
      }else if(r.steps.entries.length > 0){
        w("  "+_.map(r.steps.entries, function(s){ return this.wrap(s.checks.join(" && ")); }, this).join(" && "));
        w('  if [[ "$?" -eq "0" ]]; then');
        w("    echo 'up2date ["+this.username+"] "+r.label+"'");
        w("  else ");

        if(dryRun){
          w("    echo \"not up2date ["+this.username+"] "+r.label+"\"");
        }else{
          for(var i=0; i < r.steps.entries.length; i++){
            w("    "+this.wrap(r.steps.entries[i].checks.join(" && ")) + " || " + this.wrap(r.steps.entries[i].code));
            w("    "+_.map(r.steps.entries.slice(0, i+1), function(s){ return this.wrap(s.checks.join(" && ")); }, this).join(" && "));
            w("    if [[ \"$?\" -eq \"0\" ]]; then");
            w("      echo \"updating ["+this.username+"] ("+(i+1)+"/"+r.steps.entries.length+") "+r.label+"\"");
            w("    else");
            w("      echo \"not up2date ["+this.username+"] ("+(i+1)+"/"+r.steps.entries.length+") "+r.label+"\"");
            w("      exit 1");
            w("    fi");
          }
          w("    echo \"up2date ["+this.username+"] "+r.label+"\"");
        }

        _.each(r.notifyEntries, function(n){
          w("    "+n.functionName + " # " + n.label);
        }, this);

        w("  fi");
      }

      if(r.data != null)
        w("  rm "+this.homeDir+"/.__transfer__");

      w("}");
    }
  }, this);  
};

Shell.prototype.generateFunctionCalls = function(dryRun){
  _.each(this.resources, function(r){
    if(r.noop) return;

    if(r instanceof Shell)    r.generateFunctionCalls(dryRun);
    else                      w(r.functionName + " # " + r.label);
  });  
};

Shell.prototype.generate = function(dryRun){
  w("#!/bin/bash");
  this.generateFunctions(dryRun);
  this.generateFunctionCalls(dryRun);
};

_.each([
  "file", 
  "dir", 
  "edit", 
  "install",
  "enable",
  "disable",
  "transfer",
  "compile",
  "link",
  "shell",
  "start",
  "stop",
  "user",
  "group",
  "postgresql_role",
  "postgresql_database",
  "gem_install",
  "copy"
  ], function(resource){
  require("./resources/"+resource+".js")(Shell, resource);
});

module.exports = Shell;