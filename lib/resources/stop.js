module.exports = function(shell, resourceName){
  shell.registerResource(resourceName, function(resource, name, opts){  
    opts.sleep = opts.sleep || 1;
    var s = resource.step("service "+name+" stop && sleep "+opts.sleep);

    if(opts.status)     s.eq("service "+name+" status 2>&1 | "+opts.status[0], opts.status[1]);
    else                s.eq("service "+name+" status 2>&1 | grep 'not running' | wc -l", 1);
  });
};