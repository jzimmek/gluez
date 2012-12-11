var _ = require("underscore")._
    ,fs = require("fs");

var $ = new function(){
  var f = function(){
    var prev = f.asUser;
    if(arguments.length == 1){
      f.asUser = "root";
      arguments[0]();
    }else{
      f.asUser = arguments[0];
      arguments[1]();
    }
    f.asUser = prev;

    return $;
  };

  var encode64 = function(str){
    return new Buffer(str).toString("base64");
  };

  (function(){
    this.entries = [];
    this.recipes = {};
    this.asUser = "root";

    var w = function(str){
      console.info(str);
    };

    this.homeDir = function(){
      if(this.asUser == "root")   return "/root";
      else                        return "/home/"+this.asUser;
    };

    this.findResource = function(name){
      return _.detect(this.entries, function(e){ return e.resourceName() == name; });
    };

    this.validateNotify = function(){
      _.each(this.entries, function(e){
        _.each(e.opts.notifies, function(n){
          if(this.findResource(n) == null)
            throw e.resourceName() + " notifies unknown resource: " + n;
        }, this)
      }, this);
    };

    this.validateSubscribe = function(){
      _.each(this.entries, function(e){
        _.each(e.opts.subscribes, function(s){
          if(this.findResource(s) == null)
            throw e.resourceName() + " subscribes to unknown resource: " + s;
        }, this)
      }, this);
    };

    this.validateUniqueResourceName = function(){
      var names = [];

      _.each(this.entries, function(e){
        if(_.include(names, e.resourceName()))
          throw e.resourceName() + " not unique";

        names.push(e.resourceName());
      });
    };

    this.generate = function(dryRun){
      this.validateNotify();
      this.validateSubscribe();
      this.validateUniqueResourceName();

      w("#!/bin/bash");
      // w("set -x"); // debug
      // w("set -e"); // exit on exit != 0

      _.each(this.entries, function(e){
        var steps = [];

        var step = function(code){
          var s = {code: code, checks: []};

          s.check = function(){
            if(arguments.length == 1)   this.checks.push({op: "simple", check: arguments[0]});
            else                        this.checks.push({op: "==", check: [arguments[0], arguments[1]]});

            return this;
          };

          _.each(["eq", "gt", "ge", "lt", "le"], function(op){
            s[op] = function(check, value, subShell){
              this.checks.push({op: "-"+op, check: [check, value]});
              return this;
            };
          });

          s.condition = function(){
            return _.map(this.checks, function(c){
              if(c.op == "simple")  return '$(su -l '+e.asUser+' -c "test '+c.check+'")';
              else                  return '$(su -l '+e.asUser+' -c "test \\"\\$('+c.check[0].toString()+')\\" '+c.op+' \\"'+c.check[1].toString()+'\\"")';
            }).join(" && ");
          };

          steps.push(s);

          return s;
        };

        var transferData = null;
        e.fun.apply(e, [e.name, e.opts, step, function(data){
          transferData = encode64(data);
        }]);

        w("function "+e.functionName()+" {");

        if(transferData)
          w("cat >"+e.homeDir+"/.__transfer__ <<\\EOF\n"+transferData+"\nEOF");

        if(steps.length == 1 && steps[0].checks.length == 0){
          // this step run always e.g. "shell" resource
          w("  " + e.wrapCode(steps[0].code));
          w("  if [[ \"$?\" -eq \"0\" ]]; then");
          w("    echo \"up2date "+e.resourceName()+"\"");
          w("  else");
          w("    echo \"not up2date "+e.resourceName()+"\"");
          w("    exit 1");
        }else{
          w("  " + _.invoke(steps, "condition").join(" && "));
          w("  if [[ \"$?\" -eq \"0\" ]]; then");
          w("    echo \"up2date "+e.resourceName()+"\"");
          w("  else");
          w("    echo \"not up2date "+e.resourceName()+"\"");

          if(!dryRun){
            for(var i=0; i < steps.length; i++){
              w("    "+steps[i].condition()+" || " + e.wrapCode(steps[i].code));
              w("    " + _.invoke(steps.slice(0, i+1), "condition").join(" && "));
              w("    if [[ \"$?\" -eq \"0\" ]]; then");
              w("      echo \"updating ("+(i+1)+"/"+steps.length+") "+e.resourceName()+"\"");
              w("    else");
              w("      echo \"not up2date "+e.resourceName()+"\"");
              w("      exit 1");
              w("    fi");
            }
            w("    echo \"up2date "+e.resourceName()+"\"");
          }

        }

 
        if(e.subscribers().length > 0)    w(_.map(e.subscribers(), function(r){ return "    " + r.functionName(); }).join("\n"));
        if(e.notifies().length > 0)       w(_.map(e.notifies(), function(r){ return "    " + r.functionName(); }).join("\n"));

        w("  fi");

        if(transferData)
          w("  rm "+e.homeDir+"/.__transfer__");

        w("}");

      }, this);

      _.chain(this.entries).reject(function(e){ return e.opts.noop; }).each(function(e){
        w(e.functionName());
      });
    };

    this.recipe = function(name, opts){
      this.recipes[name].apply(this, [(arguments[1]||{}), (arguments[2]||null)]);
    };

    this.resource = function(type, fun, resourceOpts){
      resourceOpts = arguments.length > 2 ? resourceOpts : {};
      var self = this;

      this[type] = function(name, opts){
        opts = arguments.length > 1 ? opts : {};
        opts.notifies = opts.notifies || [];
        opts.subscribes = opts.subscribes || [];

        var pluginEntry = {name: name, type: type, opts: opts, asUser: this.asUser, homeDir: self.homeDir(), fun: fun};
        pluginEntry.functionName = function(){
          var name =  this.type + "_" + (opts.resourceName||this.name).replace(/~/g, "").replace(/\//g, "").replace(/\./g, "").replace(/ /g, "").replace(/-/g, "_").replace(/:/g, "").replace(/#/g, "");
          
          if(this.asUser != "root")
            name = this.asUser + "_" + name;

          return name;
        };
        pluginEntry.wrapCode = function(code){
          return "su -l "+this.asUser+" -c \""+code+"\"";
        };
        pluginEntry.resourceName = function(){
          var name = this.type + ":" + (opts.resourceName||this.name);
          if(this.asUser != "root")
            name = this.asUser + ":" + name;
          return name;
        };
        pluginEntry.notifies = function(){
          return _.map(opts.notifies, function(e){ return self.findResource(e); });
        };
        pluginEntry.subscribers = function(){
          return _(self.entries)
            .chain()
            .select(function(e){ 
              return _.include(e.opts.subscribes, this.resourceName());
            }, this).value();
        };

        this.entries.push(pluginEntry);
      };
    };

  }).apply(f);

  return f;

};

module.exports = $;